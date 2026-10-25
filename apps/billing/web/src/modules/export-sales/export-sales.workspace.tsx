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
import { WorkspaceLookup } from "@codexsun/ui/workspace/lookup";
import { WorkspaceTableEmptyState, WorkspaceTablePanel } from "@codexsun/ui/workspace/table";
import { buildShowingLabel } from "@codexsun/ui/workspace/utils";
import { cn } from "@codexsun/ui/lib/utils";
import { defaultBillingSettings, useBillingSettings } from "../settings";
import {
  type ExportSale,
  type ExportSaleSavePayload,
  type ExportSaleView
} from "./export-sales.types";
import { ExportSaleShowPage } from "./export-sales.show";
import {
  createExportSale,
  deleteExportSale,
  formatMoney,
  getExportSale,
  setExportSaleStatus,
  revokeExportSale,
  totalExportSaleQuantity,
  updateExportSale
} from "./export-sales.services";
import { useExportSalesPage } from "./export-sales.hooks";
import { ExportSalesForm } from "./export-sales.form";
import { canSelectExportSale, ExportSalesList } from "./export-sales.list";
import { canEditBillingEntry, useBillingAccess } from "../../shared/auth/billing-access";
import {
  BillingDocumentListControls,
  type BillingDocumentTotalsViewMode
} from "../../shared/document/document-totals-report";

const statusFilters = [
  { id: "all", label: "All export sales" },
  { id: "draft", label: "Draft" },
  { id: "confirmed", label: "Confirmed" },
  { id: "cancelled", label: "Cancelled" }
];

const exportSaleColumnCatalog = [
  { id: "date", label: "Date" },
  { id: "customer", label: "Customer" },
  { id: "items", label: "QTY" },
  { id: "taxable", label: "Taxable" },
  { id: "gst", label: "GST" },
  { id: "total", label: "Total" },
  { id: "status", label: "Status" },
  { id: "invoice", label: "Invoice" },
  { id: "action", label: "Action" }
] as const;

