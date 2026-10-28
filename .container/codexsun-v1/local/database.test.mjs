import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDatabaseIdle,
  assertLocalDatabaseTargets,
  assertMigrationLedgersSettled,
  runDatabaseCommand,
  runMasterStartupProof
} from "./database.mjs";
import { dumpArguments } from "./backup.mjs";

function response(args, options, tenantResult = "0\n") {
  if (args[0] === "ps") return "";
  if (options.input.includes("USER_PRIVILEGES")) return "1\n";
  if (options.input.includes("event_scheduler")) return "OFF\n";
  if (options.input.includes("PROCESSLIST")) return "0\n";
  return tenantResult;
}

const state = {
  database: {
    Name: "/cxapp-mariadb",
    Id: "database",
    NetworkSettings: { Ports: {}, Networks: { isolated: {} } }
  },
  redis: { Name: "/cxapp-redis", Id: "redis", NetworkSettings: { Ports: {} } },
  containers: [],
  model: {
    services: {
      "codexsun-api": {
        networks: { isolated: {} },
        environment: {
          DB_MASTER_NAME: "codexsun",
          DB_HOST: "cxapp-mariadb",
          DB_PORT: "3306",
          ENABLE_DEFAULT_TENANT_SEED: "0",
          DB_USER: "root",
          DB_PASSWORD: "private"
        }
      }
    }
  }
};

test("preflight rejects unfinished tenant migrations before stopping applications", () => {
  const docker = {
    run: (_args, options) => {
      if (options.input.includes("SELECT DISTINCT")) return "tenant_a\n";
      if (options.input.includes("information_schema.tables")) return "1\n";
      return options.input.includes("`tenant_a`") ? "1\n" : "0\n";
    }
  };
  assert.throws(
    () => assertMigrationLedgersSettled(docker, state),
    /tenant_a has an unfinished migration/
  );
  docker.run = (_args, options) =>
    options.input.includes("SELECT DISTINCT")
      ? "tenant_a\n"
      : options.input.includes("information_schema.tables")
        ? "1\n"
        : "0\n";
  assert.doesNotThrow(() => assertMigrationLedgersSettled(docker, state));
});

test("rejects remote or missing active tenant targets and permits absent inactive targets", () => {
  let targetQuery;
  const docker = {
    run: (args, options) => {
      if (options?.input?.includes("FROM tenants t WHERE")) targetQuery = options.input;
      return response(args, options, "1\n");
    },
    json: () => [{ Containers: { database: {} } }]
  };
  assert.throws(() => assertLocalDatabaseTargets(docker, state), /Tenant database targets/u);
  docker.run = (args, options) => response(args, options);
  assert.doesNotThrow(() => assertLocalDatabaseTargets(docker, state));
  assert.match(targetQuery, /t\.status = 'active'.*NOT EXISTS/u);
  assert.match(targetQuery, /t\.db_host.*NOT IN/u);
  assert.match(targetQuery, /t\.db_name = 'codexsun'/u);
});

test("candidate database commands are fixed and preserve production environment", async () => {
  const calls = [];
  const docker = { logged: async (...args) => calls.push(args) };
  await runDatabaseCommand(docker, "project", "candidate.json", "private", "migrations:preflight");
  assert.ok(calls[0][0].includes("migrations:preflight"));
  assert.ok(!calls[0][0].includes("NODE_ENV=development"));
  await assert.rejects(runDatabaseCommand(docker, "project", "candidate.json", "private", "fresh"));
});

test("candidate commands mount isolated proof read-only and do not put its key in arguments", async () => {
  const calls = [];
  const docker = { logged: async (...args) => calls.push(args) };
  const proof = {
    directory: "private-proof",
    secret: "s".repeat(64),
    sourceContainerId: "a".repeat(64)
  };
  await runDatabaseCommand(docker, "project", "candidate.json", "private", "seed", proof);
  const [args, , environment] = calls[0];
  assert.ok(args.includes("--isolated-evidence"));
  assert.ok(args.some((arg) => arg.endsWith(":/run/codexsun-upgrade-evidence:ro")));
  assert.ok(!args.some((arg) => arg.includes(proof.secret)));
  assert.equal(environment.CODEXSUN_ISOLATED_ATTESTATION_KEY, proof.secret);
  assert.equal(environment.CODEXSUN_ISOLATED_SOURCE_CONTAINER_ID, proof.sourceContainerId);
});

