import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { join, resolve } from "node:path";
import { literal } from "./config.mjs";

export function assertInfrastructurePortsUnpublished(state) {
  for (const item of [state.database, state.redis])
    assert.ok(
      Object.values(item.NetworkSettings.Ports ?? {}).every((ports) => !ports?.length),
      `${item.Name.slice(1)} must not publish a host port during the update.`
    );
}

export function assertLocalDatabaseTargets(docker, state, backedUpDatabases) {
  const service = state.model.services["codexsun-api"];
  const api = service.environment;
  const master = literal(api.DB_MASTER_NAME);
  const host = state.database.Name.slice(1);
  assert.equal(literal(api.DB_HOST), host, "API database host differs from the selected MariaDB.");
  assert.equal(
    literal(api.DB_PORT),
    "3306",
    "API database port differs from the selected MariaDB."
  );
  assert.equal(
    literal(api.ENABLE_DEFAULT_TENANT_SEED),
    "0",
    "Default tenant seeding must remain disabled."
  );
  const networks = Object.keys(service.networks ?? {});
  assert.ok(networks.length, "API requires an isolated database network.");
  assert.ok(
    networks.every((network) => state.database.NetworkSettings.Networks[network]),
    "Every API network must contain the selected MariaDB."
  );
  for (const key of ["extra_hosts", "dns", "dns_search", "dns_opt", "network_mode"]) {
    const value = service[key];
    assert.ok(
      !value || (Array.isArray(value) && !value.length),
      `API ${key} overrides are not supported during updates.`
    );
  }
  assertInfrastructurePortsUnpublished(state);
  const protectedVolumes = new Set(
    Object.values(state.model.services).flatMap((service) =>
      (service.volumes ?? [])
        .filter((mount) => mount.type === "volume")
        .map((mount) => mount.source)
    )
  );
  for (const mount of [...(state.database.Mounts ?? []), ...(state.redis.Mounts ?? [])]) {
    if (mount.Name) protectedVolumes.add(mount.Name);
  }
  const running = docker.run(["ps", "-q", "--no-trunc"]).trim().split(/\r?\n/u).filter(Boolean);
  for (const id of running.filter((id) => id !== state.database.Id && id !== state.redis.Id)) {
    const member = docker.inspect(id);
    assert.notEqual(
      member.HostConfig?.NetworkMode,
      "host",
      "A running container uses host networking."
    );
    assert.ok(
      !(member.Mounts ?? []).some((mount) => mount.RW && protectedVolumes.has(mount.Name)),
      "A running container can write to protected application storage."
    );
  }
  const infrastructureNetworks = new Set([
    ...Object.keys(state.database.NetworkSettings.Networks),
    ...Object.keys(state.redis.NetworkSettings.Networks ?? {})
  ]);
  for (const network of infrastructureNetworks) {
    const info = docker.json(["network", "inspect", network])[0];
    const ids = Object.keys(info.Containers ?? {});
    for (const item of [state.database, state.redis]) {
      if (item.NetworkSettings.Networks?.[network])
        assert.ok(ids.includes(item.Id), `${item.Name.slice(1)} is missing from its network.`);
    }
    const allowed = new Set([
      state.database.Id,
      state.redis.Id,
      ...state.containers.map((item) => item.Id)
    ]);
    assert.ok(
      ids.every((id) => allowed.has(id)),
      "An unmanaged container can reach the local database network."
    );
    for (const id of ids.filter((id) => id !== state.database.Id)) {
      const member = docker.inspect(id);
      assert.ok(
        !(member.NetworkSettings.Networks[network].Aliases ?? []).includes(host),
        "Database network alias is ambiguous."
      );
    }
  }
  assert.match(master, /^[a-zA-Z0-9_]+$/u, "Invalid master database name.");
  assert.doesNotMatch(
    master,
    /^codexsun_cxtest_[0-9a-f]+$/iu,
    "The master database is excluded from local backups."
  );
  const count = docker
    .run(
      [
        "exec",
        "-i",
        "-e",
        "MYSQL_PWD",
        host,
        "mariadb",
        "--no-defaults",
        `-u${literal(api.DB_USER)}`,
        "-N",
        "--batch",
        master
      ],
      {
        input: `SELECT COUNT(*) FROM tenants t WHERE (t.status = 'active' AND (t.db_name IS NULL OR TRIM(t.db_name) = '')) OR (t.db_name IS NOT NULL AND t.db_name <> '' AND (t.db_name = '${master}' OR COALESCE(t.db_host, '') NOT IN ('', '${host}') OR COALESCE(t.db_port, 3306) <> 3306 OR t.db_name REGEXP '^codexsun_cxtest_[0-9a-f]+$' OR (t.status = 'active' AND NOT EXISTS (SELECT 1 FROM information_schema.SCHEMATA s WHERE s.SCHEMA_NAME = t.db_name))))`,
        env: { ...process.env, MYSQL_PWD: literal(api.DB_PASSWORD) }
      }
    )
    .trim();
  assert.equal(
    count,
    "0",
    "Tenant database targets must use the selected local MariaDB, differ from the master, and exist when active. Review tenant configuration before updating."
  );
  assertDatabaseIdle(docker, host, api, master);
  if (backedUpDatabases) {
    assert.ok(Array.isArray(backedUpDatabases), "Invalid backup database inventory.");
    const targets = docker
      .run(
        [
          "exec",
          "-i",
          "-e",
          "MYSQL_PWD",
          host,
          "mariadb",
          "--no-defaults",
          `-u${literal(api.DB_USER)}`,
          "-N",
          "--batch",
          master
        ],
        {
          input: "SELECT DISTINCT t.db_name FROM tenants t INNER JOIN information_schema.SCHEMATA s ON s.SCHEMA_NAME = t.db_name WHERE t.db_name IS NOT NULL AND t.db_name <> ''",
          env: { ...process.env, MYSQL_PWD: literal(api.DB_PASSWORD) }
        }
      )
      .trim()
      .split(/\r?\n/u)
      .filter(Boolean);
    const available = new Set(backedUpDatabases);
    assert.ok(
      [master, ...targets].every((name) => available.has(name)),
      "A migration target is missing from the verified database backup."
    );
  }
}

