import { useWorkspaceQueryValue } from "@codexsun/ui/workspace/navigation";
import { useWorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import { useEffect, useMemo, useState, type SetStateAction } from "react";
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
import { useBillingSettings } from "../settings";
import { defaultBillingSettings } from "../settings/settings.types";
import { type Purchase, type PurchaseSavePayload, type PurchaseView } from "./purchase.types";
import { PurchaseShowPage } from "./purchase.show";
import {
  createPurchase,
  convertPurchaseToSale,
  convertPurchasesToSale,
  deletePurchase,
  formatMoney,
  getPurchase,
  setPurchaseStatus,
  revokePurchase,
  totalPurchaseQuantity,
  updatePurchase
} from "./purchase.services";
import { usePurchasePage } from "./purchase.hooks";
import { PurchaseForm } from "./purchase.form";
import { canSelectPurchase, PurchaseList } from "./purchase.list";
import { canEditBillingEntry, useBillingAccess } from "../../shared/auth/billing-access";
import {
  BillingDocumentListControls,
  type BillingDocumentTotalsViewMode
} from "../../shared/document/document-totals-report";

const statusFilters = [
  { id: "all", label: "All purchase" },
  { id: "draft", label: "Draft" },
  { id: "confirmed", label: "Confirmed" },
  { id: "cancelled", label: "Cancelled" }
];

const purchaseColumnCatalog = [
  { id: "issuedOn", label: "Date" },
  { id: "supplier", label: "Supplier" },
  { id: "items", label: "QTY" },
  { id: "taxable", label: "Taxable" },
  { id: "gst", label: "GST" },
  { id: "total", label: "Total" },
  { id: "status", label: "Status" },
  { id: "invoice", label: "Invoice" },
  { id: "action", label: "Action" }
] as const;

export function PurchaseWorkspace({ initialRecordId }: { initialRecordId?: string | undefined }) {
  const queryClient = useQueryClient();
  const settingsQuery = useBillingSettings();
  const settings = settingsQuery.data ?? defaultBillingSettings;
  const purchaseLayout = settings.layout;
  const accessQuery = useBillingAccess();
  const canEditEntries = accessQuery.data?.canEditEntries ?? false;
  const canEditFinalizedEntries = accessQuery.data?.canEditFinalizedEntries ?? false;
  const canAdminRevoke = canEditFinalizedEntries;
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setLocalView] = useState<PurchaseView>({ mode: "list" });
  const basePath = `${location.pathname.startsWith("/app/") ? "/app" : ""}/billing/purchase`;
  function setView(update: SetStateAction<PurchaseView>) {
    const next = typeof update === "function" ? update(view) : update;
    setLocalView(next);
    const record = next.mode === "list" ? null : next.purchase;
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
      setLocalView({ mode: "upsert", purchase: null, returnTo: "list" });
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
    void getPurchase(id)
      .then((purchase) => {
        if (!active) return;
        setLocalView(
          tail[1] === "edit"
            ? { mode: "upsert", purchase, returnTo: "show" }
            : { mode: "show", purchase }
        );
      })
      .catch((error) => {
        if (active)
          toast.error("Purchase could not be opened", {
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
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<Set<string>>(() => new Set());
  const listTools = useWorkspaceListTools({
    number: "Purchase",
    date: "Date",
    ...Object.fromEntries(purchaseColumnCatalog.map((column) => [column.id, column.label]))
  });
  const visibleColumns = Object.fromEntries(
    purchaseColumnCatalog.map((column) => [column.id, !listTools.hidden.includes(column.id)])
  );
  const [currentPage, setCurrentPage] = useWorkspaceQueryValue("page", 1);
  const [rowsPerPage, setRowsPerPage] = useWorkspaceQueryValue("pageSize", 100);
  const purchasesQuery = usePurchasePage({
    numberSearch: listTools.filters.number ?? "",
    dateSearch: listTools.filters.issuedOn ?? "",
    partySearch: listTools.filters.supplier ?? "",
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

  useEffect(() => {
    if (!initialRecordId) return;
    let active = true;
    void getPurchase(initialRecordId)
      .then((purchase) => {
        if (active) setView({ mode: "show", purchase });
      })
      .catch((error) => {
        if (active)
          toast.error("Purchase could not be opened", {
            description: error instanceof Error ? error.message : "Please try again."
          });
      });
    return () => {
      active = false;
    };
  }, [initialRecordId]);

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: PurchaseSavePayload }) =>
      id ? updatePurchase(id, payload) : createPurchase(payload),
    onSuccess: async (purchase) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["billing", "purchases"] }),
        queryClient.invalidateQueries({ queryKey: ["billing", "settings"] }),
        queryClient.invalidateQueries({ queryKey: ["billing", "document-settings"] })
      ]);
      toast.success(
        view.mode === "upsert" && view.purchase ? "Purchase updated" : "Purchase created",
        {
          description: `${purchase.invoiceNumber} is ready.`
        }
      );
      setView({ mode: "show", purchase });
    },
    onError: (error) => {
      toast.error("Purchase save failed", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "cancelled" | "confirmed" }) =>
      setPurchaseStatus(id, status),
    onSuccess: async (purchase) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", "purchases"] });
      toast.success("Purchase status updated", {
        description: `${purchase.invoiceNumber} is now ${purchase.status}.`
      });
      setView((current) => (current.mode === "show" ? { mode: "show", purchase } : current));
    },
    onError: (error) => {
      toast.error("Status update failed", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokePurchase(id),
    onSuccess: async (purchase) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", "purchases"] });
      toast.success("Purchase revoked", {
        description: `${purchase.invoiceNumber} is editable again.`
      });
    },
    onError: (error) => {
      toast.error("Purchase revoke failed", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePurchase(id),
    onSuccess: async (purchase) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", "purchases"] });
      toast.success("Purchase deleted", { description: purchase.invoiceNumber });
    },
    onError: (error) => {
      toast.error("Purchase could not be deleted", {
        description: error instanceof Error ? error.message : "Only draft purchases can be deleted."
      });
    }
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => convertPurchaseToSale(id),
    onSuccess: async ({ purchase, sale }) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", "purchases"] });
      toast.success("Purchase converted", {
        description: `${purchase.invoiceNumber} created sales invoice ${sale.invoiceNumber}.`
      });
    },
    onError: (error) => {
      toast.error("Purchase conversion failed", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  });

  const batchConvertMutation = useMutation({
    mutationFn: (ids: string[]) => convertPurchasesToSale(ids),
    onSuccess: async ({ sale }) => {
      await queryClient.invalidateQueries({ queryKey: ["billing", "purchases"] });
      setSelectedPurchaseIds(new Set());
      toast.success("Draft sales invoice generated", { description: sale.invoiceNumber });
    },
    onError: (error) => {
      toast.error("Invoice generation failed", {
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  });

  const entries = purchasesQuery.data?.items ?? [];
  const totalCount = purchasesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const pageEntries = entries;
  const pageTotals = useMemo(
    () =>
      pageEntries.reduce(
        (totals, purchase) => ({
          amount: totals.amount + purchase.amount,
          quantity: totals.quantity + totalPurchaseQuantity(purchase),
          subtotal: totals.subtotal + purchase.subtotal,
          taxAmount: totals.taxAmount + purchase.taxAmount
        }),
        { amount: 0, quantity: 0, subtotal: 0, taxAmount: 0 }
      ),
    [pageEntries]
  );
  const selectedEntries = useMemo(
    () => entries.filter((purchase) => selectedPurchaseIds.has(purchase.id)),
    [entries, selectedPurchaseIds]
  );
  const pageSelectableEntries = pageEntries.filter(canSelectPurchase);
  const pageSelected =
    pageSelectableEntries.length > 0 &&
    pageSelectableEntries.every((purchase) => selectedPurchaseIds.has(purchase.id));

  useEffect(() => {
    setSelectedPurchaseIds((current) => {
      const available = new Set(entries.map((purchase) => purchase.id));
      const next = new Set(Array.from(current).filter((id) => available.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [entries]);

  function togglePurchaseSelection(purchase: Purchase, checked: boolean) {
    if (!canSelectPurchase(purchase)) return;
    setSelectedPurchaseIds((current) => {
      const next = new Set(current);
      if (checked) next.add(purchase.id);
      else next.delete(purchase.id);
      return next;
    });
  }

  function togglePageSelection(checked: boolean) {
    setSelectedPurchaseIds((current) => {
      const next = new Set(current);
      for (const purchase of pageSelectableEntries) {
        if (checked) next.add(purchase.id);
        else next.delete(purchase.id);
      }
      return next;
    });
  }

  function generateInvoice() {
    if (!selectedEntries.length) {
      toast.error("Select at least one purchase.");
      return;
    }
    const contact = purchaseContactKey(selectedEntries[0]!);
    if (selectedEntries.some((purchase) => purchaseContactKey(purchase) !== contact)) {
      toast.error("Selected purchases must belong to the same supplier.");
      return;
    }
    if (selectedEntries.length === 1) {
      convertMutation.mutate(selectedEntries[0]!.id);
      return;
    }
    batchConvertMutation.mutate(selectedEntries.map((purchase) => purchase.id));
  }

  if (view.mode === "show") {
    const freshPurchase = entries.find((entry) => entry.id === view.purchase.id) ?? view.purchase;
    const currentIndex = entries.findIndex((entry) => entry.id === freshPurchase.id);
    const previousPurchase = currentIndex > 0 ? entries[currentIndex - 1] : null;
    const nextPurchase =
      currentIndex >= 0 && currentIndex < entries.length - 1 ? entries[currentIndex + 1] : null;
    return (
      <PurchaseShowPage
        purchase={freshPurchase}
        onBack={() => setView({ mode: "list" })}
        onEdit={() => setView({ mode: "upsert", purchase: freshPurchase, returnTo: "show" })}
        onNew={() => setView({ mode: "upsert", purchase: null, returnTo: "list" })}
        onPrint={() =>
          void navigate({ to: `${basePath}/${encodeURIComponent(freshPurchase.id)}/print` })
        }
        canEdit={canEditBillingEntry(freshPurchase.status, canEditEntries, canEditFinalizedEntries)}
        {...(previousPurchase
          ? { onPrevious: () => setView({ mode: "show", purchase: previousPurchase }) }
          : {})}
        {...(nextPurchase
          ? { onNext: () => setView({ mode: "show", purchase: nextPurchase }) }
          : {})}
      />
    );
  }

  if (view.mode === "upsert") {
    return (
      <PurchaseForm
        errorMessage={saveMutation.error instanceof Error ? saveMutation.error.message : ""}
        loading={saveMutation.isPending}
        purchase={view.purchase}
        settings={purchaseLayout}
        numbering={settings.numbering.purchase}
        canAdminRevoke={canAdminRevoke}
        {...(view.purchase && canAdminRevoke
          ? { onRevoke: () => revokeMutation.mutate(view.purchase!.id) }
          : {})}
        onBack={() =>
          setView(
            view.returnTo === "show" && view.purchase
              ? { mode: "show", purchase: view.purchase }
              : { mode: "list" }
          )
        }
        onSubmit={(payload, printAfter) => {
          saveMutation.mutate(view.purchase ? { id: view.purchase.id, payload } : { payload }, {
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
      title="Purchases"
      description="Create and review tenant-isolated purchase vouchers with sales layout controls."
      technicalName="page.billing.purchase.list"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="h-9 rounded-md"
            disabled={
              !selectedEntries.length || convertMutation.isPending || batchConvertMutation.isPending
            }
            onClick={generateInvoice}
            type="button"
            variant="secondary"
          >
            <Send className="size-4" />
            Generate invoice{selectedEntries.length ? ` (${selectedEntries.length})` : ""}
          </Button>

          <Button
            className="h-9 rounded-md"
            onClick={() => setView({ mode: "upsert", purchase: null, returnTo: "list" })}
            type="button"
          >
            <Plus className="size-4" />
            New purchase
          </Button>
        </div>
      }
    >
      <WorkspaceFilters
        showSelectedFilterChip
        filterOptions={statusFilters.map((option) => ({
          ...option,
          ...(option.id === statusFilter ? { count: purchasesQuery.data?.total ?? 0 } : {})
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
        searchPlaceholder="Search purchase, supplier, work order, date, or total"
        searchValue={searchValue}
        columnOptions={listTools.columnOptions.filter((column) =>
          purchaseColumnCatalog.some((item) => item.id === column.id)
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
      {purchasesQuery.isError ? (
        <WorkspaceTablePanel>
          <WorkspaceTableEmptyState>
            {purchasesQuery.error instanceof Error
              ? purchasesQuery.error.message
              : "Purchases could not be loaded."}
          </WorkspaceTableEmptyState>
        </WorkspaceTablePanel>
      ) : null}
      <PurchaseList
        listTools={listTools}
        entries={pageEntries}
        loading={purchasesQuery.isLoading}
        totalsRecords={pageEntries.map((purchase) => ({
          amount: purchase.amount,
          date: purchase.issuedOn,
          documentNumber: purchase.invoiceNumber,
          partyName: purchase.supplierName,
          subtotal: purchase.subtotal,
          taxAmount: purchase.taxAmount
        }))}
        totalsView={totalsView}
        onEdit={(purchase) => setView({ mode: "upsert", purchase, returnTo: "list" })}
        onSetStatus={(purchase, status) => statusMutation.mutate({ id: purchase.id, status })}
        onForceDelete={(purchase) => {
          if (window.confirm(`Force delete ${purchase.invoiceNumber}? This cannot be undone.`))
            deleteMutation.mutate(purchase.id);
        }}
        onRevoke={(purchase) => revokeMutation.mutate(purchase.id)}
        onPrint={(purchase) =>
          void navigate({ to: `${basePath}/${encodeURIComponent(purchase.id)}/print` })
        }
        canAdminRevoke={canAdminRevoke}
        canEditEntries={canEditEntries}
        canEditFinalizedEntries={canEditFinalizedEntries}
        onView={(purchase) => setView({ mode: "show", purchase })}
        page={currentPage}
        rowsPerPage={rowsPerPage}
        pageSelected={pageSelected}
        pageSelectableCount={pageSelectableEntries.length}
        selectedPurchaseIds={selectedPurchaseIds}
        onTogglePageSelection={togglePageSelection}
        onToggleSelection={togglePurchaseSelection}
        visibleColumns={visibleColumns}
      />
      <PurchasePageTotals
        amount={pageTotals.amount}
        quantity={pageTotals.quantity}
        subtotal={pageTotals.subtotal}
        taxAmount={pageTotals.taxAmount}
      />
      <WorkspacePagination
        page={currentPage}
        rowsPerPage={rowsPerPage}
        showingLabel={buildShowingLabel(currentPage, rowsPerPage, totalCount)}
        singularLabel="purchases"
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

function PurchasePageTotals({
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

function purchaseContactKey(purchase: Purchase) {
  return purchase.supplierName.trim().toLowerCase();
}
