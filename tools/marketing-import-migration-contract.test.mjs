import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("submission import table definitions have a registered forward audit upgrade", () => {
  const source = readFileSync("apps/marketing/api/src/modules/submission/submission.import-session.ts", "utf8");
  const migration = readFileSync("apps/marketing/api/src/modules/submission/submission.import-contract.migration.ts", "utf8");
  const registry = readFileSync("apps/marketing/api/src/index.ts", "utf8");
  for (const table of ["marketing_submission_imports", "marketing_submission_import_receipts"]) {
    assert.match(source, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\(`));
    assert.ok(migration.includes(`ALTER TABLE ${table}`));
  }
  assert.match(registry, /version:\s*18,\s*up:\s*migrateSubmissionImportContract/);
  for (const column of ["status", "created_by", "updated_at", "uuid", "created_at"])
    assert.match(migration, new RegExp(`(?:ADD COLUMN IF NOT EXISTS|MODIFY COLUMN) ${column}\\b`));
});
