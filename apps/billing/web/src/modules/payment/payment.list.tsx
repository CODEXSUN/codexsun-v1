import type { WorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import { Eye, Pencil, Send, Trash2, XCircle } from "lucide-react";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import {
  BillingDocumentTotalsTable,
  type BillingDocumentReportRecord,
  type BillingDocumentTotalsViewMode
} from "../../shared/document/document-totals-report";
import {
  WorkspaceTableEmptyState,
  WorkspaceTableLoadingState,
  WorkspaceTablePanel
} from "@codexsun/ui/workspace/table";
import { formatPaymentDate, formatPaymentMoney } from "./payment.services";
import type { Payment } from "./payment.types";

const columnIds: Record<string, string> = {
  "Payment no": "number",
  Date: "date",
  Supplier: "party",
  Mode: "mode",
  Amount: "total",
  Unallocated: "unallocated",
  Status: "status",
  Action: "action"
};

export function PaymentList({
  listTools,
  canEditEntries,
  canEditFinalizedEntries,
  entries,
  loading,
  onCancel,
  onDelete,
  onEdit,
  onPost,
  onView,
  totalsRecords,
  totalsView
}: {
  listTools: WorkspaceListTools;
  canEditEntries: boolean;
  canEditFinalizedEntries: boolean;
  entries: Payment[];
  loading: boolean;
  onCancel: (payment: Payment) => void;
  onDelete: (payment: Payment) => void;
  onEdit: (payment: Payment) => void;
  onPost: (payment: Payment) => void;
  onView: (payment: Payment) => void;
  totalsRecords: BillingDocumentReportRecord[];
  totalsView: BillingDocumentTotalsViewMode;
}) {
  return (
    <WorkspaceTablePanel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          {totalsView === "bill" ? (
            <>
              <thead className="bg-muted/50">
                <tr>
                  {[
                    "Payment no",
                    "Date",
                    "Supplier",
                    "Mode",
                    "Amount",
                    "Unallocated",
                    "Status",
                    "Action"
                  ]
                    .filter((label) => !listTools.hidden.includes(columnIds[label] ?? ""))
                    .map((label) => (
                      <th
                        className="border-b border-border/70 px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        key={label}
                      >
                        {label}
                        {listTools.showFilters ? (
                          <div className="mt-2 font-normal normal-case tracking-normal">
                            {listTools.filterRow(columnIds[label] ?? "")}
                          </div>
                        ) : null}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((payment) => (
                  <tr
                    aria-label={`View payment ${payment.paymentNumber}`}
                    className="cursor-pointer border-b border-border/70 last:border-0 [&>td]:transition-colors hover:[&>td]:bg-muted/60 focus-visible:[&>td]:bg-muted/60 focus-visible:outline-none"
                    key={payment.id}
                    onClick={(event) => {
                      if (!event.currentTarget.contains(event.target as Node)) return;
                      if ((event.target as Element).closest("button, input, a")) return;
                      onView(payment);
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onView(payment);
                      }
                    }}
                    tabIndex={0}
                  >
                    <td
                      hidden={listTools.hidden.includes("number")}
                      className="px-4 py-3 font-semibold"
                    >
                      {payment.paymentNumber}
                    </td>
                    <td hidden={listTools.hidden.includes("date")} className="px-4 py-3">
                      {formatPaymentDate(payment.paymentDate)}
                    </td>
                    <td hidden={listTools.hidden.includes("party")} className="px-4 py-3">
                      {payment.supplierName}
                    </td>
                    <td hidden={listTools.hidden.includes("mode")} className="px-4 py-3 capitalize">
                      {payment.paymentMode}
                    </td>
                    <td
                      hidden={listTools.hidden.includes("total")}
                      className="px-4 py-3 font-medium"
                    >
                      {formatPaymentMoney(payment.totalAmount)}
                    </td>
                    <td hidden={listTools.hidden.includes("unallocated")} className="px-4 py-3">
                      {formatPaymentMoney(payment.unallocatedAmount)}
                    </td>
                    <td hidden={listTools.hidden.includes("status")} className="px-4 py-3">
                      <PaymentStatus payment={payment} />
                    </td>
                    <td hidden={listTools.hidden.includes("action")} className="px-4 py-3">
                      <WorkspaceRowActions
                        actions={[
                          {
                            id: "view",
                            icon: <Eye className="size-4" />,
                            label: "View",
                            onSelect: () => onView(payment)
                          },
                          ...(canEditEntries &&
                          (payment.status === "draft" || canEditFinalizedEntries)
                            ? [
                                {
                                  id: "edit",
                                  icon: <Pencil className="size-4" />,
                                  label: "Edit",
                                  onSelect: () => onEdit(payment)
                                },
                                ...(canEditFinalizedEntries && payment.status === "draft"
                                  ? [
                                      {
                                        id: "post",
                                        icon: <Send className="size-4" />,
                                        label: "Post",
                                        onSelect: () => onPost(payment)
                                      },
                                      {
                                        id: "delete",
                                        icon: <Trash2 className="size-4" />,
                                        label: "Delete draft",
                                        tone: "destructive" as const,
                                        onSelect: () => onDelete(payment)
                                      }
                                    ]
                                  : [])
                              ]
                            : []),
                          ...(canEditFinalizedEntries && payment.status === "posted"
                            ? [
                                {
                                  id: "cancel",
                                  icon: <XCircle className="size-4" />,
                                  label: "Cancel",
                                  tone: "destructive" as const,
                                  onSelect: () => onCancel(payment)
                                }
                              ]
                            : [])
                        ]}
                        title={payment.paymentNumber}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          ) : (
            <BillingDocumentTotalsTable
              primaryLabel="Amount"
              records={totalsRecords}
              secondaryLabel="Allocated"
              totalsView={totalsView}
            />
          )}
        </table>
      </div>
      {!loading && !entries.length ? (
        <WorkspaceTableEmptyState>
          No payments found. Create the first payment voucher for this tenant.
        </WorkspaceTableEmptyState>
      ) : null}
      {loading ? <WorkspaceTableLoadingState /> : null}
    </WorkspaceTablePanel>
  );
}
function PaymentStatus({ payment }: { payment: Payment }) {
  const tone =
    payment.status === "posted" ? "success" : payment.status === "cancelled" ? "danger" : "warning";
  return <WorkspaceStatusBadge label={payment.status} status={payment.status} tone={tone} />;
}
