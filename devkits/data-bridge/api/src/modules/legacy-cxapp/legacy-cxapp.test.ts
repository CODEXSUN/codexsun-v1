import { test } from "node:test";
import assert from "node:assert/strict";
import type { Connection } from "mysql2/promise";
import { decimalUnits, legacyLineAmounts, productTaxRate } from "./legacy-cxapp.amounts.js";
import { LegacyPreparationRepository } from "./legacy-cxapp.repository.js";
import type { LegacyPrepared } from "./legacy-cxapp.types.js";
import { legacyPreparationReport } from "./legacy-cxapp.report.js";

test("legacy decimals normalize losslessly and reject partial parsing or overflow", () => {
  assert.equal(decimalUnits(" 9332. ", 4), 93320000n);
  assert.equal(decimalUnits("7 ", 4), 70000n);
  assert.throws(() => decimalUnits("7 bags", 4));
  assert.throws(() => decimalUnits("1,000", 4));
  assert.throws(() => decimalUnits("1.00001", 4));
  assert.throws(() => decimalUnits("100000000000000", 4));
  const data = legacyLineAmounts({
    QTY: "10",
    PRICE: "0.80",
    CGST_PERCENT: "6",
    SGST_PERCENT: "6",
    IGST_PERCENT: "0"
  });
  assert.equal(data.taxable_amount, "8.00");
  assert.equal(data.cgst_amount, "0.48");
  assert.equal(data.line_total, "8.96");
  assert.equal(productTaxRate({ CGST_PERCENT: "", SGST_PERCENT: "", IGST_PERCENT: "" }), null);
  assert.throws(() => productTaxRate({ CGST_PERCENT: "", SGST_PERCENT: "6", IGST_PERCENT: "" }));
  assert.throws(() =>
    legacyLineAmounts({
      QTY: "1",
      PRICE: "100",
      CGST_PERCENT: "9",
      SGST_PERCENT: "9",
      IGST_PERCENT: "18"
    })
  );
});

test("blocked references persist in review without domain or target writes", async () => {
  const writes: string[] = [];
  const stage = {
    execute: async (sql: string) => {
      writes.push(sql);
      return [{ insertId: 1 }];
    }
  } as unknown as Connection;
  const target = {
    query: async () => {
      throw new Error("An unresolved target identity must not be queried.");
    }
  } as unknown as Connection;
  const repository = new LegacyPreparationRepository({} as Connection, stage, target);
  const row = await repository.save(
    {
      phase: "core",
      sourceTable: "city_tbl",
      sourceKey: "1",
      targetTable: "core_cities",
      source: { CITY_ID: 1 },
      data: { name: "Example" },
      issues: []
    },
    ["district_id", "name"],
    [{ field: "district_id", row: undefined }]
  );
  assert.equal(row.stageId, null);
  assert.ok(row.issues.some((i) => i.includes("district_id")));
  assert.equal(writes.length, 1);
  assert.ok(writes[0]!.startsWith("INSERT INTO bridge_legacy_prepared_rows"));
});

test("parent matching translates staging and target keys independently", async () => {
  const targetValues: unknown[][] = [];
  const stage = {
    query: async () => [[{ id: 101, district_id: 99, name: "Example" }]],
    execute: async () => [{ insertId: 1 }]
  } as unknown as Connection;
  const target = {
    query: async (_sql: string, values: unknown[]) => {
      targetValues.push(values);
      return [[{ id: 202, district_id: 7, name: "Example" }]];
    }
  } as unknown as Connection;
  const repository = new LegacyPreparationRepository({} as Connection, stage, target);
  const parent: LegacyPrepared = {
    phase: "core",
    sourceTable: "parent",
    sourceKey: "9000",
    targetTable: "core_districts",
    source: {},
    data: {},
    issues: [],
    stageId: 99,
    targetId: 7
  };
  const row = await repository.save(
    {
      phase: "core",
      sourceTable: "city_tbl",
      sourceKey: "8000",
      targetTable: "core_cities",
      source: {},
      data: { name: "Example" },
      issues: []
    },
    ["district_id", "name"],
    [{ field: "district_id", row: parent }]
  );
  assert.deepEqual(targetValues, [[7, "Example"]]);
  assert.equal(row.data.district_id, 99);
  assert.equal(row.stageId, 101);
  assert.equal(row.targetId, 202);
});

test("private review keeps blocked invoice data and escapes embedded HTML", () => {
  const row: LegacyPrepared = {
    phase: "billing",
    sourceTable: "invoice_tbl",
    sourceKey: "9",
    targetTable: "billing_sales",
    source: { NOTES: "</script><script>bad()</script>" },
    data: { invoice_number: "9", amount: "100.00" },
    issues: ["Year requires review"],
    stageId: null,
    targetId: null
  };
  const report = legacyPreparationReport(
    [row],
    [
      {
        phase: "billing",
        sourceTable: "invoice_tbl",
        sourceKey: "INVOICE_ID",
        targetTable: "billing_sales",
        columns: { invoice_number: "INVOICE_NO" }
      }
    ]
  );
  assert.equal(report.tables[0]!.blocked, 1);
  assert.ok(report.invoiceCsv.includes("Year requires review"));
  assert.ok(report.invoiceCsv.includes('"9"'));
  assert.ok(!report.html.includes("<script>bad()"));
  assert.ok(report.html.includes("Business import is disabled"));
});
