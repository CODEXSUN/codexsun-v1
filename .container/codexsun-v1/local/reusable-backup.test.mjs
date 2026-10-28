import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { findReusableBackup, sameLocalDay } from "./reusable-backup.mjs";

test("reuse requires a successful same-day backup for the same retained servers", async () => {
  const root = await mkdtemp(join(tmpdir(), "codexsun-reuse-"));
  try {
    const operation = join(root, "1793194924976-abcdef");
    const backup = join(operation, "before-migration");
    await mkdir(backup, { recursive: true });
    const files = {
      "databases.sql": "fixture",
      "mysql-system.sql": "fixture",
      "redis.rdb": "fixture",
      "databases.private.json": JSON.stringify(["master"]),
      "previous.private.json": "{}",
      "containers.private.json": JSON.stringify([{ Id: "database" }, { Id: "redis" }])
    };
    const manifest = {};
    for (const [name, content] of Object.entries(files)) {
      await writeFile(join(backup, name), content);
      manifest[name] = createHash("sha256").update(content).digest("hex");
    }
    await writeFile(join(backup, "sha256.json"), JSON.stringify(manifest));
    await writeFile(
      join(operation, "result.json"),
      JSON.stringify({
        success: true,
        backupDirectory: backup,
        databasePreserved: "database",
        redisPreserved: "redis"
      })
    );
    const state = { database: { Id: "database" }, redis: { Id: "redis" }, model: {} };
    assert.equal((await findReusableBackup(root, state)).directory, backup);
    await assert.rejects(
      findReusableBackup(root, {
        ...state,
        model: {
          services: { web: { volumes: [{ type: "volume", source: "new", target: "/data" }] } }
        }
      }),
      /storage scope differs/
    );
    await assert.rejects(
      findReusableBackup(root, { ...state, redis: { Id: "other" } }),
      /requires a successful verified backup/
    );
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await assert.rejects(
      findReusableBackup(root, state, tomorrow),
      /requires a successful verified backup/
    );
    const reuse = join(root, "1793194924977-abcdef");
    await mkdir(reuse);
    await writeFile(join(reuse, "reuse-attempt.json"), JSON.stringify({ baseline: operation }));
    await assert.rejects(findReusableBackup(root, state), /did not finish/);
    await writeFile(join(reuse, "result.json"), JSON.stringify({ success: true, noBackup: true }));
    assert.equal((await findReusableBackup(root, state)).directory, backup);
    const reuse2 = join(root, "1793194924978-abcdef");
    await mkdir(reuse2);
    await writeFile(join(reuse2, "reuse-attempt.json"), JSON.stringify({ baseline: operation }));
    await writeFile(join(reuse2, "result.json"), JSON.stringify({ success: true, noBackup: true }));
    await assert.rejects(findReusableBackup(root, state), /already reused twice/);
    await rm(reuse2, { recursive: true });
    const failed = join(root, "1793194924979-abcdef");
    await mkdir(failed);
    await writeFile(
      join(failed, "result.json"),
      JSON.stringify({ success: false, databaseChangesPossible: true })
    );
    await assert.rejects(
      findReusableBackup(root, state),
      /later update may have changed the database/
    );
    await rm(failed, { recursive: true });
    await writeFile(join(backup, "databases.sql"), "changed");
    await assert.rejects(
      findReusableBackup(root, state, new Date(Date.now() + 1000)),
      /checksum failed/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("calendar day comparison does not cross midnight", () => {
  assert.equal(sameLocalDay(new Date(2026, 9, 28, 0), new Date(2026, 9, 28, 23)), true);
  assert.equal(sameLocalDay(new Date(2026, 9, 28, 23), new Date(2026, 9, 29, 0)), false);
});
