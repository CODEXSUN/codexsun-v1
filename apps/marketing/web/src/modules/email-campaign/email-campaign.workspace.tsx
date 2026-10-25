import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useWorkspaceQueryState,
  useWorkspaceQueryValue
} from "@codexsun/ui/workspace/navigation";
import { useMarketingTransport } from "../../transport";
import {
  countEmailCampaigns,
  getEmailCampaign,
  listEmailCampaigns,
  saveEmailCampaign
} from "./email-campaign.services";
import { EmailCampaignList } from "./email-campaign.list";
import { EmailCampaignForm } from "./email-campaign.form";
import { EmailCampaignShow } from "./email-campaign.show";
import type { EmailCampaignInput, EmailCampaignRecord } from "./email-campaign.types";

export function EmailCampaignWorkspace() {
  const api = useMarketingTransport();
  const client = useQueryClient();

  const [queryParams, setQueryParams] = useWorkspaceQueryState({
    search: "",
    status: "all",
    page: 1,
    pageSize: 50
  });

  const { search, status, page, pageSize } = queryParams;

  const [showKey, setShowKey] = useWorkspaceQueryValue("show", "");
  const [formMode, setFormMode] = useWorkspaceQueryValue("form", "");
  const [recordKey, setRecordKey] = useWorkspaceQueryValue("record", "");

  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const deferredSearch = useDeferredValue(search);

  const listQuery = useQuery({
    queryKey: [
      "marketing",
      api.scopeKey,
      "email-campaigns-list",
      deferredSearch.trim(),
      status,
      columnFilters,
      page,
      pageSize
    ],
    queryFn: () =>
      listEmailCampaigns(api, {
        search: deferredSearch.trim(),
        status,
        ...(columnFilters.brand ? { brand: columnFilters.brand } : {}),
        ...(columnFilters.subject ? { subject: columnFilters.subject } : {}),
        limit: pageSize,
        offset: (page - 1) * pageSize
      }),
    enabled: !showKey && !formMode
  });

  const countQuery = useQuery({
    queryKey: [
      "marketing",
      api.scopeKey,
      "email-campaigns-count",
      deferredSearch.trim(),
      status,
      columnFilters
    ],
    queryFn: () =>
      countEmailCampaigns(api, {
        search: deferredSearch.trim(),
        status,
        ...(columnFilters.brand ? { brand: columnFilters.brand } : {}),
        ...(columnFilters.subject ? { subject: columnFilters.subject } : {})
      }),
    enabled: !showKey && !formMode
  });

  const editRecordQuery = useQuery({
    queryKey: ["marketing", api.scopeKey, "email-campaign-detail", recordKey],
    queryFn: () => getEmailCampaign(api, recordKey),
    enabled: formMode === "edit" && Boolean(recordKey)
  });

  const saveMutation = useMutation({
    mutationFn: (input: EmailCampaignInput) =>
      saveEmailCampaign(api, input, formMode === "edit" ? recordKey : undefined),
    onSuccess: async (record) => {
      await client.invalidateQueries({ queryKey: ["marketing", api.scopeKey] });
      toast.success(
        formMode === "edit"
          ? "Email campaign updated successfully."
          : "Email campaign draft created successfully."
      );
      setFormMode("");
      setRecordKey("");
      setShowKey(record.uuid);
    },
    onError: (err) => {
      toast.error("Failed to save email campaign", { description: err.message });
    }
  });

  const handleSearchChange = (val: string) => setQueryParams((prev) => ({ ...prev, search: val, page: 1 }));
  const handleStatusChange = (val: string) => setQueryParams((prev) => ({ ...prev, status: val, page: 1 }));
  const handlePageChange = (p: number) => setQueryParams((prev) => ({ ...prev, page: p }));
  const handlePageSizeChange = (s: number) => setQueryParams((prev) => ({ ...prev, pageSize: s, page: 1 }));

  const handleColumnFilterChange = (col: string, val: string) => {
    setColumnFilters((prev) => ({ ...prev, [col]: val }));
    setQueryParams((prev) => ({ ...prev, page: 1 }));
  };

  const handleClearColumnFilters = () => {
    setColumnFilters({});
    setQueryParams((prev) => ({ ...prev, page: 1 }));
  };

  // 1. Show Page
  if (showKey) {
    return (
      <EmailCampaignShow
        uuid={showKey}
        onBack={() => setShowKey("")}
        onEdit={(rec: EmailCampaignRecord) => {
          setShowKey("");
          setFormMode("edit");
          setRecordKey(rec.uuid);
        }}
      />
    );
  }

  // 2. Form Page (New / Edit)
  if (formMode === "new" || formMode === "edit") {
    return (
      <EmailCampaignForm
        record={formMode === "edit" ? editRecordQuery.data ?? null : null}
        onCancel={() => {
          setFormMode("");
          setRecordKey("");
        }}
        onSubmit={(input) => saveMutation.mutate(input)}
        pending={saveMutation.isPending}
        error={saveMutation.error?.message ?? ""}
      />
    );
  }

  // 3. List Page
  return (
    <EmailCampaignList
      items={listQuery.data ?? []}
      totalCount={countQuery.data ?? 0}
      search={search}
      onSearchChange={handleSearchChange}
      status={status}
      onStatusChange={handleStatusChange}
      page={page}
      pageSize={pageSize}
      onPageChange={handlePageChange}
      onPageSizeChange={handlePageSizeChange}
      columnFilters={columnFilters}
      onColumnFilterChange={handleColumnFilterChange}
      onClearColumnFilters={handleClearColumnFilters}
      onSelectRecord={(rec) => setShowKey(rec.uuid)}
      onNew={() => setFormMode("new")}
    />
  );
}
