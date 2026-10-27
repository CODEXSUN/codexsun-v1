import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { applications } from "./config.mjs";
import { recover, syncCrmPermissions } from "./release.mjs";

test("CRM fix uses the selected image without starting dependencies", async () => {
  const calls = [];
  const docker = {
    async logged(args, path) {
      calls.push({ args, path });
    }
  };
  await syncCrmPermissions(docker, "codexsun-local-cloud", "candidate.json", "logs");
  assert.equal(calls.length, 1);
  assert.ok(calls[0].args.includes("--no-deps"));
  assert.ok(calls[0].args.includes("never"));
  assert.equal(calls[0].args.at(-1), "crm:permissions:sync");
  assert.equal(calls[0].path, join("logs", "crm-permissions.log"));
});

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