export function assertDatabaseIdle(docker, host, api, master) {
  const query = (sql) =>
    docker
      .run(
        [
          "exec",
          "-i",
          "-e",
          "MYSQL_PWD",
          host,
          "mariadb",
          "--no-defaults",
          `-u${literal(api.DB_USER)}`,
          "-N",
          "--batch",
          master
        ],
        { input: sql, env: { ...process.env, MYSQL_PWD: literal(api.DB_PASSWORD) } }
      )
      .trim();
  const canSeeClients = query(
    "SELECT COUNT(*) FROM information_schema.USER_PRIVILEGES WHERE GRANTEE = CONCAT(QUOTE(SUBSTRING_INDEX(CURRENT_USER(), '@', 1)), '@', QUOTE(SUBSTRING_INDEX(CURRENT_USER(), '@', -1))) AND PRIVILEGE_TYPE IN ('PROCESS', 'ALL PRIVILEGES')"
  );
  assert.match(
    canSeeClients,
    /^[1-9]\d*$/u,
    "Database user requires global PROCESS privilege to inspect other clients."
  );
  assert.match(
    query("SELECT @@GLOBAL.event_scheduler"),
    /^(OFF|DISABLED|0)$/iu,
    "MariaDB event scheduler must be disabled during an update."
  );
  assert.equal(
    query("SELECT COUNT(*) FROM information_schema.PROCESSLIST WHERE ID <> CONNECTION_ID()"),
    "0",
    "Other database connections are active. Stop their writers before updating."
  );
}

export async function runDatabaseCommand(docker, project, file, directory, command, proof) {
  assert.ok(["migrations:preflight", "migrations:run", "seed"].includes(command));
  const environment = {};
  const flags = [];
  if (proof) {
    assert.match(proof.sourceContainerId, /^[a-f0-9]{64}$/u);
    assert.ok(typeof proof.secret === "string" && Buffer.byteLength(proof.secret) >= 32);
    const source = resolve(proof.directory).replaceAll("\\", "/");
    environment.CODEXSUN_ISOLATED_ATTESTATION_KEY = proof.secret;
    environment.CODEXSUN_ISOLATED_SOURCE_CONTAINER_ID = proof.sourceContainerId;
    flags.push("--volume", `${source}:/run/codexsun-upgrade-evidence:ro`,
      "--env", "CODEXSUN_ISOLATED_ATTESTATION_KEY",
      "--env", "CODEXSUN_ISOLATED_SOURCE_CONTAINER_ID");
  }
  await docker.logged(
    [
      "compose",
      "-p",
      project,
      "-f",
      file,
      "run",
      "--rm",
      "--no-deps",
      ...flags,
      "--entrypoint",
      "node",
      "codexsun-api",
      "--import",
      "./tools/register-production-package-resolution.mjs",
      "dist/apps/platform/api/database/db-cli.js",
      command,
      ...(proof ? ["--isolated-evidence"] : [])
    ],
    join(directory, `${command.replace(":", "-")}.log`),
    environment
  );
}

export async function runMasterStartupProof(docker, project, file, directory) {
  const environment = {
    CODEXSUN_MASTER_PROOF_CONFIRM: "BACKUP_MASTER_STARTUP",
    CODEXSUN_RESTORE_TEST_DB_NAME: `codexsun_master_proof_${randomBytes(8).toString("hex")}`
  };
  await docker.logged(
    ["compose", "-p", project, "-f", file, "run", "--rm", "--no-deps",
      "--env", "CODEXSUN_MASTER_PROOF_CONFIRM", "--env", "CODEXSUN_RESTORE_TEST_DB_NAME",
      "--entrypoint", "node", "codexsun-api", "--import",
      "./tools/register-production-package-resolution.mjs",
      "dist/apps/platform/api/database/db-cli.js", "master:startup-proof"],
    join(directory, "master-startup-proof.log"),
    environment
  );
}
