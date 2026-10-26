import { useMemo, useState, useDeferredValue, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspacePagination } from "@codexsun/ui/workspace/pagination";
import { WorkspaceDateRangePicker } from "@codexsun/ui/workspace/date-range-picker";
import { buildShowingLabel } from "@codexsun/ui/workspace/utils";
import { EnquiryForm } from "./enquiry.form";
import {
  enquiriesQueryKey,
  enquiryDetailQueryKey,
  enquiryCommentsQueryKey,
  enquiryActivityQueryKey,
  enquiryAttentionQueryKey,
  enquiryContactsQueryKey,
  useEnquiryPage,
  useEnquiryContacts,
  useEnquiryOptions
} from "./enquiry.hooks";
import { EnquiryList } from "./enquiry.list";
import { EnquiryAttention } from "./enquiry.attention";
import { EnquiryShow } from "./enquiry.show";
import { createEnquiry, openNewEnquiryCall, updateEnquiry } from "./enquiry.services";
import { enquiryFilterOptions, type EnquiryScope } from "./enquiry.filters";
import type {
  EnquiryColumnFilters,
  EnquiryRecord,
  EnquiryReportFilters,
  EnquirySavePayload
} from "./enquiry.types";

const columnOptions = [
  { id: "customer", label: "Customer" },
  { id: "details", label: "Enquiry details" },
  { id: "listIn", label: "List in" },
  { id: "dueDate", label: "Due date" },
  { id: "priority", label: "Priority" },

  { id: "creator", label: "Creator" },
  { id: "assignedTo", label: "Assigned to" },
  { id: "status", label: "Status" }
];

export function EnquiryWorkspace(props: Parameters<typeof EnquiryPage>[0]) {
  return <EnquiryPage {...props} />;
}

