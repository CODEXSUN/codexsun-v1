import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parseLocalOptions } from "./options.mjs";

test("local update accepts a fix and read-only check together", () => {
  const options = parseLocalOptions("update", ["--check", "--fix"]);
  assert.equal(options.check, true);
  assert.equal(options.fix, true);
});

test("a plan can describe the fix without changing anything", () => {
  const options = parseLocalOptions("update", ["--plan", "--fix"]);
  assert.equal(options.plan, true);
  assert.equal(options.fix, true);
  assert.throws(() => parseLocalOptions("update", ["--plan", "--check"]), /without/u);
});

test("the plan does not require a Docker connection", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./main.mjs", import.meta.url)), "update", "--plan", "--fix"],
    { encoding: "utf8", env: { ...process.env, DOCKER_HOST: "tcp://invalid.example:1" } }
  );
  assert.equal(result.status, 0);
  assert.match(result.stdout, /sync CRM permissions/u);
});

test("local options reject unknown, repeated, and incompatible flags", () => {
  assert.throws(() => parseLocalOptions("update", ["--migrate"]), /Unknown/u);
  assert.throws(() => parseLocalOptions("update", ["--fix", "--fix"]), /repeat/u);
  assert.throws(() => parseLocalOptions("update", ["--configure", "--fix"]), /own/u);
  assert.throws(() => parseLocalOptions("deploy", ["--fix"]), /only/u);
});
