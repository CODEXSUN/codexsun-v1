import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { applications } from "./config.mjs";
import { recover, verifyStorefront } from "./release.mjs";

test("storefront check accepts only the expected unmapped-domain denial", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      success: false,
      error: { code: "NOT_FOUND", message: "The public application is not available for this domain." }
    }), { status: 404 });
    await verifyStorefront("http://127.0.0.1/bootstrap");
    globalThis.fetch = async () => new Response(JSON.stringify({ success: false, error: { code: "OTHER" } }), { status: 404 });
    await assert.rejects(verifyStorefront("http://127.0.0.1/bootstrap"));
    globalThis.fetch = async () => new Response(JSON.stringify({ success: true }), { status: 200 });
    await verifyStorefront("http://127.0.0.1/bootstrap");
  } finally {
    globalThis.fetch = original;
  }
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
