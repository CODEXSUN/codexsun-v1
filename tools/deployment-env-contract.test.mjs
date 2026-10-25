import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  root,
  owner,
  bash,
  read,
  shellPath,
  fixture,
  config,
  fakeCommands,
  writeBackup
} from "./deployment-test-fixture.mjs";

test("root shortcuts select only v1 and retired deployment paths are absent", () => {
  assert.match(read("setup.sh"), /codexsun-v1\/deploy\.sh/u);
  assert.match(read("update.sh"), /codexsun-v1\/update\.sh/u);
  for (const name of [
    "prepare-env.sh",
    ".container/setup.sh",
    ".container/update.sh",
    ".container/billing/Dockerfile.api",
    ".container/demo/Dockerfile",
    ".container/local-cloud/prepare.mjs"
  ]) {
    assert.equal(existsSync(resolve(root, name)), false, name);
  }
});

test("all deployment shell scripts parse and help entry points work without Docker", () => {
  function files(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]
    );
  }
  for (const file of [
    ...files(resolve(root, ".container")).filter((name) => name.endsWith(".sh")),
    resolve(root, "setup.sh"),
    resolve(root, "update.sh")
  ]) {
    const result = spawnSync(bash, ["-n", file], { encoding: "utf8" });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
  }
  for (const name of ["setup.sh", "update.sh", ".container/codexsun-v1/clean.sh"]) {
    const result = spawnSync(bash, [resolve(root, name), "--help"], {
      cwd: fixture(),
      encoding: "utf8"
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage:/u);
  }
});

test("configuration reads engine minimums and rejects database reset or unsafe identifiers", () => {
  const result = config(["package", resolve(root, "package.json"), "engines.node"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/u);
  const directory = fixture();
  const file = join(directory, "deploy.env");
  const sample = read(".container/deploy.env.sample").replaceAll(
    /change_this_[a-z_]+/gu,
    "fixture-secret-012345678901234567890123456789"
  );
  writeFileSync(file, sample);
  assert.equal(config(["validate", file]).status, 0);
  writeFileSync(file, sample.replace("DB_DRIVER=mariadb", "DB_DRIVER=sqlite"));
  assert.notEqual(config(["validate", file]).status, 0);
  writeFileSync(file, sample);
  assert.notEqual(config(["validate", file, "fresh"]).status, 0);
  writeFileSync(
    file,
    sample.replace("CODEXSUN_DB_FRESH_ON_START=0", "CODEXSUN_DB_FRESH_ON_START=1")
  );
  assert.notEqual(config(["validate", file]).status, 0);
  writeFileSync(
    file,
    sample.replace("DB_MASTER_NAME=codexsun_master_db", "DB_MASTER_NAME=unsafe'quoted")
  );
  assert.notEqual(config(["validate", file]).status, 0);
});

test("quoted credentials retain escaped characters and literal dollar signs", () => {
  const directory = fixture();
  const file = join(directory, "deploy.env");
  const value = 'fixture\\path"$literal';
  writeFileSync(file, `DB_PASSWORD=${JSON.stringify(value)}\n`);
  assert.equal(config(["env", file, "DB_PASSWORD"]).stdout.trimEnd(), value);
  writeFileSync(file, "DB_PASSWORD='fixture$literal\\'apostrophe'\n");
  assert.equal(config(["env", file, "DB_PASSWORD"]).stdout.trimEnd(), "fixture$literal'apostrophe");
});

test("MariaDB mounts and differing live application storage block destructive adoption", () => {
  const database = [{ Mounts: [{ Name: "codexsun-db", Destination: "/var/lib/mysql" }] }];
  assert.notEqual(config(["protect", "codexsun-db"], JSON.stringify(database)).status, 0);
  assert.equal(config(["protect", "codexsun-data"], JSON.stringify(database)).status, 0);
  assert.notEqual(config(["adoption", "codexsun-data"], JSON.stringify(database)).status, 0);
  const application = [{ Mounts: [{ Name: "codexsun-data", Destination: "/storage" }] }];
  assert.equal(config(["adoption", "codexsun-data"], JSON.stringify(application)).status, 0);
});

test("rollback snapshot retains exact images, private environment, ports, storage, and network", () => {
  const container = {
    Name: "/codexsun-api",
    Image: "sha256:previous",
    Config: {
      Env: ["FIXTURE_SECRET=not-real"],
      Entrypoint: ["node"],
      Cmd: ["server.js"],
      User: "node",
      WorkingDir: "/app"
    },
    HostConfig: {
      RestartPolicy: { Name: "unless-stopped" },
      PortBindings: { "18010/tcp": [{ HostIp: "127.0.0.1", HostPort: "18010" }] }
    },
    NetworkSettings: { Networks: { "cxapp-network": { Aliases: ["codexsun-api"] } } },
    Mounts: [
      {
        Type: "volume",
        Name: "codexsun-data",
        Source: "/docker/data",
        Destination: "/storage",
        RW: true
      }
    ]
  };
  const result = config(["snapshot"], JSON.stringify([container]));
  assert.equal(result.status, 0, result.stderr);
  const model = JSON.parse(result.stdout);
  const api = model.services["codexsun-api"];
  assert.equal(api.image, "sha256:previous");
  assert.equal(api.environment.FIXTURE_SECRET, "not-real");
  assert.equal(api.ports[0].host_ip, "127.0.0.1");
  assert.equal(model.volumes["codexsun-data"].external, true);
  assert.equal(model.networks["cxapp-network"].external, true);
});

test("candidate image pinning removes build instructions and deploys exact immutable identities", () => {
  const model = {
    services: { "codexsun-api": { image: "codexsun/api:1.2.3", build: { target: "api" } } }
  };
  const result = config(["pin", "codexsun-api=sha256:verified"], JSON.stringify(model));
  assert.equal(result.status, 0, result.stderr);
  const api = JSON.parse(result.stdout).services["codexsun-api"];
  assert.equal(api.image, "sha256:verified");
  assert.equal(api.build, undefined);
});

test("Compose resolves the v1 services, external data, and optional realtime without Media binding", () => {
  const result = spawnSync(
    "docker",
    [
      "compose",
      "--env-file",
      resolve(root, ".container/deploy.env.sample"),
      "-f",
      join(owner, "docker-compose.yml"),
      "--profile",
      "realtime",
      "config",
      "--no-env-resolution",
      "--format",
      "json"
    ],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);
  const model = JSON.parse(result.stdout);
  assert.equal(Object.keys(model.services).length, 5);
  assert.equal(model.volumes["application-data"].external, true);
  assert.deepEqual(model.services["codexsun-worker"].profiles, ["realtime"]);
  assert.deepEqual(model.services["codexsun-chatb"].profiles, ["realtime"]);
  assert.equal(model.services["codexsun-api"].volumes.length, 1);
  for (const name of ["codexsun-worker", "codexsun-chatb"]) {
    assert.ok(
      !Object.keys(model.services[name].environment).some((key) => /^(DB_|JWT_|AUTH_)/u.test(key))
    );
  }
});

test("failed database backup stops before build, migration, container replacement, or cleanup", () => {
  const directory = fixture();
  const env = fakeCommands(directory, "exit 23");
  const script = `
export PATH="$CODEXSUN_TEST_BIN:$PATH"
[ "$(command -v docker)" = "$CODEXSUN_TEST_BIN/docker" ] || exit 99
source '${shellPath(join(owner, "lib/common.sh"))}'
source '${shellPath(join(owner, "lib/backup.sh"))}'
PROJECT_ROOT='${shellPath(directory)}'
DB_CONTAINER=fixture-mariadb
SERVICES=()
require_healthy() { :; }
env_value() { case "$1" in CODEXSUN_UPDATE_MIN_BACKUP_FREE_MB) echo 1;; DB_USER) echo fixture;; DB_PASSWORD) echo not-real;; esac; }
create_backup
docker compose build
`;
  const result = spawnSync(bash, ["-c", script], { encoding: "utf8", env });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Database backup failed/u);
  const calls = readFileSync(join(directory, "commands.log"), "utf8");
  assert.match(calls, /mariadb-dump/u);
  assert.doesNotMatch(calls, /compose|\brm\b|\bbuild\b/u);
  assert.doesNotMatch(calls, /not-real/u);
});

