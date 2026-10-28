import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { lstat, readdir, realpath, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { verifyBackup } from "./backup.mjs";
import { readJson } from "./files.mjs";

export async function findReusableBackup(base, state, now = new Date(), currentOperation = "") {
  const root = await realpath(base);
  const names = (await readdir(root))
    .filter((name) => /^\d+-[a-f0-9]+$/u.test(name))
    .sort()
    .reverse();
  let unresolved = false;
  for (const name of names) {
    const operation = join(root, name);
    if (currentOperation && resolve(operation) === resolve(currentOperation)) continue;
    if (!(await lstat(operation)).isDirectory()) continue;
    let result;
    try {
      result = await readJson(join(operation, "result.json"));
    } catch {
      if (
        ["master-startup-proof.log", "migrations-run.log", "seed.log"].some((file) =>
          existsSync(join(operation, file))
        )
      )
        unresolved = true;
      continue;
    }
    if (!result.success && result.databaseChangesPossible) unresolved = true;
    if (!result.success || result.noChanges || result.noBackup || !result.backupDirectory) continue;
    if (result.databasePreserved !== state.database.Id || result.redisPreserved !== state.redis.Id)
      continue;
    const backup = join(operation, "before-migration");
    if (resolve(result.backupDirectory) !== resolve(backup)) continue;
    if (!(await lstat(backup)).isDirectory() || (await realpath(backup)) !== resolve(backup))
      continue;
    const created = (await stat(join(backup, "databases.sql"))).mtime;
    if (created > now || !sameLocalDay(created, now)) continue;
    assert.ok(
      !unresolved,
      "A later update may have changed the database without finishing. Run a normal update before reusing a backup."
    );
    await verifyBackup(backup);
    const containers = await readJson(join(backup, "containers.private.json"));
    assert.ok(
      containers.some((item) => item.Id === state.database.Id),
      "Prior backup database identity differs."
    );
    assert.ok(
      containers.some((item) => item.Id === state.redis.Id),
      "Prior backup Redis identity differs."
    );
    const priorModel = await readJson(join(backup, "previous.private.json"));
    assert.deepEqual(
      storageIdentity(priorModel),
      storageIdentity(state.model),
      "Prior backup storage scope differs."
    );
    await assertReuseLimit(root, operation);
    return { directory: backup, createdAt: created.toISOString(), operation };
  }
  throw new Error(
    "--nobackup requires a successful verified backup from today for the same MariaDB and Redis. Run a normal update first."
  );
}

async function assertReuseLimit(root, baseline) {
  let completed = 0;
  for (const name of await readdir(root)) {
    if (!/^\d+-[a-f0-9]+$/u.test(name)) continue;
    const operation = join(root, name);
    let attempt;
    try {
      attempt = await readJson(join(operation, "reuse-attempt.json"));
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    if (attempt.baseline !== baseline) continue;
    let result;
    try {
      result = await readJson(join(operation, "result.json"));
    } catch {
      throw new Error(
        "An earlier --nobackup attempt did not finish. Run a normal update before retrying."
      );
    }
    assert.ok(
      result.success && result.noBackup,
      "An earlier --nobackup attempt failed. Run a normal update before retrying."
    );
    completed += 1;
  }
  assert.ok(
    completed < 2,
    "This backup was already reused twice. Run a normal update for a new recovery point."
  );
}

function storageIdentity(model) {
  return Object.entries(model.services ?? {})
    .flatMap(([name, service]) =>
      (service.volumes ?? []).map((mount) =>
        [name, mount.type, mount.source, mount.target].join("\0")
      )
    )
    .sort();
}

export function sameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
