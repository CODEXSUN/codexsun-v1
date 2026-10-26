import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { registerHooks } from "node:module";

const originalReact = Object.getOwnPropertyDescriptor(globalThis, "React");
Object.defineProperty(globalThis, "React", { configurable: true, value: React });
const cssModules = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css"))
      return { format: "module", source: "export default {};", shortCircuit: true };
    return nextLoad(url, context);
  }
});
const { DutyAssignmentList } = await import("./modules/duty-assignment/duty-assignment.list");
const { DutyReportList } = await import("./modules/duty-report/duty-report.list");
const { EnquiryList } = await import("./modules/enquiry/enquiry.list");
const { CrmContactList } = await import("./modules/contact/contact.list");
const { CallLogList } = await import("./modules/call-log/call-log.list");
const { TaskList } = await import("./modules/task/task.list");
cssModules.deregister();

test("CRM lists render without integration state or a query provider", () => {
  try {
    const markup = renderToStaticMarkup(
      <>
        <DutyAssignmentList items={[]} loading={false} onOpen={() => {}} />
        <DutyReportList items={[]} loading={false} onOpen={() => {}} />
        <EnquiryList
          records={[]}
          users={[]}
          loading={false}
          userColumnMode="both"
          visibleColumns={{ frappeSync: true }}
          showInlineFilters={false}
          columnFilters={{}}
          onColumnFilterChange={() => {}}
          onHideInlineFilters={() => {}}
          onShow={() => {}}
          openingCallId={null}
        />
        <CrmContactList
          records={[]}
          loading={false}
          visibleColumns={{ frappeSync: true }}
          showInlineFilters={false}
          columnFilters={{}}
          onColumnFilterChange={() => {}}
          onHideInlineFilters={() => {}}
          onEdit={() => {}}
          onForceDelete={() => {}}
          onToggle={() => {}}
        />
        <CallLogList records={[]} loading={false} visibleColumns={{ frappeSync: true }} />
        <TaskList
          items={[]}
          loading={false}
          visibleColumns={{ frappeSync: true }}
          canEdit={false}
          onOpen={() => {}}
          onEdit={() => {}}
          showInlineFilters={false}
          columnFilters={{}}
          onColumnFilterChange={() => {}}
          onHideInlineFilters={() => {}}
        />
      </>
    );
    assert.match(markup, /No duties found/);
    assert.match(markup, /No duty reports found/);
    assert.doesNotMatch(markup, /Frappe sync|Verify with Frappe/);
  } finally {
    if (originalReact) Object.defineProperty(globalThis, "React", originalReact);
    else Reflect.deleteProperty(globalThis, "React");
  }
});
