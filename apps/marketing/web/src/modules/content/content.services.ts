import type { MarketingTransport } from "../../transport";
import type {
  ContentActivity,
  ContentBrandOption,
  ContentCampaignOption,
  ContentInput,
  ContentRecord
} from "./content.types";

export const listContents = (
  api: MarketingTransport,
  search = "",
  status = "all",
  channel = "all",
  publishMode = "all",
  page = 1,
  pageSize = 25
) =>
  api.get<ContentRecord[]>(
    "/marketing/contents?limit=" +
      pageSize +
      "&offset=" +
      Math.max(0, page - 1) * pageSize +
      "&search=" +
      encodeURIComponent(search) +
      "&status=" +
      encodeURIComponent(status) +
      "&channel=" +
      encodeURIComponent(channel) +
      "&publishMode=" +
      encodeURIComponent(publishMode)
  );

export const countContents = (
  api: MarketingTransport,
  search = "",
  status = "all",
  channel = "all",
  publishMode = "all"
) =>
  api.get<{ total: number }>(
    "/marketing/contents/count?search=" +
      encodeURIComponent(search) +
      "&status=" +
      encodeURIComponent(status) +
      "&channel=" +
      encodeURIComponent(channel) +
      "&publishMode=" +
      encodeURIComponent(publishMode)
  );

export const getContent = (api: MarketingTransport, uuid: string) =>
  api.get<ContentRecord>("/marketing/contents/" + uuid);

export const createContent = (api: MarketingTransport, input: ContentInput) =>
  api.post<ContentRecord>("/marketing/contents", input);

export const updateContent = (api: MarketingTransport, uuid: string, input: ContentInput) =>
  api.put<ContentRecord>("/marketing/contents/" + uuid, input);

export const submitApproval = (api: MarketingTransport, uuid: string, expectedRevision?: number) =>
  api.post<ContentRecord>("/marketing/contents/" + uuid + "/submit-approval", {
    expectedRevision
  });

export const approveContent = (api: MarketingTransport, uuid: string, expectedRevision?: number) =>
  api.post<ContentRecord>("/marketing/contents/" + uuid + "/approve", {
    expectedRevision
  });

export const rejectContent = (
  api: MarketingTransport,
  uuid: string,
  reason: string,
  expectedRevision?: number
) =>
  api.post<ContentRecord>("/marketing/contents/" + uuid + "/reject", {
    reason,
    expectedRevision
  });

export const scheduleContent = (
  api: MarketingTransport,
  uuid: string,
  scheduledAt: string,
  expectedRevision?: number
) =>
  api.post<ContentRecord>("/marketing/contents/" + uuid + "/schedule", {
    scheduledAt,
    expectedRevision
  });

export const cancelContent = (api: MarketingTransport, uuid: string, expectedRevision?: number) =>
  api.post<ContentRecord>("/marketing/contents/" + uuid + "/cancel", {
    expectedRevision
  });

export const publishContent = (api: MarketingTransport, uuid: string, expectedRevision?: number) =>
  api.post<ContentRecord>("/marketing/contents/" + uuid + "/publish", {
    expectedRevision
  });

export const completeManual = (
  api: MarketingTransport,
  uuid: string,
  nativePostId: string,
  notes?: string,
  expectedRevision?: number
) =>
  api.post<ContentRecord>("/marketing/contents/" + uuid + "/complete-manual", {
    nativePostId,
    notes: notes ?? "",
    expectedRevision
  });

export const contentActivity = (api: MarketingTransport, uuid: string) =>
  api.get<ContentActivity[]>("/marketing/contents/" + uuid + "/activity");

export const contentBrandOptions = (api: MarketingTransport) =>
  api.get<ContentBrandOption[]>("/marketing/brands?limit=100&status=active");

export const contentCampaignOptions = (api: MarketingTransport) =>
  api.get<ContentCampaignOption[]>("/marketing/campaigns?limit=100&status=active");
