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
  receiptQueryKey,
  useReceiptActivity,
  useReceiptContext,
  useReceiptPage
} from "./receipt.hooks";
import { ReceiptForm } from "./receipt.form";
import { ReceiptList } from "./receipt.list";
import { ReceiptPrint } from "./receipt.print";
import {
  cancelReceipt,
  createReceipt,
  deleteReceipt,
  formatReceiptMoney,
  getReceipt,
  postReceipt,
  updateReceipt
} from "./receipt.services";
import type { Receipt, ReceiptSavePayload, ReceiptView } from "./receipt.types";

const statusFilters = [
  { id: "all", label: "All receipts" },
  { id: "draft", label: "Draft" },
  { id: "posted", label: "Posted" },
  { id: "cancelled", label: "Cancelled" }
];

export function ReceiptWorkspace({ initialRecordId }: { initialRecordId?: string | undefined }) {
  const queryClient = useQueryClient();
  const contextQuery = useReceiptContext();
  const accessQuery = useBillingAccess();
  const canEditEntries = accessQuery.data?.canEditEntries ?? false;
  const canEditFinalizedEntries = accessQuery.data?.canEditFinalizedEntries ?? false;
  const location = useLocation();
  const navigate = useNavigate();
  const listTools = useWorkspaceListTools({
    number: "Receipt no",
    date: "Date",
    party: "Customer",
    mode: "Mode",
    total: "Amount",
    unallocated: "Unallocated",
    status: "Status",
    action: "Action"
  });
  const [view, setLocalView] = useState<ReceiptView>({ mode: "list" });
  const basePath = `${location.pathname.startsWith("/app/") ? "/app" : ""}/billing/receipt`;
  function setView(update: SetStateAction<ReceiptView>) {
    const next = typeof update === "function" ? update(view) : update;
    setLocalView(next);
    const record = next.mode === "list" ? null : next.receipt;
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
      setLocalView({ mode: "upsert", receipt: null, returnTo: "list" });
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
    void getReceipt(id)
      .then((receipt) => {
        if (!active) return;
        setLocalView(
          tail[1] === "edit"
            ? { mode: "upsert", receipt, returnTo: "show" }
            : { mode: "show", receipt }
        );
      })
      .catch((error) => {
        if (active)
          toast.error("Receipt could not be opened", {
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
  const receiptsQuery = useReceiptPage({
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
    void getReceipt(initialRecordId)
      .then((receipt) => {
        if (active) setView({ mode: "show", receipt });
      })
      .catch((error) => {
        if (active) toast.error("Receipt could not be opened", { description: message(error) });
      });
    return () => {
      active = false;
    };
  }, [initialRecordId]);
  const save = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: ReceiptSavePayload }) =>
      id ? updateReceipt(id, payload) : createReceipt(payload),
    onSuccess: async (receipt) => {
      await queryClient.invalidateQueries({ queryKey: receiptQueryKey });
      toast.success("Receipt saved", {
        description: receipt.numberingWarning ?? receipt.receiptNumber
      });
      setView({ mode: "show", receipt });
    }
  });
  const lifecycle = useMutation({
    mutationFn: ({ action, id }: { action: "post" | "cancel"; id: string }) =>
      action === "post" ? postReceipt(id) : cancelReceipt(id),
    onSuccess: async (receipt) => {
      await queryClient.invalidateQueries({ queryKey: receiptQueryKey });
      toast.success(`Receipt ${receipt.status}`);
      setView({ mode: "show", receipt });
    },
    onError: (error) => toast.error("Receipt action failed", { description: message(error) })
  });
  const remove = useMutation({
    mutationFn: deleteReceipt,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: receiptQueryKey });
      toast.success("Draft receipt deleted");
      setView({ mode: "list" });
    },
    onError: (error) => toast.error("Receipt could not be deleted", { description: message(error) })
  });
  const entries = receiptsQuery.data?.items ?? [];
  const totalCount = receiptsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const pageEntries = entries;
  if (view.mode === "upsert")
    return (
      <ReceiptForm
        context={contextQuery.data ?? null}
        error={save.error ? message(save.error) : undefined}
        receipt={view.receipt}
        saving={save.isPending}
        onCancel={() =>
          setView(
            view.returnTo === "show" && view.receipt
              ? { mode: "show", receipt: view.receipt }
              : { mode: "list" }
          )
        }
        onSave={(payload) =>
          save.mutate({ ...(view.receipt ? { id: view.receipt.id } : {}), payload })
        }
      />
    );
  if (view.mode === "show")
    return (
      <ReceiptShow
        receipt={view.receipt}
        onBack={() => setView({ mode: "list" })}
        onEdit={() => setView({ mode: "upsert", receipt: view.receipt, returnTo: "show" })}
        onPrint={() => {
          if (location.pathname.endsWith("/print")) window.print();
          else void navigate({ to: `${basePath}/${encodeURIComponent(view.receipt.id)}/print` });
        }}
        onPost={() => lifecycle.mutate({ action: "post", id: view.receipt.id })}
        onCancel={() => lifecycle.mutate({ action: "cancel", id: view.receipt.id })}
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
              setView({ mode: "upsert", receipt: null, returnTo: "list" });
            }}
            type="button"
          >
            <Plus className="size-4" />
            New receipt
          </Button>
        </div>
      }
      description="Create, review, allocate, post, and print tenant-isolated receipt vouchers."
      title="Receipts"
    >
      <WorkspaceFilters
        columnOptions={listTools.columnOptions}
        onShowAllColumns={listTools.onShowAllColumns}
        showSelectedFilterChip
        filterOptions={statusFilters.map((option) => ({
          ...option,
          ...(option.id === statusFilter ? { count: receiptsQuery.data?.total ?? 0 } : {})
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
        searchPlaceholder="Search receipt, customer, ledger, mode, or status"
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
      {receiptsQuery.isError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {message(receiptsQuery.error)}
        </p>
      ) : null}
      <ReceiptList
        listTools={listTools}
        entries={pageEntries}
        canEditEntries={canEditEntries}
        canEditFinalizedEntries={canEditFinalizedEntries}
        loading={receiptsQuery.isLoading}
        totalsRecords={pageEntries.map((receipt) => ({
          amount: receipt.totalAmount,
          date: receipt.receiptDate,
          documentNumber: receipt.receiptNumber,
          partyName: receipt.customerName,
          subtotal: receipt.totalAmount,
          taxAmount: receipt.allocatedAmount
        }))}
        totalsView={totalsView}
        onView={(receipt) => setView({ mode: "show", receipt })}
        onEdit={(receipt) => setView({ mode: "upsert", receipt, returnTo: "list" })}
        onPost={(receipt) =>
          confirmAction(`Post ${receipt.receiptNumber}?`, () =>
            lifecycle.mutate({ action: "post", id: receipt.id })
          )
        }
        onCancel={(receipt) =>
          confirmAction(`Cancel ${receipt.receiptNumber}?`, () =>
            lifecycle.mutate({ action: "cancel", id: receipt.id })
          )
        }
        onDelete={(receipt) =>
          confirmAction(`Delete draft ${receipt.receiptNumber}?`, () => remove.mutate(receipt.id))
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
        singularLabel="receipt"
        totalCount={totalCount}
        totalPages={totalPages}
      />
    </WorkspacePage>
  );
}

function ReceiptShow({
  canEditEntries,
  canEditFinalizedEntries,
  receipt,
  onBack,
  onCancel,
  onEdit,
  onPrint,
  onPost
}: {
  canEditEntries: boolean;
  canEditFinalizedEntries: boolean;
  receipt: Receipt;
  onBack: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onPost: () => void;
}) {
  const activityQuery = useReceiptActivity(receipt.id);
  return (
    <WorkspacePage
      action={
        <div className="flex gap-2">
          {canEditBillingEntry(receipt.status, canEditEntries, canEditFinalizedEntries) ? (
            <>
              <Button onClick={onEdit} type="button" variant="outline">
                <Pencil className="size-4" />
                Edit
              </Button>
              {canEditFinalizedEntries && receipt.status === "draft" ? (
                <Button onClick={onPost} type="button">
                  Post
                </Button>
              ) : null}
            </>
          ) : null}
          {canEditFinalizedEntries && receipt.status === "posted" ? (
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
      description={`${receipt.customerName} · ${receipt.receiptDate}`}
      onBack={onBack}
      title={receipt.receiptNumber}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <ReceiptPrint receipt={receipt} />
        <div className="rounded-md border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Receipt summary</h2>
            <WorkspaceStatusBadge status={receipt.status} />
          </div>
          <dl className="mt-4 grid gap-3 text-sm">
            <Summary label="Company" value={receipt.companyName} />
            <Summary label="Financial year" value={receipt.financialYearName} />
            <Summary label="Ledger" value={receipt.ledgerName} />
            <Summary label="Amount" value={formatReceiptMoney(receipt.amount)} />
            <Summary label="Allocated" value={formatReceiptMoney(receipt.allocatedAmount)} />
            <Summary label="Unallocated" value={formatReceiptMoney(receipt.unallocatedAmount)} />
            <Summary label="Total" value={formatReceiptMoney(receipt.totalAmount)} />
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
  if (!total) return "Showing 0 receipts";
  return `Showing ${(page - 1) * rows + 1}-${Math.min(page * rows, total)} of ${total}`;
}
function confirmAction(question: string, action: () => void) {
  if (window.confirm(question)) action();
}
function message(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected Receipt error occurred.";
}
