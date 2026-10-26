import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Plus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspacePagination } from "@codexsun/ui/workspace/pagination";
import { buildShowingLabel } from "@codexsun/ui/workspace/utils";
import { enquiryContactsQueryKey } from "../enquiry";
import { CrmContactForm } from "./contact.form";
import { CrmContactShow } from "./contact.show";
import {
  contactLookupsQueryKey,
  contactsQueryKey,
  useContactLookups,
  useContacts
} from "./contact.hooks";
import { CrmContactList, type ContactColumnFilters } from "./contact.list";
import {
  createContact,
  createAddressTypeLookup,
  createBankNameLookup,
  createCityLookup,
  createContactGroupLookup,
  createContactTypeLookup,
  createCountryLookup,
  createDistrictLookup,
  createPincodeLookup,
  createStateLookup,
  forceDeleteContact,
  setContactActive,
  updateContact
} from "./contact.services";
import { prepareContactPayloadForSave } from "./contact.schema";

import type {
  ContactLookupCreate,
  ContactLookups,
  ContactRecord,
  ContactSavePayload
} from "./contact.types";

const emptyLookups: ContactLookups = {
  contactTypes: [],
  contactGroups: [],
  addressTypes: [],
  bankNames: [],
  countries: [],
  states: [],
  districts: [],
  cities: [],
  pincodes: []
};
const contactColumns = [
  { id: "contact", label: "Contact" },
  { id: "code", label: "Code" },
  { id: "phone", label: "Phone" },
  { id: "email", label: "Email" },
  { id: "status", label: "Status" }
] as const;

