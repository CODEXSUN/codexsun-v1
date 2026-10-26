import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useWorkspaceNavigation, useWorkspaceQueryValue } from "@codexsun/ui/workspace/navigation";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { WorkspacePagination } from "@codexsun/ui/workspace/pagination";
import { Button } from "@codexsun/ui/components/button";
import { PlusIcon, SlidersHorizontal } from "lucide-react";
import { WorkspaceDateRangePicker } from "@codexsun/ui/workspace/date-range-picker";
import { useLeadPage, useLead, useLeadOptions } from "./lead.hooks";
import { LeadList } from "./lead.list";
import { LeadShow } from "./lead.show";
import { LeadForm } from "./lead.form";
import { convertLead, saveLead } from "./lead.services";
import {
  leadStatusLabels,
  type LeadInput,
  type LeadRecord,
  type LeadColumnFilters
} from "./lead.types";
import { buildLeadFilters, isLeadFilterColumn } from "./lead.filters";
import { leadDetailQueryKey, leadQueryScope, useLeadQueryScope } from "./lead.query-scope";

const columns = [
  { id: "name", label: "Contact" },
  { id: "phone", label: "Mobile" },
  { id: "message", label: "Enquiry details" },
  { id: "campaignLabel", label: "Campaign" },
  { id: "conversion", label: "Convert to enquiry" },
  { id: "status", label: "Status" }
];

