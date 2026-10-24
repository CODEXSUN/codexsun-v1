import type { WorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import { Eye, Printer, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import {
  WorkspaceTableEmptyState,
  WorkspaceTableLoadingState,
  WorkspaceTablePanel
} from "@codexsun/ui/workspace/table";
import { cn } from "@codexsun/ui/lib/utils";
import {
  BillingDocumentTotalsTable,
  type BillingDocumentReportRecord,
  type BillingDocumentTotalsViewMode
} from "../../shared/document/document-totals-report";
import { formatDate, formatMoney, totalPurchaseQuantity } from "./purchase.services";
import type { Purchase } from "./purchase.types";

const columnIds: Record<string, string> = {
  Purchase: "number",
  Date: "issuedOn",
  Supplier: "supplier",
  QTY: "items",
  Taxable: "taxable",
  GST: "gst",
  Total: "total",
  Status: "status",
  Action: "action"
};

export function PurchaseList({
  listTools,
  canEditEntries,
  canEditFinalizedEntries,
  canAdminRevoke,
  entries,
  loading,
  onEdit,
  onForceDelete,
  onPrint,
  onRevoke,
  onSetStatus,
  onView,
  page: _page,
  pageSelected,
  pageSelectableCount,
  rowsPerPage: _rowsPerPage,
  selectedPurchaseIds,
  onTogglePageSelection,
  onToggleSelection,
  totalsRecords,
  totalsView,
  visibleColumns
}: {
  listTools: WorkspaceListTools;
  canEditEntries: boolean;
  canEditFinalizedEntries: boolean;
  canAdminRevoke: boolean;
  entries: Purchase[];
  loading: boolean;
  onEdit: (purchase: Purchase) => void;
  onForceDelete: (purchase: Purchase) => void;
  onPrint: (purchase: Purchase) => void;
  onRevoke: (purchase: Purchase) => void;
  onSetStatus: (purchase: Purchase, status: "cancelled" | "confirmed") => void;
  onView: (purchase: Purchase) => void;
  page: number;
  pageSelected: boolean;
  pageSelectableCount: number;
  rowsPerPage: number;
  selectedPurchaseIds: Set<string>;
  onTogglePageSelection: (checked: boolean) => void;
  onToggleSelection: (purchase: Purchase, checked: boolean) => void;
  totalsRecords: BillingDocumentReportRecord[];
  totalsView: BillingDocumentTotalsViewMode;
  visibleColumns: Record<string, boolean>;
}) {
  return (
    <WorkspaceTablePanel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          {totalsView === "bill" ? (
            <>
              <thead className="bg-muted/50">
                <tr>
                  <th className="w-12 border-b border-border/70 px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <input
                      aria-label="Select purchases on this page"
                      checked={pageSelected}
                      className="size-4 accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={pageSelectableCount === 0}
                      onChange={(event) => onTogglePageSelection(event.target.checked)}
                      type="checkbox"
                    />
                  </th>
                  {[
                    "Purchase",
                    ...(visibleColumns.issuedOn ? ["Date"] : []),
                    ...(visibleColumns.supplier ? ["Supplier"] : []),
                    ...(visibleColumns.items ? ["QTY"] : []),
                    ...(visibleColumns.taxable ? ["Taxable"] : []),
                    ...(visibleColumns.gst ? ["GST"] : []),
                    ...(visibleColumns.total ? ["Total"] : []),
                    ...(visibleColumns.status ? ["Status"] : []),
                    ...(visibleColumns.invoice ? ["Invoice"] : []),
                    "Print",
                    ...(visibleColumns.action ? ["Action"] : [])
                  ].map((heading) => (
                    <th
                      key={heading}
                      className={cn(
                        "border-b border-border/70 px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                        ["QTY", "Taxable", "GST", "Total"].includes(heading)
                          ? "text-right"
                          : heading === "Print"
                            ? "text-center"
                            : "text-left"
                      )}
                    >
                      {heading}
                      {listTools.showFilters ? (
                        <div className="mt-2 font-normal normal-case tracking-normal">
                          {listTools.filterRow(columnIds[heading] ?? "")}
                        </div>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((purchase, _index) => (
                  <tr
                    key={purchase.id}
                    aria-label={`View purchase ${purchase.invoiceNumber}`}
                    className="cursor-pointer border-b border-border/70 last:border-b-0 [&>td]:transition-colors hover:[&>td]:bg-muted/60 focus-visible:[&>td]:bg-muted/60 focus-visible:outline-none"
                    onClick={(event) => {
                      if (!event.currentTarget.contains(event.target as Node)) return;
                      if ((event.target as Element).closest("button, input, a")) return;
                      onView(purchase);
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onView(purchase);
                      }
                    }}
                    tabIndex={0}
                  >
                    <td className="px-4 py-2.5 text-center">
                      <input
                        aria-label={`Select ${purchase.invoiceNumber}`}
                        checked={selectedPurchaseIds.has(purchase.id)}
                        className="size-4 accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={!canSelectPurchase(purchase)}
                        onChange={(event) => onToggleSelection(purchase, event.target.checked)}
                        title={
                          purchase.generatedSalesInvoiceNo
                            ? `Already invoiced by ${purchase.generatedSalesInvoiceNo}`
                            : undefined
                        }
                        type="checkbox"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-foreground">
                      {purchase.invoiceNumber}
                    </td>
                    {visibleColumns.issuedOn ? (
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {formatDate(purchase.issuedOn)}
                      </td>
                    ) : null}
                    {visibleColumns.supplier ? (
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{purchase.supplierName}</span>
                      </td>
                    ) : null}
                    {visibleColumns.items ? (
                      <td className="px-4 py-2.5 text-right">{totalPurchaseQuantity(purchase)}</td>
                    ) : null}
                    {visibleColumns.taxable ? (
                      <td className="px-4 py-2.5 text-right">{formatMoney(purchase.subtotal)}</td>
                    ) : null}
                    {visibleColumns.gst ? (
                      <td className="px-4 py-2.5 text-right">{formatMoney(purchase.taxAmount)}</td>
                    ) : null}
                    {visibleColumns.total ? (
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {formatMoney(purchase.amount)}
                      </td>
                    ) : null}
                    {visibleColumns.status ? (
                      <td className="px-4 py-2.5">
                        <StatusPill purchase={purchase} />
                      </td>
                    ) : null}
                    {visibleColumns.invoice ? (
                      <td className="px-4 py-2.5 font-semibold text-sky-700">
                        {purchase.generatedSalesInvoiceNo || "-"}
                      </td>
                    ) : null}
                    <td className="px-4 py-2.5 text-center">
                      <Button
                        aria-label={`Print ${purchase.invoiceNumber}`}
                        className="size-8"
                        onClick={() => onPrint(purchase)}
                        size="icon"
                        title={`Print ${purchase.invoiceNumber}`}
                        type="button"
                        variant="outline"
                      >
                        <Printer className="size-4" />
                      </Button>
                    </td>
                    {visibleColumns.action ? (
                      <td className="px-4 py-2.5">
                        <WorkspaceRowActions
                          actions={[
                            ...(canEditFinalizedEntries && purchase.status === "draft"
                              ? [
                                  {
                                    id: "confirm",
                                    label: "Confirm",
                                    icon: <Eye className="size-4" />,
                                    onSelect: () => onSetStatus(purchase, "confirmed")
                                  }
                                ]
                              : []),
                            ...(canAdminRevoke &&
                            purchase.status === "confirmed" &&
                            !purchase.generatedSalesInvoiceNo
                              ? [
                                  {
                                    id: "revoke",
                                    label: "Revoke by admin",
                                    icon: <RotateCcw className="size-4" />,
                                    onSelect: () => onRevoke(purchase)
                                  }
                                ]
                              : []),
                            ...(canEditFinalizedEntries &&
                            purchase.status !== "cancelled" &&
                            !purchase.generatedSalesInvoiceNo
                              ? [
                                  {
                                    id: "suspend",
                                    label: "Suspend",
                                    icon: <Trash2 className="size-4" />,
                                    tone: "destructive" as const,
                                    onSelect: () => onSetStatus(purchase, "cancelled")
                                  }
                                ]
                              : []),
                            ...(canEditFinalizedEntries && purchase.status === "draft"
                              ? [
                                  {
                                    id: "force-delete",
                                    label: "Force delete",
                                    icon: <Trash2 className="size-4" />,
                                    tone: "destructive" as const,
                                    onSelect: () => onForceDelete(purchase)
                                  }
                                ]
                              : [])
                          ]}
                          {...(canEditEntries &&
                          (purchase.status === "draft" || canEditFinalizedEntries)
                            ? { onEdit: () => onEdit(purchase) }
                            : {})}
                          onView={() => onView(purchase)}
                          title={purchase.invoiceNumber}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </>
          ) : (
            <BillingDocumentTotalsTable records={totalsRecords} totalsView={totalsView} />
          )}
        </table>
      </div>
      {entries.length === 0 && loading ? <WorkspaceTableLoadingState /> : null}
      {entries.length === 0 && !loading ? (
        <WorkspaceTableEmptyState>No purchases found.</WorkspaceTableEmptyState>
      ) : null}
    </WorkspaceTablePanel>
  );
}

function StatusPill({ purchase, status }: { purchase?: Purchase; status?: Purchase["status"] }) {
  const label = purchase?.generatedSalesInvoiceNo
    ? "invoiced"
    : (status ?? purchase?.status ?? "draft");
  const tone =
    label === "invoiced"
      ? "info"
      : label === "confirmed"
        ? "success"
        : label === "cancelled"
          ? "danger"
          : "warning";
  return <WorkspaceStatusBadge label={label} tone={tone} />;
}

export function canSelectPurchase(purchase: Purchase) {
  return purchase.status !== "cancelled" && !purchase.generatedSalesInvoiceNo;
}
