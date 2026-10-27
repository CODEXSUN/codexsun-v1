import assert from "node:assert/strict";
import { test } from "node:test";
import { openProviderDatabase } from "./provider-database";
import { decryptSecret, encryptSecret } from "./credential-vault";

test("stores encrypted provider credentials and rejects a wrong passphrase", async () => {
  const db = await openProviderDatabase(":memory:");
  const secret = encryptSecret("example-secret", "a sufficiently long passphrase");
  await db.insertInto("providers").values({ id: "openai", endpoint: "https://api.openai.com/v1", model: "", encrypted_secret: secret, updated_at: new Date().toISOString() }).execute();
  const row = await db.selectFrom("providers").selectAll().executeTakeFirstOrThrow();
  assert.ok(!row.encrypted_secret?.includes("example-secret"));
  assert.equal(decryptSecret(row.encrypted_secret!, "a sufficiently long passphrase"), "example-secret");
  assert.throws(() => decryptSecret(row.encrypted_secret!, "a different long passphrase"));
  await db.destroy();
});
