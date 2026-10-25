import { test } from "node:test";
import assert from "node:assert/strict";
import { DashboardService } from "./dashboard.service.js";
import type { DashboardRepository } from "./dashboard.repository.js";

test("import refresh rebuilds every target company/year and propagates failures for retry", async () => {
  const calls: unknown[][] = [];
  let fail = false;
  const repository = {
    contexts: async (database: string) => {
      assert.equal(database, "target_only");
      return [
        { company_id: 2, financial_year_id: 4 },
        { company_id: 3, financial_year_id: 5 }
      ];
    },
    rebuild: async (...args: unknown[]) => {
      if (fail) throw new Error("projection unavailable");
      calls.push(args);
    }
  } as unknown as DashboardRepository;
  const service = new DashboardService(repository);
  assert.equal(await service.rebuildAll("target_only", "billing.dashboard.data-bridge-import"), 2);
  assert.deepEqual(calls, [
    ["target_only", 2, 4, "billing.dashboard.data-bridge-import"],
    ["target_only", 3, 5, "billing.dashboard.data-bridge-import"]
  ]);
  fail = true;
  await assert.rejects(service.rebuildAll("target_only"), /projection unavailable/);
});
