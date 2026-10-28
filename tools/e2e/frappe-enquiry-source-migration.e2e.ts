import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { Kysely, MysqlDialect, sql } from "kysely";
import { createConnection, createPool } from "mysql2";
import { env } from "../../apps/platform/api/src/env.js";
import {
  frappeTenantMigrationBatch,
  type FrappeDatabase
} from "../../apps/frappe/api/src/modules/connection/index.js";

test("enquiry source migration preserves links and leaves ambiguous origins unresolved", async () => {
  const name = `codexsun_frappe_source_e2e_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const admin = createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD
  }).promise();
  const pool = createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: name
  });
  const db = new Kysely<FrappeDatabase>({ dialect: new MysqlDialect({ pool }) });
  try {
    await admin.query(`CREATE DATABASE \`${name}\``);
    await sql`CREATE TABLE frappe_enquiry_sync (enquiry_id INT PRIMARY KEY, remote_name VARCHAR(191) NOT NULL)`.execute(
      db
    );
    await sql`CREATE TABLE frappe_enquiry_snapshots (enquiry_id INT NULL, base_url VARCHAR(2048) NOT NULL)`.execute(
      db
    );
    await sql`INSERT INTO frappe_enquiry_sync VALUES (1, 'Q1'), (2, 'Q2'), (3, 'Q3')`.execute(db);
    await sql`INSERT INTO frappe_enquiry_snapshots VALUES
      (1, 'https://old.example'), (1, 'https://old.example'),
      (2, 'https://old.example'), (2, 'http://local.example')`.execute(db);
    const step = frappeTenantMigrationBatch.steps.find(
      (item) => item.name === "frappe.connection.enquiry-source-key-v12"
    );
    assert.ok(step);
    await step.up(db);
    await step.up(db);
    const rows = await sql<{
      enquiry_id: number;
      remote_name: string;
      source_site_key: string | null;
    }>`
      SELECT enquiry_id, remote_name, source_site_key FROM frappe_enquiry_sync ORDER BY enquiry_id
    `.execute(db);
    assert.deepEqual(rows.rows, [
      {
        enquiry_id: 1,
        remote_name: "Q1",
        source_site_key: createHash("sha256").update("https://old.example").digest("hex")
      },
      { enquiry_id: 2, remote_name: "Q2", source_site_key: null },
      { enquiry_id: 3, remote_name: "Q3", source_site_key: null }
    ]);
  } finally {
    await db.destroy();
    assert.match(name, /^codexsun_frappe_source_e2e_[a-f0-9]{16}$/);
    await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin.end();
  }
});
