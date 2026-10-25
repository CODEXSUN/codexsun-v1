import { test } from "node:test";
import assert from "node:assert/strict";
import { companyBrandingFields, transferCompanyBranding } from "./transfer-session.branding.js";
import type { CommonTableImportHost } from "../import-review/index.js";
import type { TransferDatabase } from "./transfer-session.database.js";
import type { TransferField, TransferSession } from "./transfer-session.types.js";

test("company media uses committed target IDs and stays outside row identity", async () => {
  const fields: TransferField[] = [
    { target: "logo_path", source: "brand_image", mode: "source", value: null }
  ];
  assert.equal(companyBrandingFields("core_companies", fields, true)[0]!.mode, "default");
  assert.equal(companyBrandingFields("core_products", fields, true)[0]!.mode, "source");
  const session = {
    sourceId: 4,
    sourceDatabase: "old_db",
    targetTenantId: 9,
    sourceTable: "old_company",
    targetTable: "core_companies",
    fields,
    actor: "admin",
    rows: [{ sourceId: 7, status: "existing", target: { id: 19 }, message: "Existing" }]
  } as unknown as TransferSession;
  const database = {
    columns: async () => [{ name: "brand_image" }],
    source: { query: async () => [[{ brand_image: "storage/client/public/logo.svg" }]] }
  } as unknown as TransferDatabase;
  const host: Pick<CommonTableImportHost, "copyCompanyBranding"> = {
    copyCompanyBranding: async (input) => {
      assert.equal(input.targetCompanyId, 19);
      assert.equal(input.sourceCompanyId, 7);
      assert.equal(input.paths.logo_path, "storage/client/public/logo.svg");
      return { copied: 1, existing: 0, warnings: [] };
    }
  };
  await transferCompanyBranding(host, session, database);
  assert.equal(session.rows[0]!.branding!.copied, 1);
  assert.equal(session.rows[0]!.status, "existing");
  host.copyCompanyBranding = async () => {
    throw new Error("private detail");
  };
  await transferCompanyBranding(host, session, database);
  assert.equal(session.rows[0]!.branding!.warnings.length, 1);
  assert.ok(!session.rows[0]!.branding!.warnings[0]!.includes("private detail"));
});
