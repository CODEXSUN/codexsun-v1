import { useWorkspaceQueryValue } from "@codexsun/ui/workspace/navigation";
import { useWorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspacePagination } from "@codexsun/ui/workspace/pagination";
import { WorkspaceTableEmptyState, WorkspaceTablePanel } from "@codexsun/ui/workspace/table";
import { buildShowingLabel } from "@codexsun/ui/workspace/utils";
import { cn } from "@codexsun/ui/lib/utils";
import { useSalesSettings } from "../settings";
import { defaultBillingSettings } from "../settings/settings.types";
import type { Quotation, QuotationSavePayload, QuotationView } from "./quotation.types";
import { QuotationShowPage } from "./quotation.show";
import {
  createQuotation,
  convertQuotationToSale,
  convertQuotationsToSale,
  deleteQuotation,
  formatMoney,
  revokeQuotation,
  setQuotationStatus,
  totalQuotationQuantity,
  updateQuotation
} from "./quotation.services";
import { useQuotationPage, useQuotationRecord } from "./quotation.hooks";
import { quotationRouteFromPath, quotationRoutePath, type QuotationRoute } from "./quotation.route";
import { QuotationForm } from "./quotation.form";
import { canSelectQuotation, QuotationList } from "./quotation.list";
import { canEditBillingEntry, useBillingAccess } from "../../shared/auth/billing-access";
import {
  BillingDocumentListControls,
  type BillingDocumentTotalsViewMode
} from "../../shared/document/document-totals-report";

const statusFilters = [
  { id: "all", label: "All quotations" },
  { id: "draft", label: "Draft" },
  { id: "confirmed", label: "Confirmed" },
  { id: "cancelled", label: "Cancelled" }
];

const quotationColumnCatalog = [
  { id: "customer", label: "Customer" },
  { id: "items", label: "QTY" },
  { id: "taxable", label: "Taxable" },
  { id: "gst", label: "GST" },
  { id: "total", label: "Total" },
  { id: "status", label: "Status" },
  { id: "invoice", label: "Invoice" },
  { id: "action", label: "Action" }
] as const;

function printQuotationFromList(quotationId: string) {
  const frame = document.createElement("iframe");
  let cleanupTimer: number | undefined;
  const cleanup = () => {
    if (cleanupTimer !== undefined) window.clearTimeout(cleanupTimer);
    frame.remove();
  };

  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.position = "fixed";
  frame.style.left = "-10000px";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.border = "0";
  frame.addEventListener(
    "load",
    () => frame.contentWindow?.addEventListener("afterprint", cleanup, { once: true }),
    { once: true }
  );
  const printPath = quotationRoutePath(
    { id: quotationId, mode: "print" },
    window.location.pathname.startsWith("/app/")
  );
  frame.src = `${printPath}?autoprint=1`;
  document.body.append(frame);
  cleanupTimer = window.setTimeout(cleanup, 120_000);
}

