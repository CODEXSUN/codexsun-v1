import type { WorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import {
  WorkspaceTableEmptyState,
  WorkspaceTableLoadingState,
  WorkspaceTablePanel
} from "@codexsun/ui/workspace/table";
import { formatStockQuantity, formatStockStatementMoney } from "./stock-statement.services";
import type { StockStatementLine } from "./stock-statement.types";

export function StockStatementList({
  entries,
  loading,
  tools
}: {
  entries: StockStatementLine[];
  loading: boolean;
  tools: WorkspaceListTools;
}) {
  return (
    <WorkspaceTablePanel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] border-collapse text-sm">
          <thead className="bg-muted/50">
            <tr>
              {[
                "Product",
                "HSN",
                "Unit",
                "Opening",
                "Inward",
                "Outward",
                "Closing",
                "Purchase value",
                "Sales value"
              ].map((heading) => (
                <th
                  hidden={tools.hidden.includes(heading)}
                  className={`border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${["Opening", "Inward", "Outward", "Closing", "Purchase value", "Sales value"].includes(heading) ? "text-right" : "text-left"}`}
                  key={heading}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tools.showFilters && (
              <tr className="border-b border-border/70 bg-white">
                {[
                  "Product",
                  "HSN",
                  "Unit",
                  "Opening",
                  "Inward",
                  "Outward",
                  "Closing",
                  "Purchase value",
                  "Sales value"
                ]
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
                key={entry.productId}
              >
                <td hidden={tools.hidden.includes("Product")} className="px-4 py-3 font-semibold">
                  {entry.productName}
                </td>
                <td hidden={tools.hidden.includes("HSN")} className="px-4 py-3">
                  {entry.hsnCode || "-"}
                </td>
                <td hidden={tools.hidden.includes("Unit")} className="px-4 py-3">
                  {entry.unitName || "-"}
                </td>
                <td hidden={tools.hidden.includes("Opening")} className="px-4 py-3 text-right">
                  {formatStockQuantity(entry.openingQuantity)}
                </td>
                <td
                  hidden={tools.hidden.includes("Inward")}
                  className="px-4 py-3 text-right text-emerald-700"
                >
                  {formatStockQuantity(entry.inwardQuantity)}
                </td>
                <td
                  hidden={tools.hidden.includes("Outward")}
                  className="px-4 py-3 text-right text-rose-700"
                >
                  {formatStockQuantity(entry.outwardQuantity)}
                </td>
                <td
                  hidden={tools.hidden.includes("Closing")}
                  className="px-4 py-3 text-right font-semibold"
                >
                  {formatStockQuantity(entry.closingQuantity)}
                </td>
                <td
                  hidden={tools.hidden.includes("Purchase value")}
                  className="px-4 py-3 text-right"
                >
                  {formatStockStatementMoney(entry.purchaseValue)}
                </td>
                <td hidden={tools.hidden.includes("Sales value")} className="px-4 py-3 text-right">
                  {formatStockStatementMoney(entry.salesValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!entries.length && loading ? <WorkspaceTableLoadingState /> : null}
      {!entries.length && !loading ? (
        <WorkspaceTableEmptyState>
          No products match the statement filters.
        </WorkspaceTableEmptyState>
      ) : null}
    </WorkspaceTablePanel>
  );
}
