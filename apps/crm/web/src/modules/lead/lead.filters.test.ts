import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLeadFilters } from "./lead.filters.js";

test("Lead date range includes the selected final local day and combines column filters", () => {
  const filters = buildLeadFilters(
    { search: "prospect", status: "active", page: 1, pageSize: 20 },
    { fromDate: "2026-10-20", toDate: "2026-10-26" },
    { name: "Alice", phone: "987", message: "service", campaignLabel: "October", status: "review" }
  );
  assert.equal(filters.fromAt, new Date("2026-10-20T00:00:00").toISOString());
  assert.equal(filters.toAt, new Date("2026-10-27T00:00:00").toISOString());
  assert.equal(filters.searchName, "Alice");
  assert.equal(filters.searchCampaign, "October");
  assert.equal(filters.searchPhone, "987");
  assert.equal(filters.searchMessage, "service");
  assert.equal(filters.searchStatus, "review");
  assert.equal(filters.status, "active");
  const cleared = buildLeadFilters(
    { search: "", status: "all", page: 1, pageSize: 20 },
    { fromDate: "", toDate: "" },
    {}
  );
  assert.equal(cleared.fromAt, undefined);
  assert.equal(cleared.toAt, undefined);
});
