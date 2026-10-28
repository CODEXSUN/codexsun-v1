import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  owner,
  python,
  fixture,
  shellPath,
  fakeCommands,
  runShell,
  writeBackup,
  environmentFixture,
  createVpsFixture,
  config
} from "./deployment-test-fixture.mjs";

function container(role, volume, destination, project = "codexsun") {
  const name = `codexsun-${role}`;
  return {
    Name: `/${name}`,
    Image: `sha256:old-${role}`,
    State: { Running: true, Health: { Status: "healthy" } },
    Config: {
      Image: `codexsun/${role}:old`,
      Env: ["FIXTURE_SECRET=not-real"],
      Labels: {
        "com.docker.compose.project": project,
        "com.docker.compose.service": project === "codexsun" ? name : role
      }
    },
    HostConfig: { RestartPolicy: { Name: "unless-stopped" }, PortBindings: {} },
    NetworkSettings: { Networks: { "codexsun-network": { Aliases: [name] } } },
    Mounts: volume
      ? [
          {
            Type: "volume",
            Name: volume,
            Source: `/fixture/${volume}`,
            Destination: destination,
            RW: true
          }
        ]
      : []
  };
}
function state() {
  const templates = {
    "codexsun-api": container("api", "codexsun-data", "/storage"),
    "codexsun-mariadb": container(
      "mariadb",
      "codexsun-mariadb-data",
      "/var/lib/mysql",
      "codexsun-mariadb"
    ),
    "codexsun-redis": container("redis", "codexsun-redis-data", "/data", "codexsun-redis")
  };
  return {
    templates,
    containers: {
      ...structuredClone(templates),
      "codexsun-web": container("web"),
      "codexsun-shop": container("shop")
    },
    volumes: [
      "codexsun-data",
      "codexsun-mariadb-data",
      "codexsun-mariadb-backups",
      "codexsun-redis-data"
    ],
    tableCount: 1,
    records: { masterUsers: 9, tenantInvoices: 42, tenantBalance: "1398.50" }
  };
}
function backups(vps) {
  return readdirSync(join(vps.directory, ".container/backups")).map((name) =>
    join(vps.directory, ".container/backups", name)
  );
}
function preserveDatabase(before, vps) {
  const after = vps.readState();
  assert.deepEqual(after.containers["codexsun-mariadb"], before.containers["codexsun-mariadb"]);
  assert.deepEqual(after.records, before.records);
  assert.ok(after.volumes.includes("codexsun-mariadb-data"));
  assert.ok(after.volumes.includes("codexsun-mariadb-backups"));
  assert.doesNotMatch(vps.calls(), /^(?:stop|kill|start|rm).*codexsun-mariadb/mu);
  return after;
}
function approveNext(vps, realtime = false) {
  const path = join(vps.directory, ".container/deploy.env");
  const current = vps.readState().sourceVersion;
  const parts = current.split(".").map(Number);
  parts[2]++;
  const next = parts.join(".");
  const snapshot = vps.readState();
  snapshot.targetVersion = next;
  vps.env.CODEXSUN_EXPECTED_REVISION = "b".repeat(40);
  snapshot.realtime = realtime;
  writeFileSync(join(vps.directory, "state.json"), JSON.stringify(snapshot));
  writeFileSync(
    path,
    readFileSync(path, "utf8")
      .replace(
        /^CODEXSUN_MIGRATION_COMPATIBLE_VERSION=.*$/mu,
        `CODEXSUN_MIGRATION_COMPATIBLE_VERSION=${next}`
      )
      .replace(/^CODEXSUN_REALTIME_ENABLED=.*$/mu, `CODEXSUN_REALTIME_ENABLED=${realtime ? 1 : 0}`)
      .replace(
        /^CODEXSUN_WORKER_CONTROL_TOKEN=.*$/mu,
        "CODEXSUN_WORKER_CONTROL_TOKEN=fixture-token-012345678901234567890123456789"
      )
  );
}

