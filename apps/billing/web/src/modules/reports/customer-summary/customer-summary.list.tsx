import type { WorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import {
  WorkspaceTableEmptyState,
  WorkspaceTableLoadingState,
  WorkspaceTablePanel
} from "@codexsun/ui/workspace/table";
import { formatCustomerSummaryMoney } from "./customer-summary.services";
import type { CustomerSummaryItem } from "./customer-summary.types";

export function CustomerSummaryList({
  entries,
  loading,
  tools
}: {
  entries: CustomerSummaryItem[];
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
                { label: "Customer", align: "text-left" },
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
                {["Customer", "Code", "Debit", "Credit", "Balance"]
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
                <td hidden={tools.hidden.includes("Customer")} className="px-4 py-3 font-semibold">
                  {entry.name}
                </td>
                <td
                  hidden={tools.hidden.includes("Code")}
                  className="px-4 py-3 text-muted-foreground"
                >
                  {entry.code || "-"}
                </td>
                <td hidden={tools.hidden.includes("Debit")} className="px-4 py-3 text-right">
                  {formatCustomerSummaryMoney(entry.debit)}
                </td>
                <td hidden={tools.hidden.includes("Credit")} className="px-4 py-3 text-right">
                  {formatCustomerSummaryMoney(entry.credit)}
                </td>
                <td
                  hidden={tools.hidden.includes("Balance")}
                  className="px-4 py-3 text-right font-semibold text-primary"
                >
                  {formatCustomerSummaryMoney(entry.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!entries.length && loading ? <WorkspaceTableLoadingState /> : null}
      {!entries.length && !loading ? (
        <WorkspaceTableEmptyState>No customer outstanding balances found.</WorkspaceTableEmptyState>
      ) : null}
    </WorkspaceTablePanel>
  );
}
