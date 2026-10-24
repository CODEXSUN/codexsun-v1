import { BusinessUsers } from "./business-import.users.js";
import { useState } from "react";
import { Button } from "@codexsun/ui/components/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@codexsun/ui/components/tabs";
import { formatDateTime } from "@codexsun/ui/workspace/utils";
import { useBusinessRun } from "./business-import.hooks.js";
import { BusinessStatus } from "./business-import.presentation.js";
import { BusinessRows } from "./business-import.rows.js";
import { BusinessInvoices } from "./business-import.invoices.js";
import { BusinessWarnings } from "./business-import.warnings.js";
import type { BusinessTable, InvoiceSelection } from "./business-import.types.js";
export function BusinessReportWorkspace({ id }: { id: string }) {
  const { run, error, refresh } = useBusinessRun(id);
  const [tab, setTab] = useState("summary"),
    [selected, setSelected] = useState<{ table: BusinessTable; invoice?: InvoiceSelection } | null>(
      null
    );
  function inspect(table: string, invoice?: InvoiceSelection) {
    const entry = run?.tables.find((t) => t.table === table);
    if (entry) {
      setTab(entry.group);
      setSelected({ table: entry, ...(invoice ? { invoice } : {}) });
    }
  }
  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
        <Button variant="outline" className="ml-3" onClick={refresh}>
          Retry
        </Button>
      </p>
    );
  if (!run)
    return (
      <p role="status" className="text-sm">
        Loading business import report…
      </p>
    );
  const totals = run.tables.reduce(
    (sum, t) => ({
      source: sum.source + t.sourceRows,
      imported: sum.imported + t.imported,
      updated: sum.updated + (t.updated ?? 0),
      existing: sum.existing + t.existing,
      warnings: sum.warnings + t.warnings
    }),
    { source: 0, imported: 0, updated: 0, existing: 0, warnings: 0 }
  );
  const complete = run.tables.filter((t) => !["pending", "running"].includes(t.status)).length;
  return (
    <section aria-label="Ordered business import report">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">
            {run.sourceDatabase} → {run.targetDatabase}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateTime(run.updatedAt)} · {complete}/{run.tables.length} tables · {run.phase}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BusinessStatus status={run.status} />
          <Button variant="outline" onClick={refresh}>
            Refresh report
          </Button>
        </div>
      </div>
      <p role="status" className="mb-4 text-sm">
        {run.message}
      </p>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          setSelected(null);
        }}
      >
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          {[
            ["summary", "Summary"],
            ["common", "Common"],
            ["masters", "Masters"],
            ["billing", "Billing"],
            ["invoices", "Invoices"],
            ["users", "Users"],
            ["warnings", "Warnings"]
          ].map(([key, label]) => (
            <TabsTrigger value={key!} key={key}>
              {label}
              {key === "warnings" && run.status === "warning" ? " · Needs attention" : ""}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="users">
          <BusinessUsers report={run.users} />
        </TabsContent>
        <TabsContent value="summary">
          <h3 className="mb-3 font-semibold">Run summary</h3>
          <table className="w-full text-left text-sm">
            <tbody>
              {[
                ["Source records", totals.source],
                ["Imported", totals.imported],
                ["Seed records updated in place", totals.updated],
                ["Existing preserved", totals.existing],
                ["Warnings", totals.warnings + (run.users?.warnings ?? 0)],
                ["Invoices matched", `${run.invoiceMatched}/${run.invoiceCount}`],
                ["Invoice warnings", run.invoiceWarnings],
                ["Relationships checked", run.relationships],
                ["Broken relationships", run.orphans]
              ].map(([label, value]) => (
                <tr className="border-b" key={label}>
                  <th className="w-64 p-3 font-medium">{label}</th>
                  <td className="p-3">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-sm text-muted-foreground">
            Commits run per table. Complete invoice headers and business children are verified after
            import. Existing conflicts and extra target data are preserved.
          </p>
        </TabsContent>
        {(["common", "masters", "billing"] as const).map((group) => (
          <TabsContent value={group} key={group}>
            {selected && selected.table.group === group ? (
              <BusinessRows
                key={`${selected.table.table}-${selected.invoice?.sourceId ?? "all"}`}
                runId={id}
                table={selected.table}
                updatedAt={run.updatedAt}
                {...(selected.invoice ? { invoice: selected.invoice } : {})}
                onBack={() => setSelected(null)}
              />
            ) : (
              <>
                <h3 className="mb-3 font-semibold">
                  {group === "common"
                    ? "Common tables"
                    : group === "masters"
                      ? "Master tables"
                      : "Billing tables"}
                </h3>
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        {[
                          "Source → target table",
                          "Source",
                          "Target",
                          "Imported",
                          "Updated",
                          "Existing",
                          "Warnings",
                          "Result",
                          "Action"
                        ].map((label) => (
                          <th className="p-3" key={label}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {run.tables
                        .filter((t) => t.group === group)
                        .map((table) => (
                          <tr className="border-b" key={table.table}>
                            <td className="p-3">
                              {table.sourceTable === table.table
                                ? table.table
                                : `${table.sourceTable} → ${table.table}`}
                              {table.message ? (
                                <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                                  {table.message}
                                </p>
                              ) : null}
                            </td>
                            <td className="p-3">{table.sourceRows}</td>
                            <td className="p-3">{table.targetRows}</td>
                            <td className="p-3">{table.imported}</td>
                            <td className="p-3">{table.updated ?? 0}</td>
                            <td className="p-3">{table.existing}</td>
                            <td className="p-3">{table.warnings}</td>
                            <td className="p-3">
                              <BusinessStatus status={table.status} />
                            </td>
                            <td className="p-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelected({ table })}
                              >
                                View rows
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {!run.tables.length ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    Discovering eligible business tables…
                  </p>
                ) : null}
              </>
            )}
          </TabsContent>
        ))}
        <TabsContent value="invoices">
          <BusinessInvoices runId={id} updatedAt={run.updatedAt} onInspect={inspect} />
        </TabsContent>
        <TabsContent value="warnings">
          <BusinessWarnings
            runId={id}
            updatedAt={run.updatedAt}
            onInspect={(table) => inspect(table)}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
