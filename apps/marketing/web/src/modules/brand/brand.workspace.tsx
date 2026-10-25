import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { WorkspacePagination } from "@codexsun/ui/workspace/pagination";
import { WorkspaceDateRangePicker } from "@codexsun/ui/workspace/date-range-picker";
import { buildShowingLabel } from "@codexsun/ui/workspace/utils";
import {
  useWorkspaceQueryState,
  useWorkspaceQueryValue
} from "@codexsun/ui/workspace/navigation";
import { useMarketingTransport } from "../../transport";
import { useBrands, useBrandDetail } from "./brand.hooks";
import { createBrand, updateBrand, countBrands } from "./brand.services";
import { BrandList } from "./brand.list";
import { BrandForm } from "./brand.form";
import { BrandShow } from "./brand.show";
import type { BrandColumnFilters, BrandInput, BrandRecord } from "./brand.types";

const columnOptions = [
  { id: "name", label: "Name" },
  { id: "timezone", label: "Timezone" },
  { id: "website", label: "Website" },
  { id: "updatedBy", label: "Updated by" },
  { id: "updatedAt", label: "Updated at" },
  { id: "status", label: "Status" }
];

export function BrandWorkspace() {
  const api = useMarketingTransport();
  const client = useQueryClient();

  const [queryParams, setQueryParams] = useWorkspaceQueryState({
    search: "",
    status: "all",
    page: 1,
    pageSize: 50,
    fromDate: "",
    toDate: ""
  });

  const { search, status, page, pageSize, fromDate, toDate } = queryParams;

  const [showKey, setShowKey] = useWorkspaceQueryValue("show", "");
  const [formMode, setFormMode] = useWorkspaceQueryValue("form", "");
  const [recordKey, setRecordKey] = useWorkspaceQueryValue("record", "");
  const [hiddenColumnKeys, setHiddenColumnKeys] = useWorkspaceQueryValue("hiddenColumns", "");

  const hiddenColumns = useMemo(
    () => hiddenColumnKeys.split(",").filter(Boolean),
    [hiddenColumnKeys]
  );
  const visibleColumns = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const opt of columnOptions) {
      map[opt.id] = !hiddenColumns.includes(opt.id);
    }
    return map;
  }, [hiddenColumns]);

  const [showInlineFilters, setShowInlineFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState<BrandColumnFilters>({});
  const deferredSearch = useDeferredValue(search);
  const deferredColumnFilters = useDeferredValue(columnFilters);

  const query = useBrands(deferredSearch.trim(), page, status, pageSize);
  const count = useQuery({
    queryKey: ["marketing", api.scopeKey, "brand-count", deferredSearch.trim(), status],
    queryFn: () => countBrands(api, deferredSearch.trim(), status)
  });

  const detail = useBrandDetail(showKey || recordKey || null);

  const [editingLocal, setEditingLocal] = useState<BrandRecord | null | undefined>(undefined);
  const [showingLocal, setShowingLocal] = useState<string | null>(null);

  const editing: BrandRecord | null | undefined =
    formMode === "new"
      ? null
      : formMode === "edit"
        ? (editingLocal ?? detail.data ?? null)
        : editingLocal;

  const showing: string | null = showKey || showingLocal;

  const save = useMutation({
    mutationFn: (input: BrandInput) =>
      editing
        ? updateBrand(api, editing.uuid, { ...input, expectedRevision: editing.revision })
        : createBrand(api, input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["marketing", api.scopeKey] });
      setEditingLocal(undefined);
      setFormMode("");
      setRecordKey("");
      toast.success(editing ? "Brand updated successfully." : "Brand created successfully.");
    },
    onError: (error) => toast.error("Unable to save brand", { description: error.message })
  });

  const toggle = useMutation({
    mutationFn: (record: BrandRecord) =>
      updateBrand(api, record.uuid, {
        expectedRevision: record.revision,
        name: record.name,
        timezone: record.timezone,
        website: record.website,
        status: record.status === "active" ? "inactive" : "active"
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["marketing", api.scopeKey] });
      toast.success("Brand status updated.");
    },
    onError: (error) => toast.error(error.message)
  });

  const activeColumnFilters = Object.values(columnFilters).filter((value) => value?.trim()).length;

  const filteredRecords = useMemo(() => {
    let items = query.data ?? [];
    if (fromDate || toDate) {
      items = items.filter((item) => {
        const itemDate = item.updatedAt.slice(0, 10);
        if (fromDate && itemDate < fromDate) return false;
        if (toDate && itemDate > toDate) return false;
        return true;
      });
    }
    if (activeColumnFilters > 0) {
      items = items.filter((item) => {
        if (deferredColumnFilters.name && !item.name.toLowerCase().includes(deferredColumnFilters.name.toLowerCase())) {
          return false;
        }
        if (deferredColumnFilters.timezone && !item.timezone.toLowerCase().includes(deferredColumnFilters.timezone.toLowerCase())) {
          return false;
        }
        if (deferredColumnFilters.website && !item.website.toLowerCase().includes(deferredColumnFilters.website.toLowerCase())) {
          return false;
        }
        if (deferredColumnFilters.updatedBy && !(item.updatedBy || item.createdBy || "").toLowerCase().includes(deferredColumnFilters.updatedBy.toLowerCase())) {
          return false;
        }
        if (deferredColumnFilters.status && !item.status.toLowerCase().includes(deferredColumnFilters.status.toLowerCase())) {
          return false;
        }
        return true;
      });
    }
    return items;
  }, [query.data, fromDate, toDate, activeColumnFilters, deferredColumnFilters]);

  const total = count.data?.total ?? filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  if (editing !== undefined) {
    return (
      <BrandForm
        key={editing?.uuid ?? "new"}
        record={editing}
        pending={save.isPending}
        error={save.error?.message ?? ""}
        onCancel={() => {
          save.reset();
          setEditingLocal(undefined);
          setFormMode("");
          setRecordKey("");
        }}
        onSubmit={(value) => save.mutate(value)}
      />
    );
  }

  if (showing !== null) {
    return (
      <BrandShow
        uuid={showing}
        initialRecord={detail.data}
        onBack={() => {
          setShowingLocal(null);
          setShowKey("");
        }}
        onEdit={(record) => {
          setShowingLocal(null);
          setShowKey("");
          setEditingLocal(record);
          setFormMode("edit");
          setRecordKey(record.uuid);
        }}
        onToggleStatus={(record) => toggle.mutate(record)}
      />
    );
  }

  return (
    <WorkspacePage
      variant="list"
      title=""
      technicalName="page.marketing.brand.list"
      actions={
        <Button
          onClick={() => {
            save.reset();
            setEditingLocal(null);
            setFormMode("new");
          }}
        >
          New Brand
        </Button>
      }
    >
      <WorkspaceFilters
        toolbarAction={
          <>
            <WorkspaceDateRangePicker
              fromDate={fromDate}
              toDate={toDate}
              onValueChange={(val) => {
                setQueryParams((prev) => ({ ...prev, fromDate: val.fromDate, toDate: val.toDate, page: 1 }));
              }}
            />
            <Button
              aria-label="Toggle column search filters"
              aria-pressed={showInlineFilters}
              className="h-8 min-w-8 gap-1 px-2"
              title="Toggle column search filters"
              type="button"
              variant={showInlineFilters ? "default" : "outline"}
              onClick={() => setShowInlineFilters((prev) => !prev)}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {activeColumnFilters > 0 ? (
                <span className="text-xs">{activeColumnFilters}</span>
              ) : null}
            </Button>
          </>
        }
        columnOptions={columnOptions.map((column) => ({
          ...column,
          checked: visibleColumns[column.id] !== false,
          onCheckedChange: (checked) => {
            setHiddenColumnKeys((prev) => {
              const current = prev.split(",").filter(Boolean);
              const next = checked ? current.filter((id) => id !== column.id) : [...current, column.id];
              return next.join(",");
            });
            if (!checked) {
              setColumnFilters((prev) => {
                const next = { ...prev };
                delete next[column.id as keyof BrandColumnFilters];
                return next;
              });
              setQueryParams((prev) => ({ ...prev, page: 1 }));
            }
          }
        }))}
        onShowAllColumns={() => setHiddenColumnKeys("")}
        searchPlaceholder="Search brands"
        searchValue={search}
        onSearchValueChange={(value) => {
          setQueryParams((prev) => ({ ...prev, search: value, page: 1 }));
        }}
        filterValue={status}
        showSelectedFilterChip={true}
        onFilterValueChange={(nextStatus) => {
          setQueryParams((prev) => ({ ...prev, status: nextStatus, page: 1 }));
        }}
        filterOptions={[
          { id: "all", label: "All statuses" },
          { id: "active", label: "Active" },
          { id: "inactive", label: "Inactive" }
        ]}
      />

      {query.error ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : null}

      <BrandList
        records={filteredRecords}
        loading={query.isLoading}
        visibleColumns={visibleColumns}
        showInlineFilters={showInlineFilters}
        columnFilters={columnFilters}
        onColumnFilterChange={(col, val) => {
          setColumnFilters((prev) => ({ ...prev, [col]: val }));
          setQueryParams((prev) => ({ ...prev, page: 1 }));
        }}
        onHideInlineFilters={() => setShowInlineFilters(false)}
        onView={(record) => {
          setShowingLocal(record.uuid);
          setShowKey(record.uuid);
        }}
        onEdit={(record) => {
          save.reset();
          setEditingLocal(record);
          setFormMode("edit");
          setRecordKey(record.uuid);
        }}
        onToggle={(record) => toggle.mutate(record)}
      />

      <WorkspacePagination
        page={currentPage}
        rowsPerPage={pageSize}
        rowsPerPageOptions={[20, 50, 100]}
        showingLabel={buildShowingLabel(currentPage, pageSize, total)}
        singularLabel="brand"
        totalCount={total}
        totalPages={totalPages}
        onNextPage={() => setQueryParams((prev) => ({ ...prev, page: Math.min(totalPages, currentPage + 1) }))}
        onPageChange={(next) => setQueryParams((prev) => ({ ...prev, page: next }))}
        onPreviousPage={() => setQueryParams((prev) => ({ ...prev, page: Math.max(1, currentPage - 1) }))}
        onRowsPerPageChange={(nextSize) => {
          setQueryParams((prev) => ({ ...prev, pageSize: nextSize, page: 1 }));
        }}
      />
    </WorkspacePage>
  );
}
