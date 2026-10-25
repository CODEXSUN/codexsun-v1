import assert from "node:assert/strict";
import type { RowDataPacket } from "mysql2/promise";
import { identifier } from "../transfer-session/index.js";
import { LegacyPreparationRepository } from "./legacy-cxapp.repository.js";

export async function auditLegacyPreparation(repository: LegacyPreparationRepository) {
  const sourceHeaders = await repository.read("invoice_tbl");
  const sourceItems = await repository.read("invoiceitems_tbl");
  for (const [table, key, source] of [
    ["billing_sales", "INVOICE_ID", sourceHeaders],
    ["billing_sales_items", "INVOICEITEMS_ID", sourceItems]
  ] as const) {
    const rows = repository.rows.filter((r) => r.targetTable === table);
    assert.equal(rows.length, source.length, `Complete ${table} collection required.`);
    assert.equal(new Set(rows.map((r) => r.sourceKey)).size, source.length);
    const byKey = new Map(rows.map((r) => [r.sourceKey, r]));
    for (const original of source)
      assert.deepEqual(byKey.get(String(original[key]))?.source, original);
  }
  const headerKeys = new Set(sourceHeaders.map((r) => Number(r.INVOICE_ID)));
  assert.ok(sourceItems.every((r) => headerKeys.has(Number(r.INVOICE_ID))));
  const [[targetInvoices]] = await repository.target.query<RowDataPacket[]>(
    "SELECT COUNT(*) n FROM billing_sales"
  );
  const [[stageInvoices]] = await repository.stage.query<RowDataPacket[]>(
    "SELECT COUNT(*) n FROM billing_sales"
  );
  assert.equal(Number(targetInvoices!.n), 0, "Preparation must not import target invoices.");
  assert.equal(Number(stageInvoices!.n), 0, "Unresolved aggregates must remain review-only.");
  const [[unit]] = await repository.target.query<RowDataPacket[]>(
    "SELECT name FROM core_units WHERE id=1"
  );
  assert.equal(unit!.name, "-");
  const [[company]] = await repository.target.query<RowDataPacket[]>(
    "SELECT COUNT(*) n FROM core_companies"
  );
  assert.equal(
    Number(company!.n),
    1,
    "Keep the single owner seed; do not create period-companies."
  );
  const [[authorized]] = await repository.stage.query<RowDataPacket[]>(
    "SELECT COUNT(*) n FROM bridge_legacy_prepared_rows WHERE execution_authorized<>0"
  );
  assert.equal(Number(authorized!.n), 0);
  const tables = new Set(repository.mappings.map((r) => r.targetTable));
  const [foreignKeys] = await repository.stage.query<RowDataPacket[]>(
    `SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`
  );
  let checked = 0;
  for (const foreign of foreignKeys.filter((r) => tables.has(String(r.TABLE_NAME)))) {
    const table = identifier(String(foreign.TABLE_NAME)),
      column = identifier(String(foreign.COLUMN_NAME));
    const parent = identifier(String(foreign.REFERENCED_TABLE_NAME)),
      key = identifier(String(foreign.REFERENCED_COLUMN_NAME));
    const [[result]] = await repository.stage.query<RowDataPacket[]>(
      `SELECT COUNT(*) n FROM ${table} child LEFT JOIN ${parent} parent ON parent.${key}=child.${column}
       WHERE child.${column} IS NOT NULL AND parent.${key} IS NULL`
    );
    assert.equal(Number(result!.n), 0, `Orphan staging relationship: ${table}.${column}`);
    checked++;
  }
  return {
    invoices: sourceHeaders.length,
    items: sourceItems.length,
    sourceSnapshotsExact: true,
    relationshipChecks: checked,
    stagingOrphans: 0,
    targetInvoices: 0,
    stagedInvoices: 0,
    targetCompanies: 1,
    hyphenUnitIdOne: true,
    executionAuthorized: false
  };
}
