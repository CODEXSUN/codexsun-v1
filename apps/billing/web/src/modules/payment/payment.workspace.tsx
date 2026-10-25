import { useWorkspaceQueryValue } from "@codexsun/ui/workspace/navigation";
import { useWorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import { formatDateTime as formatWorkspaceDateTime } from "@codexsun/ui/workspace";
import { useEffect, useState, type SetStateAction } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Pencil, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { GlobalLoader } from "@codexsun/ui/components/global-loader";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspacePagination } from "@codexsun/ui/workspace/pagination";
import { WorkspaceShowCard } from "@codexsun/ui/workspace/show";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { canEditBillingEntry, useBillingAccess } from "../../shared/auth/billing-access";
import {
  BillingDocumentListControls,
  type BillingDocumentTotalsViewMode
} from "../../shared/document/document-totals-report";
import {
  usePaymentActivity,
  usePaymentContext,
  usePaymentPage,
  paymentQueryKey
} from "./payment.hooks";
import { PaymentForm } from "./payment.form";
import { PaymentList } from "./payment.list";
import { PaymentPrint } from "./payment.print";
import {
  cancelPayment,
  createPayment,
  deletePayment,
  formatPaymentMoney,
  getPayment,
  postPayment,
  updatePayment
} from "./payment.services";
import type { Payment, PaymentSavePayload, PaymentView } from "./payment.types";

const statusFilters = [
  { id: "all", label: "All payments" },
  { id: "draft", label: "Draft" },
  { id: "posted", label: "Posted" },
  { id: "cancelled", label: "Cancelled" }
];

