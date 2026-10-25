import type { WorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import {
  WorkspaceTableEmptyState,
  WorkspaceTableLoadingState,
  WorkspaceTablePanel
} from "@codexsun/ui/workspace/table";
import { formatSupplierSummaryMoney } from "./supplier-summary.services";
import type { SupplierSummaryItem } from "./supplier-summary.types";

export function SupplierSummaryList({
  entries,
  loading,
  tools
}: {
  entries: SupplierSummaryItem[];
  loading: boolean;
  tools: WorkspaceListTools;
}) {
  return (
    <WorkspaceTablePanel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead className="bg-muted/50">
            <tr>
              {[
                { label: "Supplier", align: "text-left" },
                { label: "Code", align: "text-left" },
                { label: "Debit", align: "text-right" },
                { label: "Credit", align: "text-right" },
                { label: "Balance", align: "text-right" }
              ].map((heading) => (
                <th
                  hidden={tools.hidden.includes(heading.label)}
                  className={`border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${heading.align}`}
                  key={heading.label}
                >
                  {heading.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tools.showFilters && (
              <tr className="border-b border-border/70 bg-white">
                {["Supplier", "Code", "Debit", "Credit", "Balance"]
                  .filter((label) => !tools.hidden.includes(label))
                  .map((label) => (
                    <td className="px-4 py-2.5 text-foreground" key={label}>
                      {tools.filterRow(label)}
                    </td>
                  ))}
              </tr>
            )}
            {entries.map((entry) => (
              <tr
                className="border-b border-border/70 last:border-b-0 hover:bg-muted/20"
                key={entry.id}
              >
                <td hidden={tools.hidden.includes("Supplier")} className="px-4 py-3 font-semibold">
                  {entry.name}
                </td>
                <td
                  hidden={tools.hidden.includes("Code")}
                  className="px-4 py-3 text-muted-foreground"
                >
                  {entry.code || "-"}
                </td>
                <td hidden={tools.hidden.includes("Debit")} className="px-4 py-3 text-right">
                  {formatSupplierSummaryMoney(entry.debit)}
                </td>
                <td hidden={tools.hidden.includes("Credit")} className="px-4 py-3 text-right">
                  {formatSupplierSummaryMoney(entry.credit)}
                </td>
                <td
                  hidden={tools.hidden.includes("Balance")}
                  className="px-4 py-3 text-right font-semibold text-primary"
                >
                  {formatSupplierSummaryMoney(entry.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!entries.length && loading ? <WorkspaceTableLoadingState /> : null}
      {!entries.length && !loading ? (
        <WorkspaceTableEmptyState>No supplier outstanding balances found.</WorkspaceTableEmptyState>
      ) : null}
    </WorkspaceTablePanel>
  );
}