export function CrmContactWorkspace({
  basePath = "/app/crm/contacts",
  hideSinglePagePagination = false,
  showListHeader = true,
  onOpenEnquiry,
  onShowContextChange
}: {
  basePath?: string;
  hideSinglePagePagination?: boolean;
  showListHeader?: boolean;
  onOpenEnquiry?: (id: string) => void;
  onShowContextChange?: (
    contact: Pick<ContactRecord, "code" | "name" | "primaryPhone"> | null
  ) => void;
}) {
  const client = useQueryClient(),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [rowsPerPage, setRowsPerPage] = useState(100),
    [statusFilter, setStatusFilter] = useState("all"),
    [showInlineFilters, setShowInlineFilters] = useState(false),
    [columnFilters, setColumnFilters] = useState<ContactColumnFilters>({}),
    [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({}),
    [editing, setLocalEditing] = useState<ContactRecord | null | undefined>(undefined),
    [showing, setShowing] = useState<ContactRecord | null>(null),
    query = useContacts(search),
    lookupsQuery = useContactLookups(),
    records = query.data ?? [];
  const location = useLocation();
  const navigate = useNavigate();
  function setEditing(record: ContactRecord | null | undefined) {
    setLocalEditing(record);
    setShowing(null);
    const path =
      record === undefined
        ? basePath
        : record === null
          ? `${basePath}/new`
          : `${basePath}/${encodeURIComponent(record.id)}/edit`;
    if (location.pathname !== path) void navigate({ to: path });
  }
  function setShowingContact(record: ContactRecord | null) {
    setShowing(record);
    setLocalEditing(undefined);
    const path = record ? `${basePath}/${encodeURIComponent(record.id)}/show` : basePath;
    if (location.pathname !== path) void navigate({ to: path });
  }
  useEffect(() => {
    const tail = location.pathname.slice(basePath.length).split("/").filter(Boolean);
    if (tail.length === 0) {
      setLocalEditing(undefined);
      setShowing(null);
      return;
    }
    if (tail[0] === "new" && tail.length === 1) {
      setLocalEditing(null);
      setShowing(null);
      return;
    }
    const isShowPath = tail.length === 2 && tail[1] === "show";
    if (tail.length > 2 || (tail[1] && tail[1] !== "edit" && !isShowPath)) return;
    let id: string;
    try {
      id = decodeURIComponent(tail[0]!);
    } catch {
      return;
    }
    const record = query.data?.find((entry) => String(entry.id) === id);
    if (isShowPath) {
      setLocalEditing(undefined);
      setShowing((current) => (current?.id === record?.id ? current : (record ?? null)));
    } else {
      setShowing(null);
      setLocalEditing((current) =>
        current && record && current.id === record.id ? current : record
      );
    }
  }, [basePath, location.pathname, query.data]);
  useEffect(() => {
    onShowContextChange?.(
      showing
        ? { code: showing.code, name: showing.name, primaryPhone: showing.primaryPhone }
        : null
    );
    return () => onShowContextChange?.(null);
  }, [onShowContextChange, showing]);
  const filteredRecords = records.filter((record) => {
    if (statusFilter === "active" && !record.isActive) return false;
    if (statusFilter === "inactive" && record.isActive) return false;
    return contactColumns.every(({ id }) => {
      const value = columnFilters[id as keyof ContactColumnFilters]?.trim().toLowerCase();
      if (!value) return true;
      const text =
        id === "contact"
          ? record.name
          : id === "code"
            ? record.code
            : id === "phone"
              ? record.primaryPhone
              : id === "email"
                ? record.primaryEmail
                : record.isActive
                  ? "active"
                  : "inactive";
      return (text ?? "").toLowerCase().includes(value);
    });
  });
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const visibleRecords = filteredRecords.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const activeColumnFilters = Object.values(columnFilters).filter((value) => value?.trim()).length;
  const save = useMutation({
    mutationFn: (payload: ContactSavePayload) =>
      editing ? updateContact(editing.id, payload) : createContact(payload),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: contactsQueryKey }),
        client.invalidateQueries({ queryKey: enquiryContactsQueryKey })
      ]);
      toast.success("Contact saved");
      setEditing(undefined);
    },
    onError: (error) => toast.error("Unable to save contact", { description: error.message })
  });
  const action = useMutation({
    mutationFn: ({ record, type }: { record: ContactRecord; type: "delete" | "toggle" }) =>
      type === "delete"
        ? forceDeleteContact(record.id)
        : setContactActive(record.id, !record.isActive),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: contactsQueryKey }),
        client.invalidateQueries({ queryKey: enquiryContactsQueryKey })
      ]);
    },
    onError: (error) => toast.error("Unable to update contact", { description: error.message })
  });
  const updateDetails = useMutation({
    mutationFn: ({
      record,
      patch
    }: {
      record: ContactRecord;
      patch: Partial<ContactSavePayload>;
    }) =>
      updateContact(
        record.id,
        prepareContactPayloadForSave({
          code: record.code,
          name: record.name,
          legalName: record.legalName,
          typeId: record.typeId ?? 0,
          groupId: record.groupId,
          gstin: record.gstin,
          pan: record.pan,
          msmeNo: record.msmeNo,
          msmeCategory: record.msmeCategory,
          tanNo: record.tanNo,
          tdsAvailable: record.tdsAvailable,
          tcsAvailable: record.tcsAvailable,
          openingBalance: record.openingBalance,
          creditLimit: record.creditLimit,
          website: record.website,
          description: record.description,
          status: record.isActive ? "active" : "suspend",
          isActive: record.isActive,
          emails: record.emails,
          phones: record.phones,
          addresses: record.addresses,
          bankAccounts: record.bankAccounts,
          socialLinks: record.socialLinks,
          ...patch
        })
      ),
    onSuccess: async (saved) => {
      setShowing(saved);
      await Promise.all([
        client.invalidateQueries({ queryKey: contactsQueryKey }),
        client.invalidateQueries({ queryKey: enquiryContactsQueryKey })
      ]);
      toast.success("Contact details updated");
    },
    onError: (error) =>
      toast.error("Unable to update contact details", { description: error.message })
  });
  const updateContactStatus = useMutation({
    mutationFn: ({ record, active }: { record: ContactRecord; active: boolean }) =>
      setContactActive(record.id, active),
    onSuccess: async (saved) => {
      setShowing(saved);
      await Promise.all([
        client.invalidateQueries({ queryKey: contactsQueryKey }),
        client.invalidateQueries({ queryKey: enquiryContactsQueryKey })
      ]);
      toast.success("Contact status updated");
    },
    onError: (error) =>
      toast.error("Unable to update contact status", { description: error.message })
  });
  const refreshLookups = async <Record,>(work: () => Promise<Record>) => {
    const record = await work();
    await client.invalidateQueries({ queryKey: contactLookupsQueryKey });
    return record;
  };
  const createLookup: ContactLookupCreate = {
    contactType: (name) => refreshLookups(() => createContactTypeLookup(name)),
    contactGroup: (name) => refreshLookups(() => createContactGroupLookup(name)),
    addressType: (name) => refreshLookups(() => createAddressTypeLookup(name)),
    bankName: (name) => refreshLookups(() => createBankNameLookup(name)),
    country: (name) => refreshLookups(() => createCountryLookup(name)),
    state: (name, countryId) => refreshLookups(() => createStateLookup(name, countryId)),
    district: (name, stateId) => refreshLookups(() => createDistrictLookup(name, stateId)),
    city: (name, districtId) => refreshLookups(() => createCityLookup(name, districtId)),
    pincode: (postalCode, area, cityId) =>
      refreshLookups(() => createPincodeLookup(postalCode, area, cityId))
  };
  if (showing)
    return (
      <CrmContactShow
        record={showing}
        lookups={lookupsQuery.data ?? emptyLookups}
        saving={updateDetails.isPending || updateContactStatus.isPending}
        onUpdate={async (patch) => {
          await updateDetails.mutateAsync({ record: showing, patch });
        }}
        onStatusChange={async (active) => {
          await updateContactStatus.mutateAsync({ record: showing, active });
        }}
        {...(onOpenEnquiry ? { onOpenEnquiry } : {})}
      />
    );
  if (editing !== undefined)
    return (
      <CrmContactForm
        key={editing?.id ?? "new"}
        createLookup={createLookup}
        error={save.error?.message ?? ""}
        loading={save.isPending}
        lookups={lookupsQuery.data ?? emptyLookups}
        lookupsLoading={lookupsQuery.isLoading}
        record={editing}
        onBack={() => {
          setEditing(undefined);
        }}
        onSubmit={(payload) => save.mutate(payload)}
      />
    );
  return (
    <WorkspacePage
      variant="list"
      title={showListHeader ? "Contacts" : ""}
      {...(showListHeader
        ? {
            description:
              "Manage contact identity, tax, communication, address, finance, and lifecycle details.",
            actions: (
              <div className="flex gap-2">
                <Button onClick={() => setEditing(null)}>
                  <Plus className="size-4" />
                  New
                </Button>
              </div>
            )
          }
        : {})}
    >
      <WorkspaceFilters
        toolbarAction={
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
        }
        columnOptions={contactColumns.map((column) => ({
          ...column,
          checked: visibleColumns[column.id] !== false,
          disabled: column.id === "contact",
          onCheckedChange: (checked) => {
            setVisibleColumns((current) => ({ ...current, [column.id]: checked }));
            if (!checked) {
              setColumnFilters((current) => ({ ...current, [column.id]: "" }));
              setPage(1);
            }
          }
        }))}
        onShowAllColumns={() => setVisibleColumns({})}
        searchPlaceholder="Search code, contact, phone, or email"
        searchValue={search}
        onSearchValueChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        filterValue={statusFilter}
        showSelectedFilterChip
        onFilterValueChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
        filterOptions={[
          { id: "all", label: "All contacts", count: records.length },
          {
            id: "active",
            label: "Active",
            count: records.filter((record) => record.isActive).length
          },
          {
            id: "inactive",
            label: "Inactive",
            count: records.filter((record) => !record.isActive).length
          }
        ]}
      />
      {query.error ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : null}
      <CrmContactList
        loading={query.isFetching && !query.data}
        records={visibleRecords}

        visibleColumns={visibleColumns}
        showInlineFilters={showInlineFilters}
        columnFilters={columnFilters}
        onColumnFilterChange={(column, value) => {
          setColumnFilters((current) => ({ ...current, [column]: value }));
          setPage(1);
        }}
        onHideInlineFilters={() => setShowInlineFilters(false)}
        onView={setShowingContact}
        onEdit={setEditing}
        onForceDelete={(record) => {
          if (confirm(`Force delete ${record.name}?`)) action.mutate({ record, type: "delete" });
        }}
        onToggle={(record) => action.mutate({ record, type: "toggle" })}
      />
      {!hideSinglePagePagination || totalPages > 1 ? (
        <WorkspacePagination
          page={currentPage}
          rowsPerPage={rowsPerPage}
          showingLabel={buildShowingLabel(currentPage, rowsPerPage, filteredRecords.length)}
          singularLabel="contact"
          totalCount={filteredRecords.length}
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
