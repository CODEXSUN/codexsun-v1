import test from "node:test";
import assert from "node:assert/strict";
import { verifiedUserCompanyContext } from "./business-import.users.js";
import type { BusinessRun } from "./business-import.types.js";
import type { TransferSession } from "../transfer-session/index.js";

test("user transfer permits only a preserved landing-app difference with verified target identity", async () => {
  const run = {
    sourceId: 3,
    targetTenantId: 9,
    sourceDatabase: "old_db",
    targetDatabase: "new_db",
    tables: [
      { table: "core_companies", status: "success", verified: true, blocked: false, sourceRows: 1 },
      {
        table: "core_default_company_settings",
        status: "warning",
        verified: false,
        blocked: false,
        sourceChanged: false,
        sourceRows: 1,
        targetRows: 1,
        verificationIssues: [],
        sessions: ["session"]
      }
    ]
  } as unknown as BusinessRun;
  const session = {
    sourceId: 3,
    targetTenantId: 9,
    sourceDatabase: "old_db",
    targetDatabase: "new_db",
    targetTable: "core_default_company_settings",
    status: "completed",
    fields: ["singleton_key", "company_id", "financial_year_id", "status"].map((target) => ({
      target,
      source: target,
      mode: "source",
      value: null
    })),
    rows: [
      {
        data: {
          singleton_key: 1,
          company_id: 27,
          financial_year_id: 14,
          landing_app: "application",
          status: "active"
        },
        target: {
          singleton_key: 1,
          company_id: 27,
          financial_year_id: 14,
          landing_app: "billing",
          status: "active"
        }
      }
    ]
  } as unknown as TransferSession;
  const load = async () => session;
  assert.equal(await verifiedUserCompanyContext(run, load), true);
  for (const [field, value] of [
    ["company_id", 28],
    ["financial_year_id", 15],
    ["status", "inactive"],
    ["singleton_key", 2]
  ] as const) {
    const prior = session.rows[0]!.target![field];
    session.rows[0]!.target![field] = value;
    assert.equal(await verifiedUserCompanyContext(run, load), false, field);
    session.rows[0]!.target![field] = prior;
  }
  session.targetTenantId = 8;
  assert.equal(await verifiedUserCompanyContext(run, load), false);
  session.targetTenantId = 9;
  session.fields[1]!.mode = "value";
  assert.equal(await verifiedUserCompanyContext(run, load), false);
  session.fields[1]!.mode = "source";
  run.tables[0]!.verified = false;
  assert.equal(await verifiedUserCompanyContext(run, load), false);
  run.tables[0]!.verified = true;
  run.tables[1]!.sourceChanged = true;
  assert.equal(await verifiedUserCompanyContext(run, load), false);
  run.tables[1]!.sourceChanged = false;
  session.rows.push(session.rows[0]!);
  assert.equal(await verifiedUserCompanyContext(run, load), false);
});