test("inventory blocks application storage on any MariaDB server and rejects conflicting infrastructure names", () => {
  const directory = fixture(),
    file = environmentFixture(directory);
  const other = container("other-database", "codexsun-data", "/var/lib/mysql");
  const result = spawnSync(python, ["-B", join(owner, "lib/safety.py"), file, "update"], {
    encoding: "utf8",
    input: JSON.stringify([other])
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /database server.*protected/u);
  writeFileSync(
    file,
    readFileSync(file, "utf8")
      .replace(
        "CODEXSUN_MARIADB_CONTAINER=codexsun-mariadb",
        "CODEXSUN_MARIADB_CONTAINER=codexsun-api"
      )
      .replace("DB_HOST=codexsun-mariadb", "DB_HOST=codexsun-api")
  );
  assert.notEqual(config(["validate", file]).status, 0);
});

test("a fresh installer cannot attach another running database's volume", () => {
  const initial = state();
  delete initial.containers["codexsun-api"];
  delete initial.containers["codexsun-web"];
  delete initial.containers["codexsun-shop"];
  initial.containers["other-mariadb"] = initial.containers["codexsun-mariadb"];
  initial.containers["other-mariadb"].Name = "/other-mariadb";
  delete initial.containers["codexsun-mariadb"];
  const vps = createVpsFixture(initial),
    result = vps.run("deploy.sh", "--reuse-database --yes");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /reuse a volume attached/u);
  assert.doesNotMatch(vps.calls(), / build | up |^(?:stop|rm)/mu);
});

test("--configure combined with --check rejects before writing private configuration", () => {
  const vps = createVpsFixture(state()),
    file = join(vps.directory, ".container/deploy.env"),
    before = readFileSync(file, "utf8");
  const result = vps.run("deploy.sh", "--configure --check");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be used alone/u);
  assert.equal(readFileSync(file, "utf8"), before);
});

test("fresh setup creates application infrastructure and runs initial migrations before tenant preflight", () => {
  const initial = state();
  initial.containers = {};
  initial.volumes = [];
  initial.tableCount = 0;
  const vps = createVpsFixture(initial),
    result = vps.run("deploy.sh");
  assert.equal(result.status, 0, result.stderr);
  const after = vps.readState();
  assert.deepEqual(after.migrations, ["migrations:run", "migrations:preflight", "seed"]);
  assert.equal(after.containers["codexsun-mariadb"].State.Running, true);
  assert.ok(after.volumes.includes("codexsun-mariadb-data"));
  assert.equal(backups(vps).length, 1);
});

test("retained data-volume setup requires reuse approval and never seeds retained databases", () => {
  const initial = state();
  initial.containers = { "codexsun-redis": initial.containers["codexsun-redis"] };
  const blocked = createVpsFixture(initial),
    rejected = blocked.run("deploy.sh");
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /Retained MariaDB volume found/u);
  const vps = createVpsFixture(initial),
    result = vps.run("deploy.sh", "--reuse-database --yes");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(vps.readState().migrations, ["migrations:preflight", "migrations:run"]);
  assert.deepEqual(vps.readState().records, initial.records);
});

test("updater rejects a malformed optional SHA before any Docker call", () => {
  for (const expected of ["main", "a".repeat(39)]) {
    const vps = createVpsFixture(state());
    vps.env.CODEXSUN_EXPECTED_REVISION = expected;
    const result = vps.run("update.sh");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Supply the full reviewed SHA/u);
    assert.equal(vps.readState().builds, undefined);
    assert.equal(existsSync(join(vps.directory, ".container/backups")), false);
    assert.equal(existsSync(join(vps.directory, "commands.log")), false);
  }
});

test("a fetched SHA mismatch stops before source merge, build, quiescence, or migration", () => {
  const vps = createVpsFixture(state());
  approveNext(vps);
  vps.env.CODEXSUN_EXPECTED_REVISION = "c".repeat(40);
  const result = vps.run("update.sh");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Fetched source differs from the requested SHA/u);
  assert.equal(vps.readState().commit, "a".repeat(40));
  assert.equal(vps.readState().builds, undefined);
  assert.equal(vps.readState().migrations, undefined);
  assert.doesNotMatch(vps.calls(), /merge --ff-only|^stop /mu);
});

test("updater can select the fetched branch revision without an explicit SHA", () => {
  const vps = createVpsFixture(state());
  approveNext(vps);
  delete vps.env.CODEXSUN_EXPECTED_REVISION;
  const result = vps.run("update.sh");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Source version: .*available version:/u);
  assert.equal(vps.readState().commit, "b".repeat(40));
});

