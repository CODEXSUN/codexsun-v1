import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parseLocalOptions } from "./options.mjs";

test("the plan does not require a Docker connection", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./main.mjs", import.meta.url)), "update", "--plan"],
    { encoding: "utf8", env: { ...process.env, DOCKER_HOST: "tcp://invalid.example:1" } }
  );
  assert.equal(result.status, 0);
  assert.match(result.stdout, /five services/u);
});

test("local options reject unknown, repeated, and incompatible flags", () => {
  assert.throws(() => parseLocalOptions("update", ["--migrate"]), /Unknown/u);
  assert.throws(() => parseLocalOptions("update", ["--check", "--check"]), /repeat/u);
  assert.throws(() => parseLocalOptions("update", ["--configure", "--check"]), /own/u);
  assert.throws(() => parseLocalOptions("update", ["--fix"]), /Unknown/u);
});