test("master startup proof uses a unique explicit sandbox and production CLI", async () => {
  const calls = [];
  const docker = { logged: async (...args) => calls.push(args) };
  await runMasterStartupProof(docker, "project", "candidate.json", "private");
  await runMasterStartupProof(docker, "project", "candidate.json", "private");
  const [args, , environment] = calls[0];
  assert.ok(args.includes("master:startup-proof"));
  assert.ok(!args.includes("--isolated-evidence"));
  assert.equal(environment.CODEXSUN_MASTER_PROOF_CONFIRM, "BACKUP_MASTER_STARTUP");
  assert.match(environment.CODEXSUN_RESTORE_TEST_DB_NAME, /^codexsun_master_proof_[a-f0-9]{16}$/u);
  assert.notEqual(
    environment.CODEXSUN_RESTORE_TEST_DB_NAME,
    calls[1][2].CODEXSUN_RESTORE_TEST_DB_NAME
  );
});

test("rejects remote API targets and exposed local database ports", () => {
  const badHost = structuredClone(state);
  badHost.model.services["codexsun-api"].environment.DB_HOST = "cloud.example";
  assert.throws(() => assertLocalDatabaseTargets({}, badHost), /database host/u);
  const exposed = structuredClone(state);
  exposed.database.NetworkSettings.Ports = { "3306/tcp": [{ HostIp: "127.0.0.1" }] };
  assert.throws(() => assertLocalDatabaseTargets({}, exposed), /publish a host port/u);
});

test("rejects other writers to protected volumes", () => {
  const guarded = structuredClone(state);
  guarded.model.services["codexsun-api"].volumes = [{ type: "volume", source: "media" }];
  const docker = {
    run: () => "other\n",
    inspect: () => ({ Mounts: [{ Name: "media", RW: true }] })
  };
  assert.throws(
    () => assertLocalDatabaseTargets(docker, guarded),
    /protected application storage/u
  );
});

test("rejects disconnected API networks and resolver overrides", () => {
  const disconnected = structuredClone(state);
  disconnected.model.services["codexsun-api"].networks.other = {};
  assert.throws(() => assertLocalDatabaseTargets({}, disconnected), /Every API network/u);
  const override = structuredClone(state);
  override.model.services["codexsun-api"].extra_hosts = ["cxapp-mariadb:203.0.113.1"];
  assert.throws(() => assertLocalDatabaseTargets({}, override), /extra_hosts/u);
});

test("rejects a published Redis port and host-networked containers", () => {
  const exposed = structuredClone(state);
  exposed.redis.NetworkSettings.Ports = { "6379/tcp": [{ HostIp: "127.0.0.1" }] };
  assert.throws(() => assertLocalDatabaseTargets({}, exposed), /publish a host port/u);
  const docker = { run: () => "other", inspect: () => ({ HostConfig: { NetworkMode: "host" } }) };
  assert.throws(() => assertLocalDatabaseTargets(docker, state), /host networking/u);
});

test("requires every database target in the verified dump inventory", () => {
  let targetQuery;
  const docker = {
    run: (args, options) => {
      if (args[0] === "ps") return "";
      if (options.input.startsWith("SELECT DISTINCT")) targetQuery = options.input;
      return options.input.startsWith("SELECT DISTINCT")
        ? "tenant_one\ntenant_two\n"
        : response(args, options);
    },
    json: () => [{ Containers: { database: {} } }]
  };
  assert.throws(
    () => assertLocalDatabaseTargets(docker, state, ["codexsun", "tenant_one"]),
    /missing from the verified database backup/u
  );
  assert.doesNotThrow(() =>
    assertLocalDatabaseTargets(docker, state, ["codexsun", "tenant_one", "tenant_two"])
  );
  assert.match(targetQuery, /INNER JOIN information_schema\.SCHEMATA/u);
});

test("requires complete process visibility, disabled event scheduler and no other clients", () => {
  const api = state.model.services["codexsun-api"].environment;
  const docker = { run: (args, options) => response(args, options) };
  assert.doesNotThrow(() => assertDatabaseIdle(docker, "cxapp-mariadb", api, "codexsun"));
  for (const [needle, output] of [
    ["USER_PRIVILEGES", "0"],
    ["event_scheduler", "ON"],
    ["PROCESSLIST", "1"]
  ]) {
    docker.run = (args, options) =>
      options.input.includes(needle) ? output : response(args, options);
    assert.throws(() => assertDatabaseIdle(docker, "cxapp-mariadb", api, "codexsun"));
  }
});

test("mixed-engine SQL dump holds a global read lock and includes routines, events and triggers", () => {
  const args = dumpArguments("cxapp-mariadb", "root", ["codexsun", "frappe"]);
  for (const flag of ["--lock-all-tables", "--routines", "--events", "--triggers"])
    assert.ok(args.includes(flag));
  assert.ok(!args.includes("--single-transaction"));
  assert.deepEqual(args.slice(-2), ["codexsun", "frappe"]);
});