export function PaymentWorkspace({ initialRecordId }: { initialRecordId?: string | undefined }) {
  const queryClient = useQueryClient();
  const contextQuery = usePaymentContext();
  const accessQuery = useBillingAccess();
  const canEditEntries = accessQuery.data?.canEditEntries ?? false;
  const canEditFinalizedEntries = accessQuery.data?.canEditFinalizedEntries ?? false;
  const location = useLocation();
  const navigate = useNavigate();
  const listTools = useWorkspaceListTools({
    number: "Payment no",
    date: "Date",
    party: "Supplier",
    mode: "Mode",
    total: "Amount",
    unallocated: "Unallocated",
    status: "Status",
    action: "Action"
  });
  const [view, setLocalView] = useState<PaymentView>({ mode: "list" });
  const basePath = `${location.pathname.startsWith("/app/") ? "/app" : ""}/billing/payment`;
  function setView(update: SetStateAction<PaymentView>) {
    const next = typeof update === "function" ? update(view) : update;
    setLocalView(next);
    const record = next.mode === "list" ? null : next.payment;
    const path =
      next.mode === "list"
        ? basePath
        : next.mode === "upsert" && !record
          ? `${basePath}/new`
          : `${basePath}/${encodeURIComponent(record!.id)}${next.mode === "upsert" ? "/edit" : ""}`;
    if (location.pathname !== path) void navigate({ to: path, search: location.search });
  }
  useEffect(() => {
    const tail = location.pathname.slice(basePath.length).split("/").filter(Boolean);
    if (tail.length === 0) {
      setLocalView({ mode: "list" });
      return;
    }
    if (tail[0] === "new" && tail.length === 1) {
      setLocalView({ mode: "upsert", payment: null, returnTo: "list" });
      return;
    }
    if (tail.length > 2 || (tail[1] && !["edit", "show", "print"].includes(tail[1]))) return;
    let id: string;
    try {
      id = decodeURIComponent(tail[0]!);
    } catch {
      return;
    }
    let active = true;
    void getPayment(id)
      .then((payment) => {
        if (!active) return;
        setLocalView(
          tail[1] === "edit"
            ? { mode: "upsert", payment, returnTo: "show" }
            : { mode: "show", payment }
        );
      })
      .catch((error) => {
        if (active)
          toast.error("Payment could not be opened", {
            description: error instanceof Error ? error.message : "Please try again."
          });
      });
    return () => {
      active = false;
    };
  }, [location.pathname]);
  const [search, setSearch] = useWorkspaceQueryValue("q", "");
  const [statusFilter, setStatusFilter] = useWorkspaceQueryValue("status", "all");
  const [dateFrom, setDateFrom] = useWorkspaceQueryValue("from", "");
  const [dateTo, setDateTo] = useWorkspaceQueryValue("to", "");
  const [totalsView, setTotalsView] = useState<BillingDocumentTotalsViewMode>("bill");
  const [page, setPage] = useWorkspaceQueryValue("page", 1);
  const [rowsPerPage, setRowsPerPage] = useWorkspaceQueryValue("pageSize", 20);
  const paymentsQuery = usePaymentPage({
    numberSearch: listTools.filters.number ?? "",
    dateSearch: listTools.filters.date ?? "",
    partySearch: listTools.filters.party ?? "",
    totalSearch: listTools.filters.total ?? "",
    statusSearch: listTools.filters.status ?? "",
    modeSearch: listTools.filters.mode ?? "",
    unallocatedSearch: listTools.filters.unallocated ?? "",
    dateFrom,
    dateTo,
    page,
    pageSize: rowsPerPage,
    search,
    status: statusFilter
  });
  useEffect(() => {
    if (!initialRecordId) return;
    let active = true;
    void getPayment(initialRecordId)
      .then((payment) => {
        if (active) setView({ mode: "show", payment });
      })
      .catch((error) => {
        if (active) toast.error("Payment could not be opened", { description: message(error) });
      });
    return () => {
      active = false;
    };
  }, [initialRecordId]);
  const save = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: PaymentSavePayload }) =>
      id ? updatePayment(id, payload) : createPayment(payload),
    onSuccess: async (payment) => {
      await queryClient.invalidateQueries({ queryKey: paymentQueryKey });
      toast.success("Payment saved", {
        description: payment.numberingWarning ?? payment.paymentNumber
      });
      setView({ mode: "show", payment });
    }
  });
  const lifecycle = useMutation({
    mutationFn: ({ action, id }: { action: "post" | "cancel"; id: string }) =>
      action === "post" ? postPayment(id) : cancelPayment(id),
    onSuccess: async (payment) => {
      await queryClient.invalidateQueries({ queryKey: paymentQueryKey });
      toast.success(`Payment ${payment.status}`);
      setView({ mode: "show", payment });
    },
    onError: (error) => toast.error("Payment action failed", { description: message(error) })
  });
  const remove = useMutation({
    mutationFn: deletePayment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: paymentQueryKey });
      toast.success("Draft payment deleted");
      setView({ mode: "list" });
    },
    onError: (error) => toast.error("Payment could not be deleted", { description: message(error) })
  });
  const entries = paymentsQuery.data?.items ?? [];
  const totalCount = paymentsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const pageEntries = entries;
  if (view.mode === "upsert")
    return (
      <PaymentForm
        context={contextQuery.data ?? null}
        error={save.error ? message(save.error) : undefined}
        payment={view.payment}
        saving={save.isPending}
        onCancel={() =>
          setView(
            view.returnTo === "show" && view.payment
              ? { mode: "show", payment: view.payment }
              : { mode: "list" }
          )
        }
        onSave={(payload) =>
          save.mutate({ ...(view.payment ? { id: view.payment.id } : {}), payload })
        }
      />
    );
  if (view.mode === "show")
    return (
      <PaymentShow
        payment={view.payment}
        onBack={() => setView({ mode: "list" })}
        onEdit={() => setView({ mode: "upsert", payment: view.payment, returnTo: "show" })}
        onPrint={() => {
          if (location.pathname.endsWith("/print")) window.print();
          else void navigate({ to: `${basePath}/${encodeURIComponent(view.payment.id)}/print` });
        }}
        onPost={() => lifecycle.mutate({ action: "post", id: view.payment.id })}
        onCancel={() => lifecycle.mutate({ action: "cancel", id: view.payment.id })}
        canEditEntries={canEditEntries}
        canEditFinalizedEntries={canEditFinalizedEntries}
      />
    );
  return (
    <WorkspacePage
      variant="list"
      action={
        <div className="flex gap-2">
          <Button
            onClick={() => {
              void contextQuery.refetch();
              setView({ mode: "upsert", payment: null, returnTo: "list" });
            }}
            type="button"
          >
            <Plus className="size-4" />
            New payment
          </Button>
        </div>
      }
      description="Create, review, allocate, post, and print tenant-isolated payment vouchers."
      title="Payments"
    >
      <WorkspaceFilters
        columnOptions={listTools.columnOptions}
        onShowAllColumns={listTools.onShowAllColumns}
        showSelectedFilterChip
        filterOptions={statusFilters.map((option) => ({
          ...option,
          ...(option.id === statusFilter ? { count: paymentsQuery.data?.total ?? 0 } : {})
        }))}
        filterValue={statusFilter}
        onFilterValueChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
        onSearchValueChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search payment, supplier, ledger, mode, or status"
        searchValue={search}
        toolbarAction={
          <>
            <BillingDocumentListControls
              columnSearchAction={listTools.toolbarAction}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={(value) => {
                setDateFrom(value);
                setPage(1);
              }}
              onDateToChange={(value) => {
                setDateTo(value);
                setPage(1);
              }}
              onTotalsViewChange={setTotalsView}
              totalsView={totalsView}
            />
          </>
        }
      />
      {paymentsQuery.isError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {message(paymentsQuery.error)}
        </p>
      ) : null}
      <PaymentList
        listTools={listTools}
        entries={pageEntries}
        canEditEntries={canEditEntries}
        canEditFinalizedEntries={canEditFinalizedEntries}
        loading={paymentsQuery.isLoading}
        totalsRecords={pageEntries.map((payment) => ({
          amount: payment.totalAmount,
          date: payment.paymentDate,
          documentNumber: payment.paymentNumber,
          partyName: payment.supplierName,
          subtotal: payment.totalAmount,
          taxAmount: payment.allocatedAmount
        }))}
        totalsView={totalsView}
        onView={(payment) => setView({ mode: "show", payment })}
        onEdit={(payment) => setView({ mode: "upsert", payment, returnTo: "list" })}
        onPost={(payment) =>
          confirmAction(`Post ${payment.paymentNumber}?`, () =>
            lifecycle.mutate({ action: "post", id: payment.id })
          )
        }
        onCancel={(payment) =>
          confirmAction(`Cancel ${payment.paymentNumber}?`, () =>
            lifecycle.mutate({ action: "cancel", id: payment.id })
          )
        }
        onDelete={(payment) =>
          confirmAction(`Delete draft ${payment.paymentNumber}?`, () => remove.mutate(payment.id))
        }
      />
      <WorkspacePagination
        onNextPage={() => setPage((current) => Math.min(totalPages, current + 1))}
        onPageChange={setPage}
        onPreviousPage={() => setPage((current) => Math.max(1, current - 1))}
        onRowsPerPageChange={(value) => {
          setRowsPerPage(value);
          setPage(1);
        }}
        page={page}
        rowsPerPage={rowsPerPage}
        showingLabel={showingLabel(totalCount, page, rowsPerPage)}
        singularLabel="payment"
        totalCount={totalCount}
        totalPages={totalPages}
      />
    </WorkspacePage>
  );
}

