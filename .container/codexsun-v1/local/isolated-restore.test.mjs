import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { verifyBackup } from "./backup.mjs";
import { digest } from "./files.mjs";
import {
  signRestoreTarget,
  signReusedRestoreTarget,
  verifyRestoredData
} from "./isolated-restore.mjs";
import { assertSandbox, sandboxCreateArguments } from "./isolated-sandbox.mjs";

const sourceId = "a".repeat(64);
const sandboxId = "b".repeat(64);
const image = `sha256:${"c".repeat(64)}`;

function container() {
  return {
    Id: sandboxId,
    HostConfig: { NetworkMode: "none", ReadonlyRootfs: true, Privileged: false },
    NetworkSettings: { Networks: { none: {} }, Ports: {} },
    Mounts: [],
    State: { Running: true }
  };
}

test("sandbox creation uses an isolated image and private temporary filesystems", () => {
  const args = sandboxCreateArguments("codexsun-restore-audit-0123456789abcdef", image);
  assert.ok(args.includes("--read-only"));
  assert.deepEqual(args.slice(args.indexOf("--network"), args.indexOf("--network") + 2), [
    "--network",
    "none"
  ]);
  assert.equal(args.filter((value) => value === "--tmpfs").length, 3);
  const script = args.at(-1);
  assert.match(script, /--skip-networking/u);
  assert.match(script, /--event-scheduler=OFF/u);
  assert.match(script, /--skip-grant-tables/u);
  assert.throws(() => sandboxCreateArguments("unsafe", image));
});

test("sandbox verification rejects source reuse, network access and shared mounts", () => {
  assert.doesNotThrow(() => assertSandbox(container(), sourceId));
  assert.throws(() => assertSandbox(container(), sandboxId));
  const networked = container();
  networked.NetworkSettings.Networks.other = {};
  assert.throws(() => assertSandbox(networked, sourceId));
  const shared = container();
  shared.Mounts.push({ Type: "volume" });
  assert.throws(() => assertSandbox(shared, sourceId));
});

test("restore proof signs the fixed evidence fields and target", () => {
  const secret = "x".repeat(64);
  const target = {
    scope: "tenant",
    targetKey: "1",
    databaseName: "codexsun_db",
    host: "codexsun-mariadb",
    port: 3306
  };
  const evidence = {
    sourceContainerId: sourceId,
    sandboxContainerId: sandboxId,
    backupChecksum: "d".repeat(64),
    inventoryChecksum: "e".repeat(64),
    createdAt: "2026-10-28T01:00:00.000Z",
    restoredAt: "2026-10-28T01:01:00.000Z"
  };
  const { attestation, signature } = signRestoreTarget(target, evidence, secret);
  assert.equal(
    signature,
    createHmac("sha256", secret)
      .update("codexsun:isolated-restore-attestation:v1\n")
      .update(JSON.stringify(attestation))
      .digest("hex")
  );
  assert.equal(attestation.networkNone, true);
  assert.equal(attestation.eventSchedulerDisabled, true);
});

test("reused backup is signed as a distinct evidence type without claiming current source match", () => {
  const target = {
    scope: "tenant",
    targetKey: "1",
    databaseName: "codexsun_db",
    host: "db",
    port: 3306
  };
  const evidence = {
    sourceContainerId: sourceId,
    sandboxContainerId: sandboxId,
    backupChecksum: "d".repeat(64),
    inventoryChecksum: "e".repeat(64),
    createdAt: "2026-10-28T01:00:00.000Z",
    restoredAt: "2026-10-28T01:01:00.000Z"
  };
  const secret = "x".repeat(64);
  const { attestation, signature } = signReusedRestoreTarget(target, evidence, secret);
  assert.equal(attestation.version, 2);
  assert.equal(attestation.evidenceType, "reused-prior-backup");
  assert.equal(attestation.matchesCurrentSource, false);
  assert.equal(
    signature,
    createHmac("sha256", secret)
      .update("codexsun:isolated-restore-attestation:v2\n")
      .update(JSON.stringify(attestation))
      .digest("hex")
  );
});

test("restore evidence rejects different data and a changed original backup", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codexsun-restore-test-"));
  const names = ["source.sql", "sandbox.sql", "backup.sql"];
  try {
    const [source, sandbox, backup] = names.map((name) => join(directory, name));
    await writeFile(source, "same tables, data, routines and triggers");
    await writeFile(sandbox, "same tables, data, routines and triggers");
    await writeFile(backup, "initial backup");
    const checksum = await digest(backup);
    await assert.doesNotReject(verifyRestoredData(source, sandbox, backup, checksum));
    await writeFile(sandbox, "different restored rows");
    await assert.rejects(verifyRestoredData(source, sandbox, backup, checksum), /differs/u);
    await writeFile(sandbox, "same tables, data, routines and triggers");
    await writeFile(backup, "changed backup");
    await assert.rejects(verifyRestoredData(source, sandbox, backup, checksum), /Backup changed/u);
  } finally {
    for (const name of names) await unlink(join(directory, name));
    await rmdir(directory);
  }
});

test("application-only backups require a separate system dump while legacy combined backups remain valid", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codexsun-backup-test-"));
  const names = [
    "databases.sql",
    "databases.private.json",
    "redis.rdb",
    "previous.private.json",
    "containers.private.json"
  ];
  try {
    for (const name of names) await writeFile(join(directory, name), name);
    async function saveManifest(databases) {
      await writeFile(join(directory, "databases.private.json"), JSON.stringify(databases));
      const checksums = {};
      for (const name of names) checksums[name] = await digest(join(directory, name));
      await writeFile(join(directory, "sha256.json"), JSON.stringify(checksums));
    }
    await saveManifest(["codexsun_master_db"]);
    await assert.rejects(verifyBackup(directory), /mysql-system.sql/u);
    await saveManifest(["codexsun_master_db", "mysql"]);
    await assert.doesNotReject(verifyBackup(directory));
  } finally {
    for (const name of [...names, "sha256.json"]) await unlink(join(directory, name));
    await rmdir(directory);
  }
});
