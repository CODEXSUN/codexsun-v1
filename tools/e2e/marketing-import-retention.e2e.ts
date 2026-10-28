import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { createConnection } from "mysql2/promise";
import { createPool as createCallbackPool } from "mysql2";
import { Kysely, MysqlDialect, sql } from "kysely";
import { env } from "../../apps/platform/api/src/env.js";
import { migrateSubmissionImport, purgeExpiredSubmissionImports, SubmissionImportSession } from "../../apps/marketing/api/src/modules/submission/submission.import-session.js";
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
    await migrateSubmissionImport(db);
    await sql`INSERT INTO marketing_submission_imports(uuid, company_id, actor_email, filename, mapping_json, rows_json, total, created_at) VALUES
      ('11111111', 1, 'a', 'expired.csv', '{}', '[{"private":"expired"}]', 1, DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 8 DAY)),
      ('22222222', 1, 'a', 'cancel.csv', '{}', '[{"private":"cancel"}]', 1, CURRENT_TIMESTAMP),
      ('33333333', 1, 'b', 'other.csv', '{}', '[{"private":"other"}]', 1, CURRENT_TIMESTAMP)`.execute(db);
    await sql`INSERT INTO marketing_submission_import_receipts(import_uuid,row_index,submission_uuid) VALUES ('11111111',0,'aaaaaaaa'),('22222222',0,'bbbbbbbb')`.execute(db);
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
