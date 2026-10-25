import { useWorkspaceQueryValue } from "@codexsun/ui/workspace/navigation";
import { useWorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import { useEffect, useMemo, useState, type SetStateAction } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
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
import { type SaleSavePayload, type SaleView } from "./sales.types";
import { SaleShowPage } from "./sales.show";
import {
  createSale,
  deleteSale,
  formatMoney,
  getSale,
  setSaleStatus,
  revokeSale,
  totalSaleQuantity,
  updateSale
} from "./sales.services";
import { useSalesPage } from "./sales.hooks";
import { SalesForm } from "./sales.form";
import { SalesList } from "./sales.list";
import { canEditBillingEntry, useBillingAccess } from "../../shared/auth/billing-access";
import {
  BillingDocumentListControls,
  type BillingDocumentTotalsViewMode
} from "../../shared/document/document-totals-report";

const statusFilters = [
  { id: "all", label: "All sales" },
  { id: "draft", label: "Draft" },
  { id: "confirmed", label: "Confirmed" },
  { id: "cancelled", label: "Cancelled" }
];

const saleColumnCatalog = [
  { id: "date", label: "Date" },
  { id: "customer", label: "Customer" },
  { id: "items", label: "QTY" },
  { id: "taxable", label: "Taxable" },
  { id: "gst", label: "GST" },
  { id: "total", label: "Total" },
  { id: "status", label: "Status" },
  { id: "action", label: "Action" }
] as const;

export function SalesWorkspace({ initialRecordId }: { initialRecordId?: string | undefined }) {
  const queryClient = useQueryClient();
  const settingsQuery = useSalesSettings();
  const settings = settingsQuery.data ?? defaultBillingSettings;
  const saleLayout = settings.layout;
  const accessQuery = useBillingAccess();
  const canEditEntries = accessQuery.data?.canEditEntries ?? false;
  const canEditFinalizedEntries = accessQuery.data?.canEditFinalizedEntries ?? false;
  const canAdminRevoke = canEditFinalizedEntries;
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setLocalView] = useState<SaleView>({ mode: "list" });
  const basePath = `${location.pathname.startsWith("/app/") ? "/app" : ""}/billing/sales`;
  function setView(update: SetStateAction<SaleView>) {
    const next = typeof update === "function" ? update(view) : update;
    setLocalView(next);
    const record = next.mode === "list" ? null : next.sale;
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
      setLocalView({ mode: "upsert", sale: null, returnTo: "list" });
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
    void getSale(id)
      .then((sale) => {
        if (!active) return;
        setLocalView(
          tail[1] === "edit" ? { mode: "upsert", sale, returnTo: "show" } : { mode: "show", sale }
        );
      })
      .catch((error) => {
        if (active)
          toast.error("Sale could not be opened", {
            description: error instanceof Error ? error.message : "Please try again."
          });
      });
    return () => {
      active = false;
    };
  }, [location.pathname]);
  const [searchValue, setSearchValue] = useWorkspaceQueryValue("q", "");
  const [statusFilter, setStatusFilter] = useWorkspaceQueryValue("status", "all");
  const [dateFrom, setDateFrom] = useWorkspaceQueryValue("from", "");
  const [dateTo, setDateTo] = useWorkspaceQueryValue("to", "");
  const [totalsView, setTotalsView] = useState<BillingDocumentTotalsViewMode>("bill");
  const listTools = useWorkspaceListTools({
    number: "Sale",
    date: "Date",
    ...Object.fromEntries(saleColumnCatalog.map((column) => [column.id, column.label]))
  });
  const visibleColumns = Object.fromEntries(
    saleColumnCatalog.map((column) => [column.id, !listTools.hidden.includes(column.id)])
  );
  const [currentPage, setCurrentPage] = useWorkspaceQueryValue("page", 1);
  const [rowsPerPage, setRowsPerPage] = useWorkspaceQueryValue("pageSize", 100);
  const salesQuery = useSalesPage({
    numberSearch: listTools.filters.number ?? "",
    dateSearch: listTools.filters.date ?? "",
    partySearch: listTools.filters.customer ?? "",
    totalSearch: listTools.filters.total ?? "",
    statusSearch: listTools.filters.status ?? "",
    quantitySearch: listTools.filters.items ?? "",
    taxableSearch: listTools.filters.taxable ?? "",
    taxSearch: listTools.filters.gst ?? "",
    dateFrom,
    dateTo,
    page: currentPage,
    pageSize: rowsPerPage,
    search: searchValue,
    status: statusFilter
  });

  useEffect(() => {
    if (!initialRecordId) return;
    let active = true;
    void getSale(initialRecordId)
      .then((sale) => {
        if (active) setView({ mode: "show", sale });
      })
      .catch((error) => {
        if (active)
          toast.error("Sale could not be opened", {
            description: error instanceof Error ? error.message : "Please try again."
          });
      });
    return () => {
      active = false;
    };
  }, [initialRecordId]);

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: SaleSavePayload }) =>
      id ? updateSale(id, payload) : createSale(payload),
    onSuccess: async (sale) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["billing", "sales"] }),
        queryClient.invalidateQueries({ queryKey: ["billing", "settings"] }),
        queryClient.invalidateQueries({ queryKey: ["billing", "document-settings"] })
      ]);
      toast.success(view.mode === "upsert" && view.sale ? "Sale updated" : "Sale created", {
        description: `${sale.saleNumber} is ready.`
      });
      if (sale.numberingWarning) {
        toast.warning("Sale number changed", { description: sale.numberingWarning });
      }
      setView({ mode: "show", sale });
    },
    onError: (error) => {
      toast.error("Sale save failed", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "cancelled" | "confirmed" }) =>
      setSaleStatus(id, status),
    onSuccess: async (sale) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", "sales"] });
      toast.success("Sale status updated", {
        description: `${sale.saleNumber} is now ${sale.status}.`
      });
      setView((current) => (current.mode === "show" ? { mode: "show", sale } : current));
    },
    onError: (error) => {
      toast.error("Status update failed", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeSale(id),
    onSuccess: async (sale) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", "sales"] });
      toast.success("Sale revoked", { description: `${sale.saleNumber} is editable again.` });
    },
    onError: (error) => {
      toast.error("Sale revoke failed", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSale(id),
    onSuccess: async (sale) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", "sales"] });
      toast.success("Sale deleted", { description: sale.saleNumber });
    },
    onError: (error) => {
      toast.error("Sale could not be deleted", {
        description: error instanceof Error ? error.message : "Only draft sales can be deleted."
      });
    }
  });

  const entries = salesQuery.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((salesQuery.data?.total ?? 0) / rowsPerPage));
  const pageEntries = entries;
  const pageTotals = useMemo(
    () =>
      pageEntries.reduce(
        (totals, sale) => ({
          amount: totals.amount + sale.amount,
          quantity: totals.quantity + totalSaleQuantity(sale),
          subtotal: totals.subtotal + sale.subtotal,
          taxAmount: totals.taxAmount + sale.taxAmount
        }),
        { amount: 0, quantity: 0, subtotal: 0, taxAmount: 0 }
      ),
    [pageEntries]
  );

  function openNewSale() {
    setView({ mode: "upsert", sale: null, returnTo: "list" });
  }

  if (view.mode === "show") {
    const freshSale = entries.find((entry) => entry.id === view.sale.id) ?? view.sale;
    const currentIndex = entries.findIndex((entry) => entry.id === freshSale.id);
    const previousSale = currentIndex > 0 ? entries[currentIndex - 1] : null;
    const nextSale =
      currentIndex >= 0 && currentIndex < entries.length - 1 ? entries[currentIndex + 1] : null;
    return (
      <SaleShowPage
        sale={freshSale}
        onBack={() => setView({ mode: "list" })}
        onEdit={() => setView({ mode: "upsert", sale: freshSale, returnTo: "show" })}
        onNew={openNewSale}
        onPrint={() =>
          void navigate({ to: `${basePath}/${encodeURIComponent(freshSale.id)}/print` })
        }
        canEdit={canEditBillingEntry(freshSale.status, canEditEntries, canEditFinalizedEntries)}
        {...(previousSale
          ? { onPrevious: () => setView({ mode: "show", sale: previousSale }) }
          : {})}
        {...(nextSale ? { onNext: () => setView({ mode: "show", sale: nextSale }) } : {})}
      />
    );
  }

  if (view.mode === "upsert") {
    return (
      <SalesForm
        errorMessage={saveMutation.error instanceof Error ? saveMutation.error.message : ""}
        loading={saveMutation.isPending}
        sale={view.sale}
        settings={saleLayout}
        numbering={settings.numbering.sales}
        canAdminRevoke={canAdminRevoke}
        {...(view.sale && canAdminRevoke
          ? { onRevoke: () => revokeMutation.mutate(view.sale!.id) }
          : {})}
        onBack={() =>
          setView(
            view.returnTo === "show" && view.sale
              ? { mode: "show", sale: view.sale }
              : { mode: "list" }
          )
        }
        onSubmit={(payload, printAfter) => {
          saveMutation.mutate(view.sale ? { id: view.sale.id, payload } : { payload }, {
            onSuccess: () => {
              if (printAfter) window.setTimeout(() => window.print(), 250);
            }
          });
        }}
      />
    );
  }

  return (
    <WorkspacePage
      variant="list"
      title="Sales"
      description="Create and review tenant-isolated sale vouchers with sales layout controls."
      technicalName="page.billing.sale.list"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button className="h-9 rounded-md" onClick={openNewSale} type="button">
            <Plus className="size-4" />
            New sale
          </Button>
        </div>
      }
    >
      <WorkspaceFilters
        showSelectedFilterChip
        filterOptions={statusFilters.map((option) => ({
          ...option,
          ...(option.id === statusFilter ? { count: salesQuery.data?.total ?? 0 } : {})
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
        searchPlaceholder="Search sale, customer, work order, date, or total"
        searchValue={searchValue}
        columnOptions={listTools.columnOptions.filter((column) =>
          saleColumnCatalog.some((item) => item.id === column.id)
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
      {salesQuery.isError ? (
        <WorkspaceTablePanel>
          <WorkspaceTableEmptyState>
            {salesQuery.error instanceof Error
              ? salesQuery.error.message
              : "Sales could not be loaded."}
          </WorkspaceTableEmptyState>
        </WorkspaceTablePanel>
      ) : null}
      <SalesList
        listTools={listTools}
        entries={pageEntries}
        loading={salesQuery.isLoading}
        totalsRecords={pageEntries.map((sale) => ({
          amount: sale.amount,
          date: sale.issuedOn,
          documentNumber: sale.saleNumber,
          partyName: sale.customerName,
          subtotal: sale.subtotal,
          taxAmount: sale.taxAmount
        }))}
        totalsView={totalsView}
        onEdit={(sale) => setView({ mode: "upsert", sale, returnTo: "list" })}
        onSetStatus={(sale, status) => statusMutation.mutate({ id: sale.id, status })}
        onForceDelete={(sale) => {
          if (window.confirm(`Force delete ${sale.saleNumber}? This cannot be undone.`))
            deleteMutation.mutate(sale.id);
        }}
        onRevoke={(sale) => revokeMutation.mutate(sale.id)}
        onPrint={(sale) =>
          void navigate({ to: `${basePath}/${encodeURIComponent(sale.id)}/print` })
        }
        canAdminRevoke={canAdminRevoke}
        canEditEntries={canEditEntries}
        canEditFinalizedEntries={canEditFinalizedEntries}
        onView={(sale) => setView({ mode: "show", sale })}
        visibleColumns={visibleColumns}
      />
      <SalePageTotals
        amount={pageTotals.amount}
        quantity={pageTotals.quantity}
        subtotal={pageTotals.subtotal}
        taxAmount={pageTotals.taxAmount}
      />
      <WorkspacePagination
        page={currentPage}
        rowsPerPage={rowsPerPage}
        showingLabel={buildShowingLabel(currentPage, rowsPerPage, salesQuery.data?.total ?? 0)}
        singularLabel="sales"
        totalCount={salesQuery.data?.total ?? 0}
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

function SalePageTotals({
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
