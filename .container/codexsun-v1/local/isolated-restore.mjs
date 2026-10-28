import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { copyFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { literal } from "./config.mjs";
import { digest, privateDirectory, privateWrite, readJson } from "./files.mjs";
import { restoreIntoSandbox, sandboxDump } from "./isolated-sandbox.mjs";

const domain = "codexsun:isolated-restore-attestation:v1\n";

export async function createIsolatedRestoreProof(docker, state, backupDir, proofDir) {
  const backupFile = join(backupDir, "databases.sql");
  const databases = await readJson(join(backupDir, "databases.private.json"));
  assert.ok(databases.length && databases.every(validIdentifier), "Invalid backup schema list.");
  assert.ok(!databases.includes("mysql"), "System schema must be backed up separately.");
  const api = state.model.services["codexsun-api"].environment;
  const master = literal(api.DB_MASTER_NAME);
  assert.ok(databases.includes(master), "Platform database is missing from backup.");
  const initialChecksum = await digest(backupFile);
  const createdAt = (await stat(backupFile)).mtime.toISOString();
  await privateDirectory(proofDir);
  const targets = migrationTargets(docker, state, databases);
  const sandbox = await restoreIntoSandbox(docker, state.database, backupFile, proofDir);
  try {
    const sourceDump = join(proofDir, "source-verify.sql");
    const sandboxDumpPath = join(proofDir, "sandbox-verify.sql");
    const source = state.database.Name.slice(1);
    const user = literal(api.DB_USER);
    const password = literal(api.DB_PASSWORD);
    assert.equal(
      docker.inspect(source).Id,
      state.database.Id,
      "Source container identity changed."
    );
    await assertPrimaryKeys(docker, source, user, password, databases);
    sandbox.assertSafe();
    await sandboxDump(docker, source, user, password, databases, sourceDump);
    await sandboxDump(docker, sandbox.id, "root", "", databases, sandboxDumpPath);
    sandbox.assertSafe();
    assert.equal(
      docker.inspect(source).Id,
      state.database.Id,
      "Source container identity changed."
    );
    const inventoryChecksum = await verifyRestoredData(
      sourceDump,
      sandboxDumpPath,
      backupFile,
      initialChecksum
    );
    const secret = randomBytes(32).toString("hex");
    const restoredAt = new Date().toISOString();
    const entries = targets.map((target) =>
      signRestoreTarget(
        target,
        {
          backupChecksum: initialChecksum,
          createdAt,
          inventoryChecksum,
          restoredAt,
          sandboxContainerId: sandbox.id,
          sourceContainerId: state.database.Id
        },
        secret
      )
    );
    await copyFile(backupFile, join(proofDir, "databases.sql"));
    assert.equal(await digest(join(proofDir, "databases.sql")), initialChecksum);
    await privateWrite(join(proofDir, "attestations.json"), { version: 1, attestations: entries });
    return { directory: proofDir, secret, sourceContainerId: state.database.Id };
  } finally {
    await sandbox.dispose();
  }
}

export async function verifyRestoredData(sourceDump, sandboxDump, backupFile, backupChecksum) {
  const inventoryChecksum = await digest(sourceDump);
  assert.equal(await digest(sandboxDump), inventoryChecksum, "Restored schema or data differs.");
  assert.equal(await digest(backupFile), backupChecksum, "Backup changed during isolated restore.");
  return inventoryChecksum;
}

function migrationTargets(docker, state, databases) {
  const api = state.model.services["codexsun-api"].environment;
  const host = state.database.Name.slice(1);
  const port = Number(literal(api.DB_PORT));
  const master = literal(api.DB_MASTER_NAME);
  const targets = [{ scope: "master", targetKey: "master", databaseName: master, host, port }];
  const rows = query(
    docker,
    host,
    literal(api.DB_USER),
    literal(api.DB_PASSWORD),
    master,
    "SELECT t.id,t.db_name FROM tenants t INNER JOIN information_schema.SCHEMATA s ON s.SCHEMA_NAME=t.db_name WHERE t.db_name IS NOT NULL AND t.db_name<>'' ORDER BY t.id"
  );
  const seen = new Set([master]);
  for (const row of rows ? rows.split(/\r?\n/u) : []) {
    const [id, name, ...extra] = row.split("\t");
    assert.ok(!extra.length && /^[1-9]\d*$/u.test(id) && validIdentifier(name));
    assert.ok(databases.includes(name) && !seen.has(name), "Tenant database target is ambiguous.");
    seen.add(name);
    targets.push({ scope: "tenant", targetKey: id, databaseName: name, host, port });
  }
  return targets;
}

async function assertPrimaryKeys(docker, host, user, password, databases) {
  const quoted = databases.map((name) => `'${name}'`).join(",");
  const count = query(
    docker,
    host,
    user,
    password,
    undefined,
    `SELECT COUNT(*) FROM information_schema.TABLES t WHERE t.TABLE_SCHEMA IN (${quoted}) AND t.TABLE_TYPE='BASE TABLE' AND NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS s WHERE s.TABLE_SCHEMA=t.TABLE_SCHEMA AND s.TABLE_NAME=t.TABLE_NAME AND s.INDEX_NAME='PRIMARY')`
  );
  assert.equal(
    count,
    "0",
    "All tables must have primary keys for deterministic restore verification."
  );
}

function query(docker, host, user, password, database, input) {
  return docker
    .run(
      [
        "exec",
        "-i",
        "-e",
        "MYSQL_PWD",
        host,
        "mariadb",
        "--no-defaults",
        `-u${user}`,
        "-N",
        "--batch",
        ...(database ? [database] : [])
      ],
      { input, env: { ...process.env, MYSQL_PWD: password } }
    )
    .trim();
}

export function signRestoreTarget(target, evidence, secret) {
  const attestation = {
    version: 1,
    ...target,
    sourceContainerId: evidence.sourceContainerId,
    sandboxContainerId: evidence.sandboxContainerId,
    backupChecksum: evidence.backupChecksum,
    inventoryChecksum: evidence.inventoryChecksum,
    createdAt: evidence.createdAt,
    restoredAt: evidence.restoredAt,
    networkNone: true,
    eventSchedulerDisabled: true
  };
  const signature = createHmac("sha256", secret)
    .update(domain)
    .update(JSON.stringify(attestation))
    .digest("hex");
  return { attestation, signature };
}

function validIdentifier(value) {
  return typeof value === "string" && /^[A-Za-z0-9_]+$/u.test(value);
}
