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
import { formatDate, formatMoney, totalExportSaleQuantity } from "./export-sales.services";
import type { ExportSale } from "./export-sales.types";

const columnIds: Record<string, string> = {
  "Export Sale": "number",
  Date: "date",
  Customer: "customer",
  QTY: "items",
  Taxable: "taxable",
  GST: "gst",
  Total: "total",
  Status: "status",
  Action: "action"
};

export function ExportSalesList({
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
  selectedExportSaleIds,
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
  entries: ExportSale[];
  loading: boolean;
  onEdit: (exportSale: ExportSale) => void;
  onForceDelete: (exportSale: ExportSale) => void;
  onPrint: (exportSale: ExportSale) => void;
  onRevoke: (exportSale: ExportSale) => void;
  onSetStatus: (exportSale: ExportSale, status: "cancelled" | "confirmed") => void;
  onView: (exportSale: ExportSale) => void;
  page: number;
  pageSelected: boolean;
  pageSelectableCount: number;
  rowsPerPage: number;
  selectedExportSaleIds: Set<string>;
  onTogglePageSelection: (checked: boolean) => void;
  onToggleSelection: (exportSale: ExportSale, checked: boolean) => void;
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
                      aria-label="Select export sales on this page"
                      checked={pageSelected}
                      className="size-4 accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={pageSelectableCount === 0}
                      onChange={(event) => onTogglePageSelection(event.target.checked)}
                      type="checkbox"
                    />
                  </th>
                  {[
                    "Export Sale",
                    ...(visibleColumns.date ? ["Date"] : []),
                    ...(visibleColumns.customer ? ["Customer"] : []),
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
                {entries.map((exportSale) => (
                  <tr
                    key={exportSale.id}
                    aria-label={`View export sale ${exportSale.invoiceNumber}`}
                    className="cursor-pointer border-b border-border/70 last:border-b-0 [&>td]:transition-colors hover:[&>td]:bg-muted/60 focus-visible:[&>td]:bg-muted/60 focus-visible:outline-none"
                    onClick={(event) => {
                      if (!event.currentTarget.contains(event.target as Node)) return;
                      if ((event.target as Element).closest("button, input, a")) return;
                      onView(exportSale);
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onView(exportSale);
                      }
                    }}
                    tabIndex={0}
                  >
                    <td className="px-4 py-2.5 text-center">
                      <input
                        aria-label={`Select ${exportSale.invoiceNumber}`}
                        checked={selectedExportSaleIds.has(exportSale.id)}
                        className="size-4 accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={!canSelectExportSale(exportSale)}
                        onChange={(event) => onToggleSelection(exportSale, event.target.checked)}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-foreground">
                      {exportSale.invoiceNumber}
                    </td>
                    {visibleColumns.date ? (
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {formatDate(exportSale.issuedOn)}
                      </td>
                    ) : null}
                    {visibleColumns.customer ? (
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{exportSale.customerName}</span>
                      </td>
                    ) : null}
                    {visibleColumns.items ? (
                      <td className="px-4 py-2.5 text-right">
                        {totalExportSaleQuantity(exportSale)}
                      </td>
                    ) : null}
                    {visibleColumns.taxable ? (
                      <td className="px-4 py-2.5 text-right">{formatMoney(exportSale.subtotal)}</td>
                    ) : null}
                    {visibleColumns.gst ? (
                      <td className="px-4 py-2.5 text-right">
                        {formatMoney(exportSale.taxAmount)}
                      </td>
                    ) : null}
                    {visibleColumns.total ? (
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {formatMoney(exportSale.amount)}
                      </td>
                    ) : null}
                    {visibleColumns.status ? (
                      <td className="px-4 py-2.5">
                        <StatusPill exportSale={exportSale} />
                      </td>
                    ) : null}
                    {visibleColumns.invoice ? (
                      <td className="px-4 py-2.5 font-semibold text-sky-700">
                        {exportSale.invoiceNumber}
                      </td>
                    ) : null}
                    <td className="px-4 py-2.5 text-center">
                      <Button
                        aria-label={`Print ${exportSale.invoiceNumber}`}
                        className="size-8"
                        onClick={() => onPrint(exportSale)}
                        size="icon"
                        title={`Print ${exportSale.invoiceNumber}`}
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
                            ...(canEditFinalizedEntries && exportSale.status === "draft"
                              ? [
                                  {
                                    id: "confirm",
                                    label: "Confirm",
                                    icon: <Eye className="size-4" />,
                                    onSelect: () => onSetStatus(exportSale, "confirmed")
                                  }
                                ]
                              : []),
                            ...(canAdminRevoke && exportSale.status === "confirmed"
                              ? [
                                  {
                                    id: "revoke",
                                    label: "Revoke by admin",
                                    icon: <RotateCcw className="size-4" />,
                                    onSelect: () => onRevoke(exportSale)
                                  }
                                ]
                              : []),
                            ...(canEditFinalizedEntries && exportSale.status !== "cancelled"
                              ? [
                                  {
                                    id: "suspend",
                                    label: "Suspend",
                                    icon: <Trash2 className="size-4" />,
                                    tone: "destructive" as const,
                                    onSelect: () => onSetStatus(exportSale, "cancelled")
                                  }
                                ]
                              : []),
                            ...(canEditFinalizedEntries && exportSale.status === "draft"
                              ? [
                                  {
                                    id: "force-delete",
                                    label: "Force delete",
                                    icon: <Trash2 className="size-4" />,
                                    tone: "destructive" as const,
                                    onSelect: () => onForceDelete(exportSale)
                                  }
                                ]
                              : [])
                          ]}
                          {...(canEditEntries &&
                          (exportSale.status === "draft" || canEditFinalizedEntries)
                            ? { onEdit: () => onEdit(exportSale) }
                            : {})}
                          onView={() => onView(exportSale)}
                          title={exportSale.invoiceNumber}
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
        <WorkspaceTableEmptyState>No export sales found.</WorkspaceTableEmptyState>
      ) : null}
    </WorkspaceTablePanel>
  );
}

function StatusPill({
  exportSale,
  status
}: {
  exportSale?: ExportSale;
  status?: ExportSale["status"];
}) {
  const label = status ?? exportSale?.status ?? "draft";
  const tone = label === "confirmed" ? "success" : label === "cancelled" ? "danger" : "warning";
  return <WorkspaceStatusBadge label={label} tone={tone} />;
}

export function canSelectExportSale(exportSale: ExportSale) {
  return exportSale.status !== "cancelled";
}
