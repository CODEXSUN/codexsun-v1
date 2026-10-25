import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { registerHooks } from "node:module";

const cssModules = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css"))
      return { format: "module", source: "export default {};", shortCircuit: true };
    return nextLoad(url, context);
  }
});
const { DutyAssignmentList } = await import("../duty-assignment/duty-assignment.list");
const { DutyReportList } = await import("../duty-report/duty-report.list");

cssModules.deregister();
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
test("tenant-scoped switch hides complete sync columns and does not reuse another tenant's enabled state", () => {
  const originalReact = Object.getOwnPropertyDescriptor(globalThis, "React");
  Object.defineProperty(globalThis, "React", { configurable: true, value: React });
  let tenant = "enabled-tenant";
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => (key === "codexsun_tenant_id" ? tenant : `${tenant}_db`)
    }
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["crm", "frappe-sync-capabilities", tenant, `${tenant}_db`], {
    enabled: true
  });
  client.setQueryData(
    ["crm", "frappe-sync-capabilities", "disabled-tenant", "disabled-tenant_db"],
    { enabled: false }
  );
  const render = () =>
    renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <DutyAssignmentList
          items={[]}
          loading={false}
          onOpen={() => {}}
          onVerify={async () => null}
        />
        <DutyReportList items={[]} loading={false} onOpen={() => {}} onVerify={async () => null} />
      </QueryClientProvider>
    );
  try {
    assert.match(render(), /Frappe sync/);
    tenant = "disabled-tenant";
    assert.doesNotMatch(render(), /Frappe sync|Verify with Frappe/);
    tenant = "unknown-tenant";
    assert.doesNotMatch(render(), /Frappe sync|Verify with Frappe/);
    tenant = "enabled-tenant";
    assert.match(render(), /Frappe sync/);
    client
      .getQueryCache()
      .find({ queryKey: ["crm", "frappe-sync-capabilities", tenant, `${tenant}_db`] })
      ?.setState({ status: "error", error: new Error("Capability request failed") });
    assert.doesNotMatch(render(), /Frappe sync|Verify with Frappe/);
  } finally {
    client.clear();
    if (originalReact) Object.defineProperty(globalThis, "React", originalReact);
    else Reflect.deleteProperty(globalThis, "React");
    if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});
