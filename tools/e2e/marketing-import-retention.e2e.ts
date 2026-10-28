import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { createConnection } from "mysql2/promise";
import { createPool as createCallbackPool } from "mysql2";
import { Kysely, MysqlDialect, sql } from "kysely";
import { env } from "../../apps/platform/api/src/env.js";
import { purgeExpiredSubmissionImports, SubmissionImportSession } from "../../apps/marketing/api/src/modules/submission/submission.import-session.js";
import { runMigrationBatch } from "@codexsun/framework/db";
import { marketingMigrationBatch } from "../../apps/marketing/api/src/index.js";
import type { MarketingDatabase } from "../../apps/marketing/api/src/context.js";

test("expired and discarded imports remove staged data without touching other owners", async () => {
  assert.equal(env.NODE_ENV, "development");
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(env.DB_HOST));
  const config = { host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD };
  const admin = await createConnection(config);
  const name = "codexsun_marketing_test_" + randomBytes(8).toString("hex");
  let db: Kysely<MarketingDatabase> | undefined;
  try {
    await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4`);
    db = new Kysely({ dialect: new MysqlDialect({ pool: createCallbackPool({ ...config, database: name }) }) });
    const importBatch = { ...marketingMigrationBatch, steps: marketingMigrationBatch.steps.filter((step) => step.version <= 15 || step.version === 18) };
    await runMigrationBatch(db, { ...importBatch, steps: importBatch.steps.filter((step) => step.version <= 15) });
    await sql`INSERT INTO marketing_brands (uuid,company_id,name,timezone,created_by,updated_by)
      VALUES ('aaaaaaaa',1,'Existing brand','UTC','fixture','fixture')`.execute(db);
    await sql`INSERT INTO marketing_submission_imports(uuid, company_id, actor_email, filename, mapping_json, rows_json, total, created_at) VALUES
      ('11111111', 1, 'a', 'expired.csv', '{}', '[{"private":"expired"}]', 1, DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 8 DAY)),
      ('22222222', 1, 'a', 'cancel.csv', '{}', '[{"private":"cancel"}]', 1, CURRENT_TIMESTAMP),
      ('33333333', 1, 'b', 'other.csv', '{}', '[{"private":"other"}]', 1, CURRENT_TIMESTAMP)`.execute(db);
    await sql`INSERT INTO marketing_submission_import_receipts(import_uuid,row_index,submission_uuid) VALUES ('11111111',0,'aaaaaaaa'),('22222222',0,'bbbbbbbb')`.execute(db);
    await runMigrationBatch(db, importBatch);
    await runMigrationBatch(db, importBatch);
    const ledger = await sql<{ version: number; status: string }>`SELECT version,status FROM migration_schema WHERE scope='marketing' AND version IN (15,18) ORDER BY version`.execute(db);
    assert.deepEqual(ledger.rows.map((row) => [Number(row.version), row.status]), [[15, "applied"], [18, "applied"]]);
    const brands = await sql<{ name: string }>`SELECT name FROM marketing_brands WHERE uuid='aaaaaaaa'`.execute(db);
    assert.equal(brands.rows[0]?.name, "Existing brand");
    for (const table of ["marketing_submission_imports", "marketing_submission_import_receipts"]) {
      const columns = await sql<{ COLUMN_NAME: string }>`SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table}`.execute(db);
      const names = columns.rows.map((row) => row.COLUMN_NAME);
      for (const column of ["id", "uuid", "status", "created_by", "created_at", "updated_at"])
        assert.ok(names.includes(column), `${table} is missing ${column}`);
    }
    const audits = await sql<{ uuid: string; created_by: string }>`SELECT uuid,created_by FROM marketing_submission_import_receipts ORDER BY id`.execute(db);
    assert.equal(audits.rows.length, 2);
    assert.ok(audits.rows.every((row) => row.uuid && row.created_by === "a"));
    const imports = await sql<{ created_by: string; status: string }>`SELECT created_by,status FROM marketing_submission_imports WHERE uuid='33333333'`.execute(db);
    assert.deepEqual(imports.rows[0], { created_by: "b", status: "active" });
    await purgeExpiredSubmissionImports(db);
    const context = { database: db, tenantId: 'test', companyId: 1, actorEmail: 'a', allBrands: false, allowedBrands: [], authorize: async () => {} };
    const session = new SubmissionImportSession(context, {} as never);
    await assert.rejects(() => session.cancel('33333333'));
    await session.cancel('22222222');
    const rows = await sql<{ uuid: string }>`SELECT uuid FROM marketing_submission_imports`.execute(db);
    assert.deepEqual(rows.rows.map(row => row.uuid), ['33333333']);
    assert.equal((await sql`SELECT * FROM marketing_submission_import_receipts`.execute(db)).rows.length, 0);
  } finally {
    await db?.destroy();
    await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin.end();
  }
});
