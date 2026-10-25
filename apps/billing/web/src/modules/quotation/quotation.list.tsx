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
import { formatDate, formatMoney, totalQuotationQuantity } from "./quotation.services";
import type { Quotation } from "./quotation.types";

const columnIds: Record<string, string> = {
  Quotation: "number",
  Date: "date",
  Customer: "customer",
  QTY: "items",
  Taxable: "taxable",
  GST: "gst",
  Total: "total",
  Status: "status",
  Action: "action"
};

export function QuotationList({
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
  selectedQuotationIds,
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
  entries: Quotation[];
  loading: boolean;
  onEdit: (quotation: Quotation) => void;
  onForceDelete: (quotation: Quotation) => void;
  onPrint: (quotation: Quotation) => void;
  onRevoke: (quotation: Quotation) => void;
  onSetStatus: (quotation: Quotation, status: "cancelled" | "confirmed") => void;
  onView: (quotation: Quotation) => void;
  page: number;
  pageSelected: boolean;
  pageSelectableCount: number;
  rowsPerPage: number;
  selectedQuotationIds: Set<string>;
  onTogglePageSelection: (checked: boolean) => void;
  onToggleSelection: (quotation: Quotation, checked: boolean) => void;
  totalsRecords: BillingDocumentReportRecord[];
  totalsView: BillingDocumentTotalsViewMode;
  visibleColumns: Record<string, boolean>;
}) {
  const headings = [
    "Quotation",
    "Date",
    ...(visibleColumns.customer ? ["Customer"] : []),
    ...(visibleColumns.items ? ["QTY"] : []),
    ...(visibleColumns.taxable ? ["Taxable"] : []),
    ...(visibleColumns.gst ? ["GST"] : []),
    ...(visibleColumns.total ? ["Total"] : []),
    ...(visibleColumns.status ? ["Status"] : []),
    ...(visibleColumns.invoice ? ["Invoice"] : []),
    "Print",
    ...(visibleColumns.action ? ["Action"] : [])
  ];

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
                      aria-label="Select quotations on this page"
                      checked={pageSelected}
                      className="size-4 accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={pageSelectableCount === 0}
                      onChange={(event) => onTogglePageSelection(event.target.checked)}
                      type="checkbox"
                    />
                  </th>
                  {headings.map((heading) => (
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
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listTools.showFilters ? (
                  <tr className="border-b border-border/70 bg-white">
                    <td className="px-4 py-2.5" />
                    {headings.map((heading) => (
                      <td key={heading} className="px-4 py-2.5 text-foreground">
                        {heading === "Action" || heading === "Print"
                          ? null
                          : listTools.filterRow(columnIds[heading] ?? "")}
                      </td>
                    ))}
                  </tr>
                ) : null}
                {entries.map((quotation, _index) => (
                  <tr
                    key={quotation.id}
                    aria-label={`View quotation ${quotation.quotationNumber}`}
                    className="cursor-pointer border-b border-border/70 last:border-b-0 [&>td]:transition-colors hover:[&>td]:bg-muted/60 focus-visible:[&>td]:bg-muted/60 focus-visible:outline-none"
                    onClick={(event) => {
                      if (!event.currentTarget.contains(event.target as Node)) return;
                      if ((event.target as Element).closest("button, input, a")) return;
                      onView(quotation);
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onView(quotation);
                      }
                    }}
                    tabIndex={0}
                  >
                    <td className="px-4 py-2.5 text-center">
                      <input
                        aria-label={`Select ${quotation.quotationNumber}`}
                        checked={selectedQuotationIds.has(quotation.id)}
                        className="size-4 accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={!canSelectQuotation(quotation)}
                        onChange={(event) => onToggleSelection(quotation, event.target.checked)}
                        title={
                          quotation.generatedSalesInvoiceNo
                            ? `Already invoiced by ${quotation.generatedSalesInvoiceNo}`
                            : undefined
                        }
                        type="checkbox"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-foreground">
                      {quotation.quotationNumber}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">{formatDate(quotation.date)}</td>
                    {visibleColumns.customer ? (
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{quotation.customerName}</span>
                      </td>
                    ) : null}
                    {visibleColumns.items ? (
                      <td className="px-4 py-2.5 text-right">
                        {totalQuotationQuantity(quotation)}
                      </td>
                    ) : null}
                    {visibleColumns.taxable ? (
                      <td className="px-4 py-2.5 text-right">{formatMoney(quotation.subtotal)}</td>
                    ) : null}
                    {visibleColumns.gst ? (
                      <td className="px-4 py-2.5 text-right">{formatMoney(quotation.taxAmount)}</td>
                    ) : null}
                    {visibleColumns.total ? (
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {formatMoney(quotation.amount)}
                      </td>
                    ) : null}
                    {visibleColumns.status ? (
                      <td className="px-4 py-2.5">
                        <StatusPill quotation={quotation} />
                      </td>
                    ) : null}
                    {visibleColumns.invoice ? (
                      <td className="px-4 py-2.5 font-semibold text-sky-700">
                        {quotation.generatedSalesInvoiceNo || "-"}
                      </td>
                    ) : null}
                    <td className="px-4 py-2.5 text-center">
                      <Button
                        aria-label={`Print ${quotation.quotationNumber}`}
                        className="size-8"
                        onClick={() => onPrint(quotation)}
                        size="icon"
                        title={`Print ${quotation.quotationNumber}`}
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
                            ...(canEditFinalizedEntries && quotation.status === "draft"
                              ? [
                                  {
                                    id: "confirm",
                                    label: "Confirm",
                                    icon: <Eye className="size-4" />,
                                    onSelect: () => onSetStatus(quotation, "confirmed")
                                  }
                                ]
                              : []),
                            ...(canAdminRevoke &&
                            quotation.status === "confirmed" &&
                            !quotation.generatedSalesInvoiceNo
                              ? [
                                  {
                                    id: "revoke",
                                    label: "Revoke by admin",
                                    icon: <RotateCcw className="size-4" />,
                                    onSelect: () => onRevoke(quotation)
                                  }
                                ]
                              : []),
                            ...(canEditFinalizedEntries &&
                            quotation.status !== "cancelled" &&
                            !quotation.generatedSalesInvoiceNo
                              ? [
                                  {
                                    id: "suspend",
                                    label: "Suspend",
                                    icon: <Trash2 className="size-4" />,
                                    tone: "destructive" as const,
                                    onSelect: () => onSetStatus(quotation, "cancelled")
                                  }
                                ]
                              : []),
                            ...(canEditFinalizedEntries && quotation.status === "draft"
                              ? [
                                  {
                                    id: "force-delete",
                                    label: "Force delete",
                                    icon: <Trash2 className="size-4" />,
                                    tone: "destructive" as const,
                                    onSelect: () => onForceDelete(quotation)
                                  }
                                ]
                              : [])
                          ]}
                          {...(canEditEntries &&
                          !quotation.generatedSalesInvoiceNo &&
                          (quotation.status === "draft" || canEditFinalizedEntries)
                            ? { onEdit: () => onEdit(quotation) }
                            : {})}
                          onView={() => onView(quotation)}
                          title={quotation.quotationNumber}
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
        <WorkspaceTableEmptyState>No quotations found.</WorkspaceTableEmptyState>
      ) : null}
    </WorkspaceTablePanel>
  );
}

function StatusPill({
  quotation,
  status
}: {
  quotation?: Quotation;
  status?: Quotation["status"];
}) {
  const label = quotation?.generatedSalesInvoiceNo
    ? "invoiced"
    : (status ?? quotation?.status ?? "draft");
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

export function canSelectQuotation(quotation: Quotation) {
  return quotation.status !== "cancelled" && !quotation.generatedSalesInvoiceNo;
}
