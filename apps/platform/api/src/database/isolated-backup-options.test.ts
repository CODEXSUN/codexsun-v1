import assert from "node:assert/strict";
import test from "node:test";
import { isolatedEvidenceRequested } from "./isolated-backup-options.js";

test("isolated evidence requires an explicit supported production CLI argument", () => {
  assert.equal(isolatedEvidenceRequested("migrations:run", "production", []), false);
  for (const command of ["migrations:preflight", "migrations:run", "seed"])
    assert.equal(isolatedEvidenceRequested(command, "production", ["--isolated-evidence"]), true);
  for (const command of ["migrations:preflight", "migrations:run", "seed"])
    assert.equal(
      isolatedEvidenceRequested(command, "production", ["--reused-isolated-evidence"]),
      true
    );
  assert.throws(() =>
    isolatedEvidenceRequested("fresh", "production", ["--reused-isolated-evidence"])
  );
  assert.throws(() =>
    isolatedEvidenceRequested("migrations:run", "development", ["--isolated-evidence"])
  );
  assert.throws(() => isolatedEvidenceRequested("fresh", "production", ["--isolated-evidence"]));
  assert.throws(() =>
    isolatedEvidenceRequested("migrations:run", "production", ["--isolated-evidence", "--other"])
  );
});
