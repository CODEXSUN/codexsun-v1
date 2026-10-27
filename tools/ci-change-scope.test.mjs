import assert from "node:assert/strict";
import test from "node:test";
import { documentationOnly } from "./ci-change-scope.mjs";

test("only documentation content uses the narrow CI path", () => {
  assert.equal(documentationOnly(["assist/documentation/CHANGELOG.md"]), true);
  for (const paths of [
    [],
    ["assist/governance/rules.md"],
    ["apps/platform/api/src/auth.ts"],
    ["assist/documentation/a.md", "package-lock.json"],
    ["assist/documentation/a.md\napps/platform/api/a.ts"]
  ]) {
    assert.equal(documentationOnly(paths), false);
  }
});
