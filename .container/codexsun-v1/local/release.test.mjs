import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { applications } from "./config.mjs";
import { recover } from "./release.mjs";

test("failed local update uses the saved app model without database recovery", async () => {
  const base = resolve(import.meta.dirname, "../../../dist/deployment-local-recovery-tests");
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(join(base, "case-"));
  const previousFile = join(directory, "previous.private.json");
  const calls = [];
  const docker = {
    resumeForRecovery() {
      calls.push("resume");
    },
    async logged(args, path) {
      calls.push({ args, path });
    }
  };
  await recover(
    docker,
    { project: "codexsun-local-cloud" },
    "update",
    true,
    {},
    previousFile,
    [],
    directory
  );
  assert.equal(calls[0], "resume");
  assert.deepEqual(calls[1].args.slice(-applications.length), applications);
  assert.ok(calls[1].args.includes(previousFile));
  const result = JSON.parse(await readFile(join(directory, "result.json"), "utf8"));
  assert.equal(result.applicationRecoveryCompleted, true);
  assert.equal(result.databaseRollbackAttempted, false);
});