for (const [name, flags] of [
  ["routine update", {}],
  ["migration failure", { failMigration: true }],
  ["partial replacement", { failReplacement: true }]
]) {
  test(`${name} preserves MariaDB and tenant data and uses a final quiesced backup`, () => {
    const initial = { ...state(), ...flags },
      vps = createVpsFixture(initial);
    approveNext(vps, Boolean(flags.failReplacement));
    const result = vps.run("update.sh"),
      after = preserveDatabase(initial, vps);
    assert.equal(result.status === 0, !Object.keys(flags).length, result.stderr);
    assert.equal(backups(vps).length, 2);
    assert.ok(after.containers["codexsun-api"].State.Running);
    if (Object.keys(flags).length)
      assert.equal(
        after.containers["codexsun-api"].Image,
        initial.containers["codexsun-api"].Image
      );
    if (flags.failReplacement) {
      assert.equal(after.containers["codexsun-worker"], undefined);
      assert.equal(after.containers["codexsun-chatb"], undefined);
    }
    assert.doesNotMatch(vps.calls(), /docker-compose\.yml run /u);
  });
}

test("cleanup archives persistent files and images, and never stops or removes MariaDB", () => {
  const initial = state(),
    vps = createVpsFixture(initial),
    result = vps.run("clean.sh");
  assert.equal(result.status, 0, result.stderr);
  const after = preserveDatabase(initial, vps);
  assert.equal(after.containers["codexsun-api"], undefined);
  assert.equal(after.containers["codexsun-redis"], undefined);
  assert.equal(after.volumes.includes("codexsun-data"), false);
  const [backup] = backups(vps);
  for (const file of [
    "databases.sql",
    "storage.tar.gz",
    "redis.tar.gz",
    "runtime-images.tar.gz",
    "rollback.json",
    "SHA256SUMS"
  ])
    assert.ok(existsSync(join(backup, file)), file);
  const model = JSON.parse(readFileSync(join(backup, "rollback.json")));
  assert.equal(model.services["codexsun-api"]["x-codexsun-running"], true);
  const calls = vps.calls();
  assert.ok(calls.indexOf("stop --timeout -1 codexsun-api") < calls.indexOf("mariadb-dump"));
  assert.ok(calls.indexOf("image save") < calls.indexOf("rm -f"));
});

for (const flag of [
  "failDump",
  "failImageArchive",
  "failInventory",
  "failVolumeInventoryAfterDump"
]) {
  test(`cleanup ${flag} aborts deletion and restores previously running services`, () => {
    const initial = { ...state(), [flag]: true },
      vps = createVpsFixture(initial),
      result = vps.run("clean.sh");
    assert.notEqual(result.status, 0);
    const after = preserveDatabase(initial, vps);
    for (const name of ["codexsun-api", "codexsun-redis"])
      assert.equal(after.containers[name].State.Running, true);
    assert.ok(after.volumes.includes("codexsun-data"));
    assert.doesNotMatch(vps.calls(), /^(?:rm|volume rm|image rm) /mu);
  });
}

test("fresh setup refuses to seed an existing tenant database under an empty master", () => {
  const initial = state();
  initial.tableCount = 0;
  initial.tenantTableCount = 1;
  for (const role of ["api", "web", "shop"]) delete initial.containers[`codexsun-${role}`];
  const vps = createVpsFixture(initial),
    result = vps.run("deploy.sh");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Existing tenant database found/u);
  preserveDatabase(initial, vps);
  assert.equal(vps.readState().builds, undefined);
});

test("explicit reuse of an empty master never seeds an existing tenant database", () => {
  const initial = state();
  initial.tableCount = 0;
  initial.tenantTableCount = 1;
  for (const role of ["api", "web", "shop"]) delete initial.containers[`codexsun-${role}`];
  const vps = createVpsFixture(initial),
    result = vps.run("deploy.sh", "--reuse-database --yes");
  assert.equal(result.status, 0, result.stderr);
  preserveDatabase(initial, vps);
  assert.deepEqual(vps.readState().migrations, ["migrations:run", "migrations:preflight"]);
});

test("corrupt rollback backup prevents any Docker recovery operation", () => {
  const directory = fixture(),
    env = fakeCommands(directory, "exit 0");
  writeBackup(directory);
  writeFileSync(join(directory, "rollback.json"), '{"services":{}}');
  const result = runShell(
    directory,
    `source '${shellPath(join(owner, "lib/common.sh"))}'\nsource '${shellPath(join(owner, "lib/backup.sh"))}'\nsource '${shellPath(join(owner, "lib/release.sh"))}'\nBACKUP_DIR='${shellPath(directory)}'\nSERVICES=(codexsun-api)\nrollback_release`,
    env
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /checksum validation failed/u);
  assert.equal(existsSync(join(directory, "commands.log")), false);
});