export function QuotationWorkspace() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const route = quotationRouteFromPath(location.pathname);
  const recordQuery = useQuotationRecord("id" in route ? route.id : null);
  const tenantDesk = location.pathname.startsWith("/app/");
  const settingsQuery = useSalesSettings();
  const settings = settingsQuery.data ?? defaultBillingSettings;
  const quotationLayout = settings.layout;
  const accessQuery = useBillingAccess();
  const canEditEntries = accessQuery.data?.canEditEntries ?? false;
  const canEditFinalizedEntries = accessQuery.data?.canEditFinalizedEntries ?? false;
  const canAdminRevoke = canEditFinalizedEntries;
  const view: QuotationView =
    route.mode === "new"
      ? { mode: "upsert", quotation: null, returnTo: "list" }
      : route.mode === "show" && recordQuery.data
        ? { mode: "show", quotation: recordQuery.data }
        : route.mode === "edit" && recordQuery.data
          ? { mode: "upsert", quotation: recordQuery.data, returnTo: "show" }
          : { mode: "list" };

  function openQuotation(nextRoute: QuotationRoute) {
    void navigate({ to: quotationRoutePath(nextRoute, tenantDesk), search: location.search });
  }
  const [searchValue, setSearchValue] = useWorkspaceQueryValue("q", "");
  const [statusFilter, setStatusFilter] = useWorkspaceQueryValue("status", "all");
  const [dateFrom, setDateFrom] = useWorkspaceQueryValue("from", "");
  const [dateTo, setDateTo] = useWorkspaceQueryValue("to", "");
  const [totalsView, setTotalsView] = useState<BillingDocumentTotalsViewMode>("bill");
  const [selectedQuotationIds, setSelectedQuotationIds] = useState<Set<string>>(() => new Set());
  const listTools = useWorkspaceListTools({
    number: "Quotation",
    date: "Date",
    ...Object.fromEntries(quotationColumnCatalog.map((column) => [column.id, column.label]))
  });
  const visibleColumns = Object.fromEntries(
    quotationColumnCatalog.map((column) => [column.id, !listTools.hidden.includes(column.id)])
  );
  const [currentPage, setCurrentPage] = useWorkspaceQueryValue("page", 1);
  const [rowsPerPage, setRowsPerPage] = useWorkspaceQueryValue("pageSize", 100);
  const quotationsQuery = useQuotationPage({
    numberSearch: listTools.filters.number ?? "",
    dateSearch: listTools.filters.date ?? "",
    partySearch: listTools.filters.customer ?? "",
    totalSearch: listTools.filters.total ?? "",
    statusSearch: listTools.filters.status ?? "",
    quantitySearch: listTools.filters.items ?? "",
    taxableSearch: listTools.filters.taxable ?? "",
    taxSearch: listTools.filters.gst ?? "",
    customer: "all",
    dateFrom,
    dateTo,
    page: currentPage,
    pageSize: rowsPerPage,
    search: searchValue,
    status: statusFilter
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: QuotationSavePayload }) =>
      id ? updateQuotation(id, payload) : createQuotation(payload),
    onSuccess: async (quotation) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["billing", "quotations"] }),
        queryClient.invalidateQueries({ queryKey: ["billing", "settings"] }),
        queryClient.invalidateQueries({ queryKey: ["billing", "document-settings"] })
      ]);
      toast.success(route.mode === "edit" ? "Quotation updated" : "Quotation created", {
        description: `${quotation.quotationNumber} is ready.`
      });
      queryClient.setQueryData(["billing", "quotations", quotation.id], quotation);
      openQuotation({ id: quotation.id, mode: "show" });
    },
    onError: (error) => {
      toast.error("Quotation save failed", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "cancelled" | "confirmed" }) =>
      setQuotationStatus(id, status),
    onSuccess: async (quotation) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", "quotations"] });
      toast.success("Quotation status updated", {
        description: `${quotation.quotationNumber} is now ${quotation.status}.`
      });
      queryClient.setQueryData(["billing", "quotations", quotation.id], quotation);
    },
    onError: (error) => {
      toast.error("Status update failed", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeQuotation(id),
    onSuccess: async (quotation) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", "quotations"] });
      toast.success("Quotation revoked", {
        description: `${quotation.quotationNumber} is editable again.`
      });
    },
    onError: (error) => {
      toast.error("Quotation revoke failed", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuotation(id),
    onSuccess: async (quotation) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", "quotations"] });
      toast.success("Quotation deleted", { description: quotation.quotationNumber });
    },
    onError: (error) => {
      toast.error("Quotation could not be deleted", {
        description:
          error instanceof Error ? error.message : "Only draft quotations can be deleted."
      });
    }
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => convertQuotationToSale(id),
    onSuccess: async ({ quotation, sale }) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", "quotations"] });
      await queryClient.invalidateQueries({ queryKey: ["billing", "sales"] });
      toast.success("Quotation converted", {
        description: `${quotation.quotationNumber} created sales invoice ${sale.invoiceNumber}.`
      });
      queryClient.setQueryData(["billing", "quotations", quotation.id], quotation);
      openQuotation({ id: quotation.id, mode: "show" });
    },
    onError: (error) => {
      toast.error("Quotation conversion failed", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  });

  const batchConvertMutation = useMutation({
    mutationFn: (ids: string[]) => convertQuotationsToSale(ids),
    onSuccess: async ({ sale }) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", "quotations"] });
      await queryClient.invalidateQueries({ queryKey: ["billing", "sales"] });
      setSelectedQuotationIds(new Set());
      toast.success("Draft sales invoice generated", { description: sale.invoiceNumber });
    },
    onError: (error) => {
      toast.error("Invoice generation failed", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  });

  const entries = quotationsQuery.data?.items ?? [];
  const totalCount = quotationsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const pageEntries = entries;
  const pageTotals = useMemo(
    () =>
      pageEntries.reduce(
        (totals, quotation) => ({
          amount: totals.amount + quotation.amount,
          quantity: totals.quantity + totalQuotationQuantity(quotation),
          subtotal: totals.subtotal + quotation.subtotal,
          taxAmount: totals.taxAmount + quotation.taxAmount
        }),
        { amount: 0, quantity: 0, subtotal: 0, taxAmount: 0 }
      ),
    [pageEntries]
  );
  const selectedEntries = useMemo(
    () => entries.filter((quotation) => selectedQuotationIds.has(quotation.id)),
    [entries, selectedQuotationIds]
  );
  const pageSelectableEntries = pageEntries.filter(canSelectQuotation);
  const pageSelected =
    pageSelectableEntries.length > 0 &&
    pageSelectableEntries.every((quotation) => selectedQuotationIds.has(quotation.id));

  useEffect(() => {
    setSelectedQuotationIds((current) => {
      const available = new Set(entries.map((quotation) => quotation.id));
      const next = new Set(Array.from(current).filter((id) => available.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [entries]);

  function toggleQuotationSelection(quotation: Quotation, checked: boolean) {
    if (!canSelectQuotation(quotation)) return;
    setSelectedQuotationIds((current) => {
      const next = new Set(current);
      if (checked) next.add(quotation.id);
      else next.delete(quotation.id);
      return next;
    });
  }

  function togglePageSelection(checked: boolean) {
    setSelectedQuotationIds((current) => {
      const next = new Set(current);
      for (const quotation of pageSelectableEntries) {
        if (checked) next.add(quotation.id);
        else next.delete(quotation.id);
      }
      return next;
    });
  }

  function generateInvoice() {
    if (!selectedEntries.length) {
      toast.error("Select at least one quotation.");
      return;
    }
    const contact = quotationContactKey(selectedEntries[0]!);
    if (selectedEntries.some((quotation) => quotationContactKey(quotation) !== contact)) {
      toast.error("Selected quotations must belong to the same contact.");
      return;
    }
    batchConvertMutation.mutate(selectedEntries.map((quotation) => quotation.id));
  }

  if ((route.mode === "show" || route.mode === "edit") && recordQuery.isLoading) {
    return <WorkspaceTableEmptyState>Loading quotation...</WorkspaceTableEmptyState>;
  }

  if ((route.mode === "show" || route.mode === "edit") && !recordQuery.data) {
    return (
      <WorkspaceTableEmptyState>
        {recordQuery.error instanceof Error
          ? recordQuery.error.message
          : "Quotation was not found."}
      </WorkspaceTableEmptyState>
    );
  }

  if (view.mode === "show") {
    const freshQuotation =
      entries.find((entry) => entry.id === view.quotation.id) ?? view.quotation;
    const currentIndex = entries.findIndex((entry) => entry.id === freshQuotation.id);
    const previousQuotation = currentIndex > 0 ? entries[currentIndex - 1] : null;
    const nextQuotation =
      currentIndex >= 0 && currentIndex < entries.length - 1 ? entries[currentIndex + 1] : null;
    return (
      <QuotationShowPage
        quotation={freshQuotation}
        onBack={() => openQuotation({ mode: "list" })}
        onEdit={() => openQuotation({ id: freshQuotation.id, mode: "edit" })}
        onNew={() => openQuotation({ mode: "new" })}
        onPrint={() => openQuotation({ id: freshQuotation.id, mode: "print" })}
        onConvert={() => convertMutation.mutate(freshQuotation.id)}
        onLinked={(quotation) =>
          queryClient.setQueryData(["billing", "quotations", quotation.id], quotation)
        }
        converting={convertMutation.isPending}
        canEdit={
          !freshQuotation.generatedSalesInvoiceNo &&
          canEditBillingEntry(freshQuotation.status, canEditEntries, canEditFinalizedEntries)
        }
        {...(previousQuotation
          ? { onPrevious: () => openQuotation({ id: previousQuotation.id, mode: "show" }) }
          : {})}
        {...(nextQuotation
          ? { onNext: () => openQuotation({ id: nextQuotation.id, mode: "show" }) }
          : {})}
      />
    );
  }

  if (view.mode === "upsert") {
    return (
      <QuotationForm
        errorMessage={saveMutation.error instanceof Error ? saveMutation.error.message : ""}
        loading={saveMutation.isPending}
        quotation={view.quotation}
        settings={quotationLayout}
        numbering={settings.numbering.quotation}
        canAdminRevoke={canAdminRevoke}
        {...(view.quotation && canAdminRevoke
          ? { onRevoke: () => revokeMutation.mutate(view.quotation!.id) }
          : {})}
        onBack={() =>
          openQuotation(
            view.returnTo === "show" && view.quotation
              ? { id: view.quotation.id, mode: "show" }
              : { mode: "list" }
          )
        }
        onSubmit={(payload, printAfter) => {
          saveMutation.mutate(view.quotation ? { id: view.quotation.id, payload } : { payload }, {
            onSuccess: (quotation) => {
              if (!printAfter) return;
              void navigate({
                search: { autoprint: "1" },
                to: quotationRoutePath({ id: quotation.id, mode: "print" }, tenantDesk)
              });
            }
          });
        }}
      />
    );
  }

  return (
    <WorkspacePage
      variant="list"
      title="Quotations"
      description="Create and review tenant-isolated quotation vouchers with sales layout controls."
      technicalName="page.billing.quotation.list"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="h-9 rounded-md"
            disabled={!selectedEntries.length || batchConvertMutation.isPending}
            onClick={generateInvoice}
            type="button"
            variant="secondary"
          >
            <Send className="size-4" />
            Generate invoice{selectedEntries.length ? ` (${selectedEntries.length})` : ""}
          </Button>
          <Button
            className="h-9 rounded-md"
            onClick={() => openQuotation({ mode: "new" })}
            type="button"
          >
            <Plus className="size-4" />
            New quotation
          </Button>
        </div>
      }
    >
      <WorkspaceFilters
        showSelectedFilterChip
        filterOptions={statusFilters.map((option) => ({
          ...option,
          ...(option.id === statusFilter ? { count: quotationsQuery.data?.total ?? 0 } : {})
        }))}
        filterValue={statusFilter}
        onFilterValueChange={(value) => {
          setStatusFilter(value);
          setCurrentPage(1);
        }}
        onSearchValueChange={(value) => {
          setSearchValue(value);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search quotation, customer, work order, date, or total"
        searchValue={searchValue}
        columnOptions={listTools.columnOptions.filter((column) =>
          quotationColumnCatalog.some((item) => item.id === column.id)
        )}
        onShowAllColumns={listTools.onShowAllColumns}
        toolbarAction={
          <>
            <BillingDocumentListControls
              columnSearchAction={listTools.toolbarAction}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={(value) => {
                setDateFrom(value);
                setCurrentPage(1);
              }}
              onDateToChange={(value) => {
                setDateTo(value);
                setCurrentPage(1);
              }}
              onTotalsViewChange={setTotalsView}
              totalsView={totalsView}
            />
          </>
        }
      />
      {quotationsQuery.isError ? (
        <WorkspaceTablePanel>
          <WorkspaceTableEmptyState>
            {quotationsQuery.error instanceof Error
              ? quotationsQuery.error.message
              : "Quotations could not be loaded."}
          </WorkspaceTableEmptyState>
        </WorkspaceTablePanel>
      ) : null}
      <QuotationList
        listTools={listTools}
        entries={pageEntries}
        loading={quotationsQuery.isLoading}
        totalsRecords={pageEntries.map((quotation) => ({
          amount: quotation.amount,
          date: quotation.date,
          documentNumber: quotation.quotationNumber,
          partyName: quotation.customerName,
          subtotal: quotation.subtotal,
          taxAmount: quotation.taxAmount
        }))}
        totalsView={totalsView}
        onEdit={(quotation) => openQuotation({ id: quotation.id, mode: "edit" })}
        onSetStatus={(quotation, status) => statusMutation.mutate({ id: quotation.id, status })}
        onForceDelete={(quotation) => {
          if (window.confirm(`Force delete ${quotation.quotationNumber}? This cannot be undone.`))
            deleteMutation.mutate(quotation.id);
        }}
        onRevoke={(quotation) => revokeMutation.mutate(quotation.id)}
        onPrint={(quotation) => printQuotationFromList(quotation.id)}
        canAdminRevoke={canAdminRevoke}
        canEditEntries={canEditEntries}
        canEditFinalizedEntries={canEditFinalizedEntries}
        onView={(quotation) => openQuotation({ id: quotation.id, mode: "show" })}
        page={currentPage}
        rowsPerPage={rowsPerPage}
        pageSelected={pageSelected}
        pageSelectableCount={pageSelectableEntries.length}
        selectedQuotationIds={selectedQuotationIds}
        onTogglePageSelection={togglePageSelection}
        onToggleSelection={toggleQuotationSelection}
        visibleColumns={visibleColumns}
      />
      <QuotationPageTotals
        amount={pageTotals.amount}
        quantity={pageTotals.quantity}
        subtotal={pageTotals.subtotal}
        taxAmount={pageTotals.taxAmount}
      />
      <WorkspacePagination
        page={currentPage}
        rowsPerPage={rowsPerPage}
        showingLabel={buildShowingLabel(currentPage, rowsPerPage, totalCount)}
        singularLabel="quotations"
        totalCount={totalCount}
        totalPages={totalPages}
        onNextPage={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
        onPageChange={setCurrentPage}
        onPreviousPage={() => setCurrentPage((page) => Math.max(1, page - 1))}
        onRowsPerPageChange={(value) => {
          setRowsPerPage(value);
          setCurrentPage(1);
        }}
      />
    </WorkspacePage>
  );
}

function QuotationPageTotals({
  amount,
  quantity,
  subtotal,
  taxAmount
}: {
  amount: number;
  quantity: number;
  subtotal: number;
  taxAmount: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-border/70 bg-card px-4 py-2.5 shadow-sm md:grid-cols-4">
      <PageTotal label="Total quantity" value={String(quantity)} />
      <PageTotal label="Total taxable" value={formatMoney(subtotal)} />
      <PageTotal label="Total GST" value={formatMoney(taxAmount)} />
      <PageTotal label="Grand total" strong value={formatMoney(amount)} />
    </div>
  );
}

function PageTotal({ label, strong, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <div className="flex h-full items-center justify-start gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium text-foreground", strong && "font-semibold")}>{value}</span>
    </div>
  );
}

function quotationContactKey(quotation: Quotation) {
  return quotation.customerName.trim().toLowerCase();
}