function PaymentShow({
  canEditEntries,
  canEditFinalizedEntries,
  payment,
  onBack,
  onCancel,
  onEdit,
  onPrint,
  onPost
}: {
  canEditEntries: boolean;
  canEditFinalizedEntries: boolean;
  payment: Payment;
  onBack: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onPost: () => void;
}) {
  const activityQuery = usePaymentActivity(payment.id);
  return (
    <WorkspacePage
      action={
        <div className="flex gap-2">
          {canEditBillingEntry(payment.status, canEditEntries, canEditFinalizedEntries) ? (
            <>
              <Button onClick={onEdit} type="button" variant="outline">
                <Pencil className="size-4" />
                Edit
              </Button>
              {canEditFinalizedEntries && payment.status === "draft" ? (
                <Button onClick={onPost} type="button">
                  Post
                </Button>
              ) : null}
            </>
          ) : null}
          {canEditFinalizedEntries && payment.status === "posted" ? (
            <Button onClick={onCancel} type="button" variant="destructive">
              Cancel
            </Button>
          ) : null}
          <Button onClick={onPrint} type="button" variant="outline">
            <Printer className="size-4" />
            Print
          </Button>
        </div>
      }
      description={`${payment.supplierName} • ${payment.paymentDate}`}
      onBack={onBack}
      title={payment.paymentNumber}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <PaymentPrint payment={payment} />
        <div className="rounded-md border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Payment summary</h2>
            <WorkspaceStatusBadge status={payment.status} />
          </div>
          <dl className="mt-4 grid gap-3 text-sm">
            <Summary label="Company" value={payment.companyName} />
            <Summary label="Financial year" value={payment.financialYearName} />
            <Summary label="Ledger" value={payment.ledgerName} />
            <Summary label="Amount" value={formatPaymentMoney(payment.amount)} />
            <Summary label="Allocated" value={formatPaymentMoney(payment.allocatedAmount)} />
            <Summary label="Unallocated" value={formatPaymentMoney(payment.unallocatedAmount)} />
            <Summary label="Total" value={formatPaymentMoney(payment.totalAmount)} />
          </dl>
        </div>
      </div>
      <WorkspaceShowCard title="Activity">
        <div className="divide-y divide-border/60">
          {activityQuery.isLoading ? (
            <GlobalLoader className="min-h-28" fullScreen={false} />
          ) : null}
          {activityQuery.isError ? (
            <p className="px-4 py-3 text-sm text-destructive">{message(activityQuery.error)}</p>
          ) : null}
          {!activityQuery.isLoading && !activityQuery.isError && !activityQuery.data?.length ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No activity yet.</p>
          ) : null}
          {(activityQuery.data ?? []).map((activity) => (
            <div className="px-4 py-3" key={activity.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium capitalize">{activity.action}</p>
                <time className="text-xs text-muted-foreground">
                  {formatActivityDate(activity.createdAt)}
                </time>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{activity.description}</p>
            </div>
          ))}
        </div>
      </WorkspaceShowCard>
    </WorkspacePage>
  );
}
function formatActivityDate(value: string) {
  return formatWorkspaceDateTime(value);
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
function showingLabel(total: number, page: number, rows: number) {
  if (!total) return "Showing 0 payments";
  return `Showing ${(page - 1) * rows + 1}-${Math.min(page * rows, total)} of ${total}`;
}
function confirmAction(question: string, action: () => void) {
  if (window.confirm(question)) action();
}
function message(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected Payment error occurred.";
}