test("failed application replacement invokes only the captured rollback and records failure status", () => {
  const directory = fixture();
  const env = fakeCommands(directory, "exit 0");
  writeBackup(directory);
  const script = `
export PATH="$CODEXSUN_TEST_BIN:$PATH"
[ "$(command -v docker)" = "$CODEXSUN_TEST_BIN/docker" ] || exit 99
source '${shellPath(join(owner, "lib/common.sh"))}'
source '${shellPath(join(owner, "lib/release.sh"))}'
source '${shellPath(join(owner, "lib/backup.sh"))}'
SERVICES=(codexsun-api)
check_ownership() { :; }
BACKUP_DIR='${shellPath(directory)}'
CODEXSUN_VERSION=1.2.3
CODEXSUN_REVISION=fixture
REPLACEMENT_STARTED=true
trap on_release_exit EXIT
false
`;
  const result = spawnSync(bash, ["-c", script], { encoding: "utf8", env });
  assert.notEqual(result.status, 0);
  assert.match(
    readFileSync(join(directory, "commands.log"), "utf8"),
    /rollback\.json up -d --no-build --wait/u
  );
  assert.equal(
    JSON.parse(readFileSync(join(directory, "release.json"), "utf8")).status,
    "application-rolled-back"
  );
});

test("backup precedes GitHub fetch and updater uses version approval and an exact fast-forward", () => {
  const update = read(".container/codexsun-v1/update.sh");
  assert.ok(update.indexOf("create_backup") < update.indexOf("fetch --prune"));
  assert.match(update, /merge --ff-only "\$target"/u);
  assert.match(update, /CODEXSUN_MIGRATION_COMPATIBLE_VERSION/u);
  assert.doesNotMatch(update, /git .*reset|--allow-dirty/u);
  const cleanup = read(".container/codexsun-v1/clean.sh");
  assert.ok(cleanup.indexOf("create_backup") < cleanup.indexOf("docker rm -f"));
  assert.match(cleanup, /"\$CONFIG" protect/u);
  assert.doesNotMatch(cleanup, /volume prune|system prune|image rm -f/u);
});

test("production resolver packages remain present in the consolidated API build", () => {
  const dockerfile = read(".container/codexsun-v1/Dockerfile");
  const resolver = read("tools/register-production-package-resolution.mjs");
  for (const [, name] of resolver.matchAll(/\["(@codexsun\/[a-z-]+-api)",/gu)) {
    assert.ok(dockerfile.includes(`npm run build -w ${name}`), name);
  }
});
