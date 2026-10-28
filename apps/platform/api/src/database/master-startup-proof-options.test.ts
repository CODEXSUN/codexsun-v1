import assert from "node:assert/strict";
import test from "node:test";
import { assertMasterProofConfiguration } from "./master-startup-proof-options.js";

test("master startup proof accepts only an explicit production command and generated sandbox", () => {
  const valid = "codexsun_master_proof_0123456789abcdef";
  assert.doesNotThrow(() =>
    assertMasterProofConfiguration(valid, "BACKUP_MASTER_STARTUP", "production")
  );
  assert.throws(() => assertMasterProofConfiguration(valid, "", "production"));
  assert.throws(() =>
    assertMasterProofConfiguration(valid, "BACKUP_MASTER_STARTUP", "development")
  );
  assert.throws(() =>
    assertMasterProofConfiguration("codexsun_master_db", "BACKUP_MASTER_STARTUP", "production")
  );
  assert.throws(() =>
    assertMasterProofConfiguration(
      "codexsun_master_proof_xxxxxxxxxxxxxxxx",
      "BACKUP_MASTER_STARTUP",
      "production"
    )
  );
});