export function LeadWorkspace() {
  const client = useQueryClient();
  const scope = useLeadQueryScope();
  const previousScope = useRef(scope);
  const [uuid, setUuid] = useWorkspaceQueryValue("show", "");
  const [editing, setEditing] = useState<LeadRecord | null | undefined>(undefined);
  const navigation = useWorkspaceNavigation();
  const updateSearch = navigation?.updateSearch;
  useEffect(() => {
    updateSearch?.({ form: editing === undefined ? "" : editing === null ? "new" : "edit" });
  }, [editing]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [dateRange, setDateRange] = useState({ fromDate: "", toDate: "" });
  const [showColumnFilters, setShowColumnFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState<LeadColumnFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({});
  const query = useLeadPage(
    buildLeadFilters(
      { search: useDeferredValue(search), status, page, pageSize },
      dateRange,
      useDeferredValue(columnFilters)
    )
  );
  const activeColumnFilters = Object.values(columnFilters).filter((value) => value?.trim()).length;
  const detail = useLead(uuid);
  const options = useLeadOptions();
  const capabilities = options.data ?? { canCreate: false, canUpdate: false, canConvert: false };
  const refresh = async (record: LeadRecord) => {
    client.setQueryData(leadDetailQueryKey(record.uuid), record);
    await Promise.all([
      client.invalidateQueries({ queryKey: ["crm", "leads"] }),
      client.invalidateQueries({ queryKey: [...leadDetailQueryKey(record.uuid), "activity"] }),
      client.invalidateQueries({ queryKey: ["crm", "enquiries"] })
    ]);
  };
  const save = useMutation({
    mutationFn: async (input: LeadInput) => {
      const scope = leadQueryScope();
      return { record: await saveLead(input, editing?.uuid), scope };
    },
    onSuccess: async ({ record, scope }) => {
      if (scope !== leadQueryScope()) return;
      await refresh(record);
      if (scope !== leadQueryScope()) return;
      setEditing(undefined);
      setUuid(record.uuid);
      toast.success("Lead saved.");
    }
  });
  const convert = useMutation({
    mutationFn: async (record: LeadRecord) => {
      const scope = leadQueryScope();
      return { record: await convertLead(record.uuid), scope };
    },
    onSuccess: async ({ record, scope }) => {
      if (scope !== leadQueryScope()) return;
      await refresh(record);
      if (scope !== leadQueryScope()) return;
      setUuid(record.uuid);
      toast.success("Lead converted to enquiry.");
    }
  });
  useEffect(() => {
    if (previousScope.current === scope) return;
    previousScope.current = scope;
    setUuid("");
    setEditing(undefined);
    setPage(1);
    setSearch("");
    setColumnFilters({});
    setDateRange({ fromDate: "", toDate: "" });
    setStatus("active");
    save.reset();
    convert.reset();
  }, [scope]);
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (query.data && page > totalPages) setPage(totalPages);
  }, [query.data, page, totalPages]);
  const edit = (record: LeadRecord | null) => {
    save.reset();
    convert.reset();
    setEditing(record);
  };
  if (editing !== undefined)
    return (
      <LeadForm
        key={editing?.uuid ?? "new"}
        record={editing}
        saving={save.isPending}
        error={save.error?.message ?? ""}
        onBack={() => setEditing(undefined)}
        onSubmit={(input) => save.mutate(input)}
      />
    );
  if (uuid && detail.data)
    return (
      <LeadShow
        record={detail.data}
        canEdit={capabilities.canUpdate}
        canConvert={capabilities.canConvert}
        converting={convert.isPending}
        error={convert.error?.message ?? ""}
        onClose={() => {
          setUuid("");
          convert.reset();
        }}
        onEdit={() => edit(detail.data)}
        onConvert={() => convert.mutate(detail.data)}
      />
    );
  return (
    <WorkspacePage
      variant="list"
      title="Leads"
      technicalName="page.crm.lead.list"
      actions={
        <>
          {capabilities.canCreate ? (
            <Button size="sm" className="h-7 px-3" onClick={() => edit(null)}>
              <PlusIcon className="size-4" />
              New lead
            </Button>
          ) : null}
          {uuid ? (
            <Button variant="outline" onClick={() => setUuid("")}>
              Back to leads
            </Button>
          ) : null}
        </>
      }
    >
      {query.error || detail.error || options.error || convert.error ? (
        <p role="alert" className="text-destructive">
          {query.error?.message ??
            detail.error?.message ??
            options.error?.message ??
            convert.error?.message}
        </p>
      ) : null}
      {uuid && detail.isLoading ? <p role="status">Loading lead…</p> : null}
      <WorkspaceFilters
        toolbarAction={
          <>
            <WorkspaceDateRangePicker
              {...dateRange}
              onValueChange={(value) => {
                setDateRange(value);
                setPage(1);
              }}
            />
            <Button
              aria-label="Toggle column search filters"
              aria-pressed={showColumnFilters}
              title="Toggle column search filters"
              className="h-8 min-w-8 gap-1 px-2"
              type="button"
              variant={showColumnFilters ? "default" : "outline"}
              onClick={() => setShowColumnFilters((value) => !value)}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {activeColumnFilters ? <span className="text-xs">{activeColumnFilters}</span> : null}
            </Button>
          </>
        }
        searchValue={search}
        searchPlaceholder="Search contact, mobile, details, or campaign"
        onSearchValueChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        filterValue={status}
        showSelectedFilterChip
        onFilterValueChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
        filterOptions={[
          { id: "all", label: "All leads" },
          {
            id: "active",
            label: "Active (except converted and lost)",
            ...(status === "active" ? { count: total } : {})
          },
          ...Object.entries(leadStatusLabels).map(([id, label]) => ({
            id,
            label,
            ...(status === id ? { count: total } : {})
          }))
        ]}
        columnOptions={columns.map((column) => ({
          ...column,
          checked: visibleColumns[column.id] !== false,
          onCheckedChange: (checked) => {
            setVisibleColumns((current) => ({ ...current, [column.id]: checked }));
            if (!checked && isLeadFilterColumn(column.id)) {
              setColumnFilters((current) => {
                const next = { ...current };
                delete next[column.id as keyof LeadColumnFilters];
                return next;
              });
              setPage(1);
            }
          }
        }))}
        onShowAllColumns={() => setVisibleColumns({})}
      />
      <LeadList
        records={query.data?.items ?? []}
        loading={query.isLoading}
        visibleColumns={visibleColumns}
        showColumnFilters={showColumnFilters}
        columnFilters={columnFilters}
        onColumnFilterChange={(key, value) => {
          setColumnFilters((current) => ({ ...current, [key]: value }));
          setPage(1);
        }}
        onHideColumnFilters={() => setShowColumnFilters(false)}
        canEdit={capabilities.canUpdate}
        canConvert={capabilities.canConvert}
        converting={convert.isPending}
        onView={(record) => {
          convert.reset();
          setUuid(record.uuid);
        }}
        onEdit={edit}
        onConvert={(record) => convert.mutate(record)}
      />
      <WorkspacePagination
        page={page}
        rowsPerPage={pageSize}
        rowsPerPageOptions={[10, 20, 50, 100]}
        totalCount={total}
        totalPages={totalPages}
        singularLabel="leads"
        showingLabel={
          total
            ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`
            : "No leads"
        }
        onPageChange={setPage}
        onPreviousPage={() => setPage((current) => Math.max(1, current - 1))}
        onNextPage={() => setPage((current) => Math.min(totalPages, current + 1))}
        onRowsPerPageChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      />
    </WorkspacePage>
  );
}