function EnquiryPage({
  scope = "all",
  reportFilters,
  mobileFilter,
  onClearMobileFilter,
  onSeeMoreEnquiries,
  onOpenEnquiry,
  onBackToReports,
  initialRecordKey,
  onOpenRecord,
  initialCreate = false,
  onCloseCreate,
  onCancelCreate
}: {
  scope?: EnquiryScope;
  reportFilters?: EnquiryReportFilters | undefined;
  mobileFilter?: { mobile: string; contactId: number | null } | undefined;
  onClearMobileFilter?: () => void;
  onSeeMoreEnquiries?: ((mobile: string, contactId: number | null) => void) | undefined;
  onOpenEnquiry?: ((id: string, mobile: string, contactId: number | null) => void) | undefined;
  onBackToReports?: () => void;
  initialRecordKey?: string | undefined;
  onOpenRecord?: ((key: string) => void) | undefined;
  currentUserEmail?: string;
  initialCreate?: boolean;
  onCloseCreate?: () => void;
  onCancelCreate?: () => void;
}) {
  const client = useQueryClient();
  const [editing, setEditing] = useState<EnquiryRecord | null | undefined>(
    initialCreate ? null : undefined
  );
  const [showing, setShowing] = useState<string | null>(initialRecordKey ?? null);
  const showRecord = (key: string) => {
    setShowing(key);
    onOpenRecord?.(key);
  };
  const [search, setSearch] = useState("");
  const [showInlineFilters, setShowInlineFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState<EnquiryColumnFilters>({});
  const [dateRange, setDateRange] = useState({ fromDate: "", toDate: "" });
  const [status, setStatus] = useState(reportFilters?.filter ?? (mobileFilter ? "all" : "active"));
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({});
  const deferredSearch = useDeferredValue(search);
  const deferredColumnFilters = useDeferredValue(columnFilters);
  const query = useEnquiryPage({
    scope,
    page,
    pageSize: rowsPerPage,
    search: deferredSearch.trim(),
    ...(mobileFilter ? { mobile: mobileFilter.mobile } : {}),
    ...(mobileFilter?.contactId ? { contactId: mobileFilter.contactId } : {}),
    columnFilters: deferredColumnFilters,
    filter: status,
    reportFilters,
    dateRange
  });
  const contacts = useEnquiryContacts(editing !== undefined || showing !== null);
  const options = useEnquiryOptions();
  const users = { data: options.data?.users, error: options.error };
  const lists = { data: options.data?.lists, error: options.error };
  const statuses = { data: options.data?.statuses, error: options.error };
  const priorities = { data: options.data?.priorities, error: options.error };
  const filterOptions = useMemo(
    () => enquiryFilterOptions(query.data?.statusCounts ?? [], statuses.data ?? []),
    [query.data?.statusCounts, statuses.data]
  );
  const reportContext = reportFilters
    ? [
        reportFilters.fromDate && `From ${reportFilters.fromDate}`,
        reportFilters.toDate && `To ${reportFilters.toDate}`,
        reportFilters.listInId &&
          `List in: ${reportFilters.listInId === "none" ? "(no group)" : ((lists.data ?? []).find((item) => String(item.id) === reportFilters.listInId)?.name ?? reportFilters.listInId)}`,
        reportFilters.createdBy && `Creator: ${reportFilters.createdBy}`,
        reportFilters.assignedUserId &&
          `Assignee: ${reportFilters.assignedUserId === "none" ? "Unassigned" : ((users.data ?? []).find((item) => String(item.id) === reportFilters.assignedUserId)?.name ?? reportFilters.assignedUserId)}`,
        status !== "all" &&
          `Status: ${filterOptions.find((item) => item.id === status)?.label ?? status}`
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const openCall = useMutation({
    mutationFn: (record: EnquiryRecord) => openNewEnquiryCall(record.id),
    onSuccess: async (record) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: enquiriesQueryKey }),
        client.invalidateQueries({ queryKey: enquiryDetailQueryKey(record.id) }),
        client.invalidateQueries({ queryKey: enquiryCommentsQueryKey(record.id) }),
        client.invalidateQueries({ queryKey: enquiryActivityQueryKey(record.id) }),
        client.invalidateQueries({ queryKey: enquiryAttentionQueryKey })
      ]);
      toast.success(`Call #${record.enquiryNo} opened`);
    },
    onError: (error) => toast.error("Unable to open new call", { description: error.message })
  });
  const save = useMutation({
    mutationFn: (payload: EnquirySavePayload) =>
      editing ? updateEnquiry(editing.id, payload) : createEnquiry(payload),
    onSuccess: async (record) => {
      await client.invalidateQueries({ queryKey: enquiriesQueryKey });
      await client.invalidateQueries({ queryKey: enquiryDetailQueryKey(record.id) });
      await client.invalidateQueries({ queryKey: enquiryContactsQueryKey });
      await client.invalidateQueries({ queryKey: enquiryAttentionQueryKey });
      toast.success(`Enquiry #${record.enquiryNo} ${editing ? "updated" : "created"}`, {
        description: record.title
      });
      setEditing(undefined);
      if (initialCreate) onCloseCreate?.();
    },
    onError: (error) => toast.error("Unable to save enquiry", { description: error.message })
  });
  const total = query.data?.total ?? 0;
  const resetSave = save.reset;
  useEffect(() => {
    resetSave();
  }, [initialCreate, resetSave]);
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const records = query.data?.items ?? [];
  const activeColumnFilters = Object.values(columnFilters).filter((value) => value?.trim()).length;
  useEffect(() => {
    if (query.data && page > totalPages) setPage(totalPages);
  }, [query.data, page, totalPages]);
  if (editing !== undefined) {
    return (
      <EnquiryForm
        key={editing?.id ?? "new"}
        record={editing}
        contacts={contacts.data ?? []}
        contactsLoading={contacts.isLoading}
        listOptions={lists.data ?? []}
        statuses={statuses.data ?? []}
        priorities={priorities.data ?? []}
        users={users.data ?? []}
        loading={save.isPending}
        error={save.error?.message ?? ""}
        lookupError={
          contacts.error?.message ??
          users.error?.message ??
          lists.error?.message ??
          statuses.error?.message ??
          priorities.error?.message ??
          ""
        }
        onBack={() => {
          if (initialCreate) {
            (onCancelCreate ?? onCloseCreate)?.();
          } else {
            setEditing(undefined);
          }
        }}
        onSeeMoreEnquiries={onSeeMoreEnquiries}
        onOpenEnquiry={onOpenEnquiry ?? (onOpenRecord ? (id) => onOpenRecord(id) : undefined)}
        onContactSaved={async () => {
          await Promise.all([
            client.invalidateQueries({ queryKey: enquiryContactsQueryKey }),
            client.invalidateQueries({ queryKey: enquiriesQueryKey })
          ]);
        }}
        onSubmit={(payload) => save.mutate(payload)}
      />
    );
  }
  if (showing !== null) {
    return (
      <EnquiryShow
        id={showing}
        contacts={contacts.data ?? []}
        suppliers={options.data?.suppliers ?? []}
        users={users.data ?? []}
        listOptions={lists.data ?? []}
        statuses={statuses.data ?? []}
        priorities={priorities.data ?? []}
      />
    );
  }
  return (
    <WorkspacePage variant="list" title="" technicalName={`page.crm.${scope}.enquiries.list`}>
      {reportFilters ? (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-4 py-2 text-sm">
          <span>Report results{reportContext ? ` · ${reportContext}` : ""}</span>
          <Button type="button" variant="outline" onClick={onBackToReports}>
            Back to reports
          </Button>
        </div>
      ) : null}
      {mobileFilter ? (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-4 py-2 text-sm">
          <span>Enquiries for mobile {mobileFilter.mobile}</span>
          <Button type="button" variant="outline" onClick={onClearMobileFilter}>
            Clear mobile filter
          </Button>
        </div>
      ) : null}
      {scope === "assigned" ? <EnquiryAttention onOpen={showRecord} /> : null}
      <WorkspaceFilters
        toolbarAction={
          <>
            <WorkspaceDateRangePicker
              fromDate={dateRange.fromDate}
              toDate={dateRange.toDate}
              onValueChange={(value) => {
                setDateRange(value);
                setPage(1);
              }}
            />
            <Button
              aria-label="Toggle column search filters"
              aria-pressed={showInlineFilters}
              className="h-8 min-w-8 gap-1 px-2"
              title="Toggle column search filters"
              type="button"
              variant={showInlineFilters ? "default" : "outline"}
              onClick={() => setShowInlineFilters((open) => !open)}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {activeColumnFilters > 0 ? (
                <span className="text-xs">{activeColumnFilters}</span>
              ) : null}
            </Button>
          </>
        }
        columnOptions={columnOptions
          .filter(
            (column) =>
              (column.id !== "creator" || scope !== "created") &&
              (column.id !== "assignedTo" || scope !== "assigned")
          )
          .map((column) => ({
            ...column,
            label:
              column.id === "assignedTo" && scope === "created" ? "Allocated to" : column.label,
            checked: visibleColumns[column.id] !== false,
            onCheckedChange: (checked) => {
              setVisibleColumns((current) => ({ ...current, [column.id]: checked }));
              if (!checked) {
                setColumnFilters((current) => {
                  const next = { ...current };
                  delete next[column.id as keyof EnquiryColumnFilters];
                  return next;
                });
                setPage(1);
              }
            }
          }))}
        onShowAllColumns={() => setVisibleColumns({})}
        searchPlaceholder="Search ID, details, phone, or customer"
        searchValue={search}
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
        filterOptions={filterOptions}
      />
      {query.error ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : null}
      <EnquiryList
        records={records}

        showInlineFilters={showInlineFilters}
        columnFilters={columnFilters}
        onColumnFilterChange={(column, value) => {
          setColumnFilters((current) => ({ ...current, [column]: value }));
          setPage(1);
        }}
        onHideInlineFilters={() => setShowInlineFilters(false)}
        showActions={scope !== "assigned"}
        users={users.data ?? []}
        userColumnMode={
          scope === "assigned" ? "creator" : scope === "created" ? "allocatedTo" : "both"
        }
        visibleColumns={visibleColumns}
        loading={query.isLoading}
        onShow={(record) => showRecord(record.id)}
        onEdit={setEditing}
        onOpenCall={(record) => openCall.mutate(record)}
        openingCallId={openCall.isPending ? openCall.variables.id : null}
      />
      {totalPages > 1 ? (
        <WorkspacePagination
          page={currentPage}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[20, 50, 100]}
          showingLabel={buildShowingLabel(currentPage, rowsPerPage, total)}
          singularLabel="enquiry"
          totalCount={total}
          totalPages={totalPages}
          onNextPage={() => setPage((value) => Math.min(totalPages, value + 1))}
          onPageChange={setPage}
          onPreviousPage={() => setPage((value) => Math.max(1, value - 1))}
          onRowsPerPageChange={(value) => {
            setRowsPerPage(value);
            setPage(1);
          }}
        />
      ) : null}
    </WorkspacePage>
  );
}
