import type { WorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import {
  WorkspaceTableEmptyState,
  WorkspaceTableLoadingState,
  WorkspaceTablePanel
} from "@codexsun/ui/workspace/table";
import {
  formatSupplierStatementDate,
  formatSupplierStatementAge,
  formatSupplierStatementMoney
} from "./supplier-statement.services";
import type { SupplierStatementLine } from "./supplier-statement.types";

export function SupplierStatementList({
  entries,
  loading,
  tools
}: {
  entries: SupplierStatementLine[];
  loading: boolean;
  tools: WorkspaceListTools;
}) {
  return (
    <WorkspaceTablePanel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead className="bg-muted/50">
            <tr>
              {["Date", "Voucher", "Type", "Narration", "Debit", "Credit", "Balance", "Age"].map(
                (heading) => (
                  <th
                    hidden={tools.hidden.includes(heading)}
                    className={`border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${["Debit", "Credit", "Balance", "Age"].includes(heading) ? "text-right" : "text-left"}`}
                    key={heading}
                  >
                    {heading}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {tools.showFilters && (
              <tr className="border-b border-border/70 bg-white">
                {["Date", "Voucher", "Type", "Narration", "Debit", "Credit", "Balance", "Age"]
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
                key={`${entry.kind}-${entry.documentId}`}
              >
                <td hidden={tools.hidden.includes("Date")} className="whitespace-nowrap px-4 py-3">
                  {formatSupplierStatementDate(entry.date)}
                </td>
                <td hidden={tools.hidden.includes("Voucher")} className="px-4 py-3 font-semibold">
                  {entry.documentNumber}
                </td>
                <td hidden={tools.hidden.includes("Type")} className="px-4 py-3">
                  <WorkspaceStatusBadge
                    label={entry.kind === "payment" ? "Payment" : "Purchase"}
                    tone={entry.kind === "payment" ? "success" : "info"}
                  />
                </td>
                <td
                  hidden={tools.hidden.includes("Narration")}
                  className="px-4 py-3 text-muted-foreground"
                >
                  {entry.narration}
                </td>
                <td hidden={tools.hidden.includes("Debit")} className="px-4 py-3 text-right">
                  {entry.debit ? formatSupplierStatementMoney(entry.debit) : "-"}
                </td>
                <td hidden={tools.hidden.includes("Credit")} className="px-4 py-3 text-right">
                  {entry.credit ? formatSupplierStatementMoney(entry.credit) : "-"}
                </td>
                <td
                  hidden={tools.hidden.includes("Balance")}
                  className="px-4 py-3 text-right font-semibold"
                >
                  {formatSupplierStatementMoney(entry.balance)}
                </td>
                <td
                  hidden={tools.hidden.includes("Age")}
                  className="whitespace-nowrap px-4 py-3 text-right"
                  title="Days since bill date"
                >
                  {entry.kind === "payment" ? "—" : `${formatSupplierStatementAge(entry.date)} d`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!entries.length && loading ? <WorkspaceTableLoadingState /> : null}
      {!entries.length && !loading ? (
        <WorkspaceTableEmptyState>No supplier movements found.</WorkspaceTableEmptyState>
      ) : null}
    </WorkspaceTablePanel>
  );
}