export function ExportSalesWorkspace({
  initialRecordId
}: {
  initialRecordId?: string | undefined;
}) {
  const queryClient = useQueryClient();
  const settingsQuery = useBillingSettings();
  const settings = settingsQuery.data ?? defaultBillingSettings;
  const exportSaleLayout = settings.layout;
  const accessQuery = useBillingAccess();
  const canEditEntries = accessQuery.data?.canEditEntries ?? false;
  const canEditFinalizedEntries = accessQuery.data?.canEditFinalizedEntries ?? false;
  const canAdminRevoke = canEditFinalizedEntries;
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setLocalView] = useState<ExportSaleView>({ mode: "list" });
  const basePath = `${location.pathname.startsWith("/app/") ? "/app" : ""}/billing/export-sales`;
  function setView(update: SetStateAction<ExportSaleView>) {
    const next = typeof update === "function" ? update(view) : update;
    setLocalView(next);
    const record = next.mode === "list" ? null : next.exportSale;
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
      setLocalView({ mode: "upsert", exportSale: null, returnTo: "list" });
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
    void getExportSale(id)
      .then((exportSale) => {
        if (!active) return;
        setLocalView(
          tail[1] === "edit"
            ? { mode: "upsert", exportSale, returnTo: "show" }
            : { mode: "show", exportSale }
        );
      })
      .catch((error) => {
        if (active)
          toast.error("Export sale could not be opened", {
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
  const [contactFilter, setContactFilter] = useWorkspaceQueryValue("party", "all");
  const [selectedExportSaleIds, setSelectedExportSaleIds] = useState<Set<string>>(() => new Set());
  const listTools = useWorkspaceListTools({
    number: "Export Sale",
    date: "Date",
    ...Object.fromEntries(exportSaleColumnCatalog.map((column) => [column.id, column.label]))
  });
  const visibleColumns = Object.fromEntries(
    exportSaleColumnCatalog.map((column) => [column.id, !listTools.hidden.includes(column.id)])
  );
  const [currentPage, setCurrentPage] = useWorkspaceQueryValue("page", 1);
  const [rowsPerPage, setRowsPerPage] = useWorkspaceQueryValue("pageSize", 100);
  const exportSalesQuery = useExportSalesPage({
    numberSearch: listTools.filters.number ?? "",
    dateSearch: listTools.filters.date ?? "",
    partySearch: listTools.filters.customer ?? "",
    totalSearch: listTools.filters.total ?? "",
    statusSearch: listTools.filters.status ?? "",
    quantitySearch: listTools.filters.items ?? "",
    taxableSearch: listTools.filters.taxable ?? "",
    taxSearch: listTools.filters.gst ?? "",
    customer: contactFilter,
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
    void getExportSale(initialRecordId)
      .then((exportSale) => {
        if (active) setView({ mode: "show", exportSale });
      })
      .catch((error) => {
        if (active)
          toast.error("Export sale could not be opened", {
            description: error instanceof Error ? error.message : "Please try again."
          });
      });
    return () => {
      active = false;
    };
  }, [initialRecordId]);

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: ExportSaleSavePayload }) =>
      id ? updateExportSale(id, payload) : createExportSale(payload),
    onSuccess: async (exportSale) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["billing", "exportSales"] }),
        queryClient.invalidateQueries({ queryKey: ["billing", "settings"] }),
        queryClient.invalidateQueries({ queryKey: ["billing", "document-settings"] })
      ]);
      toast.success(
        view.mode === "upsert" && view.exportSale ? "Export sale updated" : "Export sale created",
        {
          description: `${exportSale.invoiceNumber} is ready.`
        }
      );
      setView({ mode: "show", exportSale });
    },
    onError: (error) => {
      toast.error("Export sale save failed", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "cancelled" | "confirmed" }) =>
      setExportSaleStatus(id, status),
    onSuccess: async (exportSale) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", "exportSales"] });
      toast.success("Export sale status updated", {
        description: `${exportSale.invoiceNumber} is now ${exportSale.status}.`
      });
      setView((current) => (current.mode === "show" ? { mode: "show", exportSale } : current));
    },
    onError: (error) => {
      toast.error("Status update failed", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeExportSale(id),
    onSuccess: async (exportSale) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", "exportSales"] });
      toast.success("Export sale revoked", {
        description: `${exportSale.invoiceNumber} is editable again.`
      });
    },
    onError: (error) => {
      toast.error("Export sale revoke failed", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExportSale(id),
    onSuccess: async (exportSale) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", "exportSales"] });
      toast.success("Export sale deleted", { description: exportSale.invoiceNumber });
    },
    onError: (error) => {
      toast.error("Export sale could not be deleted", {
        description:
          error instanceof Error ? error.message : "Only draft export sales can be deleted."
      });
    }
  });

  const entries = exportSalesQuery.data?.items ?? [];
  const contactOptions = useMemo(() => buildExportSaleContactFilterOptions(entries), [entries]);
  const totalCount = exportSalesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const pageEntries = entries;
  const pageTotals = useMemo(
    () =>
      pageEntries.reduce(
        (totals, exportSale) => ({
          amount: totals.amount + exportSale.amount,
          quantity: totals.quantity + totalExportSaleQuantity(exportSale),
          subtotal: totals.subtotal + exportSale.subtotal,
          taxAmount: totals.taxAmount + exportSale.taxAmount
        }),
        { amount: 0, quantity: 0, subtotal: 0, taxAmount: 0 }
      ),
    [pageEntries]
  );
  const selectedEntries = useMemo(
    () => entries.filter((exportSale) => selectedExportSaleIds.has(exportSale.id)),
    [entries, selectedExportSaleIds]
  );
  const pageSelectableEntries = pageEntries.filter(canSelectExportSale);
  const pageSelected =
    pageSelectableEntries.length > 0 &&
    pageSelectableEntries.every((exportSale) => selectedExportSaleIds.has(exportSale.id));

  useEffect(() => {
    setSelectedExportSaleIds((current) => {
      const available = new Set(entries.map((exportSale) => exportSale.id));
      const next = new Set(Array.from(current).filter((id) => available.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [entries]);

  function openNewExportSale() {
    setView({ mode: "upsert", exportSale: null, returnTo: "list" });
  }

  function toggleExportSaleSelection(exportSale: ExportSale, checked: boolean) {
    if (!canSelectExportSale(exportSale)) return;
    setSelectedExportSaleIds((current) => {
      const next = new Set(current);
      if (checked) next.add(exportSale.id);
      else next.delete(exportSale.id);
      return next;
    });
  }

  function togglePageSelection(checked: boolean) {
    setSelectedExportSaleIds((current) => {
      const next = new Set(current);
      for (const exportSale of pageSelectableEntries) {
        if (checked) next.add(exportSale.id);
        else next.delete(exportSale.id);
      }
      return next;
    });
  }

  if (view.mode === "show") {
    const freshExportSale =
      entries.find((entry) => entry.id === view.exportSale.id) ?? view.exportSale;
    const currentIndex = entries.findIndex((entry) => entry.id === freshExportSale.id);
    const previousExportSale = currentIndex > 0 ? entries[currentIndex - 1] : null;
    const nextExportSale =
      currentIndex >= 0 && currentIndex < entries.length - 1 ? entries[currentIndex + 1] : null;
    return (
      <ExportSaleShowPage
        exportSale={freshExportSale}
        onBack={() => setView({ mode: "list" })}
        onEdit={() => setView({ mode: "upsert", exportSale: freshExportSale, returnTo: "show" })}
        onNew={() => void openNewExportSale()}
        onPrint={() =>
          void navigate({ to: `${basePath}/${encodeURIComponent(freshExportSale.id)}/print` })
        }
        canEdit={canEditBillingEntry(
          freshExportSale.status,
          canEditEntries,
          canEditFinalizedEntries
        )}
        {...(previousExportSale
          ? { onPrevious: () => setView({ mode: "show", exportSale: previousExportSale }) }
          : {})}
        {...(nextExportSale
          ? { onNext: () => setView({ mode: "show", exportSale: nextExportSale }) }
          : {})}
      />
    );
  }

  if (view.mode === "upsert") {
    return (
      <ExportSalesForm
        errorMessage={saveMutation.error instanceof Error ? saveMutation.error.message : ""}
        loading={saveMutation.isPending}
        exportSale={view.exportSale}
        settings={exportSaleLayout}
        numbering={settings.numbering.exportSales}
        canAdminRevoke={canAdminRevoke}
        {...(view.exportSale && canAdminRevoke
          ? { onRevoke: () => revokeMutation.mutate(view.exportSale!.id) }
          : {})}
        onBack={() =>
          setView(
            view.returnTo === "show" && view.exportSale
              ? { mode: "show", exportSale: view.exportSale }
              : { mode: "list" }
          )
        }
        onSubmit={(payload, printAfter) => {
          saveMutation.mutate(view.exportSale ? { id: view.exportSale.id, payload } : { payload }, {
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
      title="Export Sales"
      description="Create and review tenant-isolated export sale vouchers with export sales layout controls."
      technicalName="page.billing.exportSale.list"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button className="h-9 rounded-md" onClick={() => void openNewExportSale()} type="button">
            <Plus className="size-4" />
            New export sale
          </Button>
        </div>
      }
    >
      <WorkspaceFilters
        showSelectedFilterChip
        filterOptions={statusFilters.map((option) => ({
          ...option,
          ...(option.id === statusFilter ? { count: exportSalesQuery.data?.total ?? 0 } : {})
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
        searchPlaceholder="Search export sale, customer, work order, date, or total"
        searchValue={searchValue}
        columnOptions={listTools.columnOptions.filter((column) =>
          exportSaleColumnCatalog.some((item) => item.id === column.id)
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-card px-4 py-3 text-sm shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="ml-1 min-w-64">
            <WorkspaceLookup
              options={[
                { label: "All contacts", value: "all" },
                ...contactOptions.map((option) => ({ label: option.label, value: option.id }))
              ]}
              placeholder="Search contact"
              value={contactFilter}
              onTextChange={(value) => {
                if (!value) {
                  setContactFilter("all");
                  setSelectedExportSaleIds(new Set());
                  setCurrentPage(1);
                }
              }}
              onValueChange={(value) => {
                setContactFilter(value || "all");
                setSelectedExportSaleIds(new Set());
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>{selectedEntries.length} selected</span>
          <Button
            className="h-8 rounded-md px-2"
            disabled={!selectedEntries.length}
            onClick={() => setSelectedExportSaleIds(new Set())}
            type="button"
            variant="ghost"
          >
            Clear
          </Button>
        </div>
      </div>
      {exportSalesQuery.isError ? (
        <WorkspaceTablePanel>
          <WorkspaceTableEmptyState>
            {exportSalesQuery.error instanceof Error
              ? exportSalesQuery.error.message
              : "Export sales could not be loaded."}
          </WorkspaceTableEmptyState>
        </WorkspaceTablePanel>
      ) : null}
      <ExportSalesList
        listTools={listTools}
        entries={pageEntries}
        loading={exportSalesQuery.isLoading}
        totalsRecords={pageEntries.map((exportSale) => ({
          amount: exportSale.amount,
          date: exportSale.issuedOn,
          documentNumber: exportSale.invoiceNumber,
          partyName: exportSale.customerName,
          subtotal: exportSale.subtotal,
          taxAmount: exportSale.taxAmount
        }))}
        totalsView={totalsView}
        onEdit={(exportSale) => setView({ mode: "upsert", exportSale, returnTo: "list" })}
        onSetStatus={(exportSale, status) => statusMutation.mutate({ id: exportSale.id, status })}
        onForceDelete={(exportSale) => {
          if (window.confirm(`Force delete ${exportSale.invoiceNumber}? This cannot be undone.`))
            deleteMutation.mutate(exportSale.id);
        }}
        onRevoke={(exportSale) => revokeMutation.mutate(exportSale.id)}
        onPrint={(exportSale) =>
          void navigate({ to: `${basePath}/${encodeURIComponent(exportSale.id)}/print` })
        }
        canAdminRevoke={canAdminRevoke}
        canEditEntries={canEditEntries}
        canEditFinalizedEntries={canEditFinalizedEntries}
        onView={(exportSale) => setView({ mode: "show", exportSale })}
        page={currentPage}
        rowsPerPage={rowsPerPage}
        pageSelected={pageSelected}
        pageSelectableCount={pageSelectableEntries.length}
        selectedExportSaleIds={selectedExportSaleIds}
        onTogglePageSelection={togglePageSelection}
        onToggleSelection={toggleExportSaleSelection}
        visibleColumns={visibleColumns}
      />
      <ExportSalePageTotals
        amount={pageTotals.amount}
        quantity={pageTotals.quantity}
        subtotal={pageTotals.subtotal}
        taxAmount={pageTotals.taxAmount}
      />
      <WorkspacePagination
        page={currentPage}
        rowsPerPage={rowsPerPage}
        showingLabel={buildShowingLabel(currentPage, rowsPerPage, totalCount)}
        singularLabel="export sales"
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

function ExportSalePageTotals({
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

function exportSaleContactKey(exportSale: ExportSale) {
  return exportSale.customerName.trim().toLowerCase();
}

function buildExportSaleContactFilterOptions(entries: ExportSale[]) {
  const byKey = new Map<string, string>();
  for (const exportSale of entries) {
    const key = exportSaleContactKey(exportSale);
    if (!byKey.has(key)) byKey.set(key, exportSale.customerName || key);
  }
  return Array.from(byKey, ([id, label]) => ({ id, label })).sort((left, right) =>
    left.label.localeCompare(right.label)
  );
}
