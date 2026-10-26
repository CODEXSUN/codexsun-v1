import assert from "node:assert/strict";
import test from "node:test";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { verifyEncrypted } from "../.container/codexsun-v1/lib/local-backup-crypto.mjs";

const magic = Buffer.from("CODEXSUN-AES256-GCM-1\n");
const identity = {
  runId: "synthetic-only",
  database: "fixture_db",
  tenantUuid: "fixture",
  role: "scoped-sql"
};
const sql = "USE `fixture_db`;\nCREATE TABLE `example` (id INT);\n-- Dump completed\n";

async function fixture(t, plaintext = sql, scope = identity) {
  const parent = resolve(process.cwd(), "dist/deployment-tests");
  const root = await mkdtemp(join(parent, "local-integrity-"));
  t.after(() => {
    assert.ok(resolve(root).startsWith(parent + sep));
    return rm(root, { recursive: true, force: true });
  });
  const key = randomBytes(32),
    nonce = randomBytes(12),
    aad = Buffer.from(JSON.stringify(scope));
  t.after(() => key.fill(0));
  const length = Buffer.alloc(4);
  length.writeUInt32BE(aad.length);
  const header = Buffer.concat([magic, length, aad, nonce]);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(header);
  const bytes = Buffer.concat([
    header,
    cipher.update(gzipSync(plaintext)),
    cipher.final(),
    cipher.getAuthTag()
  ]);
  const file = join(root, "synthetic.aes");
  await writeFile(file, bytes);
  return { file, key, bytes };
}

test("actual AES-GCM, gzip and SQL inventory verify without executing SQL or restoring", async (t) => {
  const f = await fixture(t);
  const proof = await verifyEncrypted(f.file, f.key, identity, ["example"]);
  assert.equal(proof.plaintextSha256, createHash("sha256").update(sql).digest("hex"));
  assert.equal(proof.tableDefinitionsVerified, 1);
  assert.equal(proof.aesAuthenticationVerified, true);
  assert.equal(proof.restoreTestPerformed, false);
  assert.equal(proof.noSqlExecuted, true);
});

test("wrong key, wrong scope, damaged authentication tag and truncation fail", async (t) => {
  const f = await fixture(t);
  await assert.rejects(verifyEncrypted(f.file, randomBytes(32), identity, ["example"]));
  await assert.rejects(
    verifyEncrypted(f.file, f.key, { ...identity, database: "other_db" }, ["example"]),
    /scope binding/
  );
  const bad = Buffer.from(f.bytes);
  bad[bad.length - 1] ^= 1;
  await writeFile(f.file, bad);
  await assert.rejects(verifyEncrypted(f.file, f.key, identity, ["example"]));
  await writeFile(f.file, f.bytes.subarray(0, 20));
  await assert.rejects(verifyEncrypted(f.file, f.key, identity, ["example"]));
});

test("missing tables, foreign SQL scope and incomplete dump fail", async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    verifyEncrypted(f.file, f.key, identity, ["example", "missing"]),
    /verification failed/
  );
  const foreign = await fixture(t, sql + "USE `cxapp_forbidden`;\n");
  await assert.rejects(
    verifyEncrypted(foreign.file, foreign.key, identity, ["example"]),
    /verification failed/
  );
  const incomplete = await fixture(t, sql.replace("-- Dump completed", "incomplete"));
  await assert.rejects(
    verifyEncrypted(incomplete.file, incomplete.key, identity, ["example"]),
    /verification failed/
  );
});

test("configuration must contain each previous CODEXSUN application exactly once", async (t) => {
  const scope = {
    ...identity,
    database: null,
    tenantUuid: null,
    role: "codexsun-application-configuration"
  };
  const names = ["/codexsun-api", "/codexsun-web", "/codexsun-shop"];
  const good = await fixture(t, JSON.stringify(names.map((Name) => ({ Name }))), scope);
  assert.equal(
    (await verifyEncrypted(good.file, good.key, scope, null)).restoreTestPerformed,
    false
  );
  const duplicate = await fixture(
    t,
    JSON.stringify(names.map(() => ({ Name: "/codexsun-api" }))),
    scope
  );
  await assert.rejects(
    verifyEncrypted(duplicate.file, duplicate.key, scope, null),
    /Configuration scope/
  );
  const foreign = await fixture(
    t,
    JSON.stringify([{ Name: "/cxapp-api" }, ...names.slice(1).map((Name) => ({ Name }))]),
    scope
  );
  await assert.rejects(
    verifyEncrypted(foreign.file, foreign.key, scope, null),
    /Configuration scope/
  );
});
