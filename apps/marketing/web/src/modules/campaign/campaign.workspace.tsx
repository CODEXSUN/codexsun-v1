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
import { useCampaigns, useCampaignDetail } from "./campaign.hooks";
import { createCampaign, updateCampaign, countCampaigns, duplicateCampaign } from "./campaign.services";
import { CampaignList } from "./campaign.list";
import { CampaignForm } from "./campaign.form";
import { CampaignShow } from "./campaign.show";
import type { CampaignColumnFilters, CampaignInput, CampaignRecord } from "./campaign.types";

const columnOptions = [
  { id: "name", label: "Name" },
  { id: "brandUuid", label: "Brand" },
  { id: "channel", label: "Channel" },
  { id: "objective", label: "Objective" },
  { id: "updatedAt", label: "Updated at" },
  { id: "status", label: "Status" }
];

export function CampaignWorkspace() {
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
  const [columnFilters, setColumnFilters] = useState<CampaignColumnFilters>({});
  const deferredSearch = useDeferredValue(search);
  const deferredColumnFilters = useDeferredValue(columnFilters);

  const query = useCampaigns(deferredSearch.trim(), page, status, pageSize);
  const count = useQuery({
    queryKey: ["marketing", api.scopeKey, "campaign-count", deferredSearch.trim(), status],
    queryFn: () => countCampaigns(api, deferredSearch.trim(), status)
  });

  const detail = useCampaignDetail(showKey || recordKey || null);

  const [editingLocal, setEditingLocal] = useState<CampaignRecord | null | undefined>(undefined);
  const [showingLocal, setShowingLocal] = useState<string | null>(null);

  const editing: CampaignRecord | null | undefined =
    formMode === "new"
      ? null
      : formMode === "edit"
        ? (editingLocal ?? detail.data ?? null)
        : editingLocal;

  const showing: string | null = showKey || showingLocal;

  const save = useMutation({
    mutationFn: (input: CampaignInput) =>
      editing
        ? updateCampaign(api, editing.uuid, { ...input, expectedRevision: editing.revision })
        : createCampaign(api, input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["marketing", api.scopeKey] });
      setEditingLocal(undefined);
      setFormMode("");
      setRecordKey("");
      toast.success(editing ? "Campaign updated successfully." : "Campaign created successfully.");
    },
    onError: (error) => toast.error("Unable to save campaign", { description: error.message })
  });

  const duplicate = useMutation({
    mutationFn: ({ uuid, name }: { uuid: string; name: string }) =>
      duplicateCampaign(api, uuid, name),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["marketing", api.scopeKey] });
      toast.success("Inactive campaign copy created.");
    },
    onError: (error) => toast.error("Unable to duplicate", { description: error.message })
  });

  const toggle = useMutation({
    mutationFn: (record: CampaignRecord) =>
      updateCampaign(api, record.uuid, {
        expectedRevision: record.revision,
        brandUuid: record.brandUuid,
        name: record.name,
        objective: record.objective,
        channel: record.channel,
        landingUrl: record.landingUrl,
        status: record.status === "active" ? "inactive" : "active"
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["marketing", api.scopeKey] });
      toast.success("Campaign status updated.");
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
        if (deferredColumnFilters.brandUuid && !item.brandUuid.toLowerCase().includes(deferredColumnFilters.brandUuid.toLowerCase())) {
          return false;
        }
        if (deferredColumnFilters.channel && !item.channel.toLowerCase().includes(deferredColumnFilters.channel.toLowerCase())) {
          return false;
        }
        if (deferredColumnFilters.objective && !item.objective.toLowerCase().includes(deferredColumnFilters.objective.toLowerCase())) {
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
      <CampaignForm
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
      <CampaignShow
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
      technicalName="page.marketing.campaign.list"
      actions={
        <Button
          onClick={() => {
            save.reset();
            setEditingLocal(null);
            setFormMode("new");
          }}
        >
          New Campaign
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
                delete next[column.id as keyof CampaignColumnFilters];
                return next;
              });
              setQueryParams((prev) => ({ ...prev, page: 1 }));
            }
          }
        }))}
        onShowAllColumns={() => setHiddenColumnKeys("")}
        searchPlaceholder="Search campaigns"
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

      <CampaignList
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
        onDuplicate={(record) => {
          const name = window.prompt("Name for the inactive copy", `Copy of ${record.name}`);
          if (name?.trim()) duplicate.mutate({ uuid: record.uuid, name: name.trim() });
        }}
      />

      <WorkspacePagination
        page={currentPage}
        rowsPerPage={pageSize}
        rowsPerPageOptions={[20, 50, 100]}
        showingLabel={buildShowingLabel(currentPage, pageSize, total)}
        singularLabel="campaign"
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
