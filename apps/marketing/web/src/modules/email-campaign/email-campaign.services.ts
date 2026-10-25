import type { MarketingTransport } from "../../transport";
import type {
  DispatchBatchResult,
  EmailCampaignActivity,
  EmailCampaignInput,
  EmailCampaignRecord,
  EmailCampaignRecipient,
  EmailPreviewResult,
  EmailSenderRecord
} from "./email-campaign.types";

export async function listEmailCampaigns(
  api: MarketingTransport,
  params: {
    search?: string;
    status?: string;
    brand?: string;
    subject?: string;
    limit?: number;
    offset?: number;
  }
): Promise<EmailCampaignRecord[]> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status && params.status !== "all") query.set("status", params.status);
  if (params.brand) query.set("brand", params.brand);
  if (params.subject) query.set("subject", params.subject);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));

  const qs = query.toString();
  return api.get<EmailCampaignRecord[]>(`/marketing/email-campaigns${qs ? `?${qs}` : ""}`);
}

export async function countEmailCampaigns(
  api: MarketingTransport,
  params: {
    search?: string;
    status?: string;
    brand?: string;
    subject?: string;
  }
): Promise<number> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status && params.status !== "all") query.set("status", params.status);
  if (params.brand) query.set("brand", params.brand);
  if (params.subject) query.set("subject", params.subject);

  const qs = query.toString();
  const res = await api.get<{ count: number }>(`/marketing/email-campaigns/count${qs ? `?${qs}` : ""}`);
  return res.count;
}

export async function getEmailCampaign(
  api: MarketingTransport,
  uuid: string
): Promise<EmailCampaignRecord> {
  return api.get<EmailCampaignRecord>(`/marketing/email-campaigns/${uuid}`);
}

export async function saveEmailCampaign(
  api: MarketingTransport,
  input: EmailCampaignInput,
  uuid?: string
): Promise<EmailCampaignRecord> {
  if (uuid) {
    return api.put<EmailCampaignRecord>(`/marketing/email-campaigns/${uuid}`, input);
  }
  return api.post<EmailCampaignRecord>("/marketing/email-campaigns", input);
}

export async function listEmailSenders(
  api: MarketingTransport,
  brandUuid?: string
): Promise<EmailSenderRecord[]> {
  const qs = brandUuid ? `?brandUuid=${brandUuid}` : "";
  return api.get<EmailSenderRecord[]>(`/marketing/email-senders${qs}`);
}

export async function listEmailRecipients(
  api: MarketingTransport,
  campaignUuid: string,
  params: { limit?: number; offset?: number; status?: string }
): Promise<EmailCampaignRecipient[]> {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  if (params.status && params.status !== "all") query.set("status", params.status);
  const qs = query.toString();
  return api.get<EmailCampaignRecipient[]>(`/marketing/email-campaigns/${campaignUuid}/recipients${qs ? `?${qs}` : ""}`);
}

export async function submitForApprovalEmailCampaign(
  api: MarketingTransport,
  uuid: string
): Promise<EmailCampaignRecord> {
  return api.post<EmailCampaignRecord>(`/marketing/email-campaigns/${uuid}/submit-approval`, {});
}

export async function approveEmailCampaign(
  api: MarketingTransport,
  uuid: string
): Promise<EmailCampaignRecord> {
  return api.post<EmailCampaignRecord>(`/marketing/email-campaigns/${uuid}/approve`, {});
}

export async function rejectEmailCampaign(
  api: MarketingTransport,
  uuid: string,
  reason: string
): Promise<EmailCampaignRecord> {
  return api.post<EmailCampaignRecord>(`/marketing/email-campaigns/${uuid}/reject`, { reason });
}

export async function scheduleEmailCampaign(
  api: MarketingTransport,
  uuid: string,
  scheduledAt: string
): Promise<EmailCampaignRecord> {
  return api.post<EmailCampaignRecord>(`/marketing/email-campaigns/${uuid}/schedule`, { scheduledAt });
}

export async function cancelEmailCampaign(
  api: MarketingTransport,
  uuid: string,
  reason?: string
): Promise<EmailCampaignRecord> {
  return api.post<EmailCampaignRecord>(`/marketing/email-campaigns/${uuid}/cancel`, { reason });
}

export async function pauseEmailCampaign(
  api: MarketingTransport,
  uuid: string
): Promise<EmailCampaignRecord> {
  return api.post<EmailCampaignRecord>(`/marketing/email-campaigns/${uuid}/pause`, {});
}

export async function resumeEmailCampaign(
  api: MarketingTransport,
  uuid: string
): Promise<EmailCampaignRecord> {
  return api.post<EmailCampaignRecord>(`/marketing/email-campaigns/${uuid}/resume`, {});
}

export async function previewEmailCampaign(
  api: MarketingTransport,
  uuid: string,
  sampleValues?: Record<string, string>
): Promise<EmailPreviewResult> {
  return api.post<EmailPreviewResult>(`/marketing/email-campaigns/${uuid}/preview`, { sampleValues });
}

export async function testSendEmailCampaign(
  api: MarketingTransport,
  uuid: string,
  recipient: string
): Promise<{ delivered: boolean; recipient: string; subject: string }> {
  return api.post<{ delivered: boolean; recipient: string; subject: string }>(
    `/marketing/email-campaigns/${uuid}/test-send`,
    { recipient }
  );
}

export async function snapshotAudienceEmailCampaign(
  api: MarketingTransport,
  uuid: string,
  leadStatus?: string
): Promise<{ enqueued: number; suppressed: number; total: number }> {
  return api.post<{ enqueued: number; suppressed: number; total: number }>(
    `/marketing/email-campaigns/${uuid}/snapshot-audience`,
    { leadStatus }
  );
}

export async function dispatchEmailCampaign(
  api: MarketingTransport,
  uuid: string,
  batchSize = 50
): Promise<DispatchBatchResult> {
  return api.post<DispatchBatchResult>(`/marketing/email-campaigns/${uuid}/dispatch`, { batchSize });
}

export async function emailCampaignActivity(
  api: MarketingTransport,
  uuid: string
): Promise<EmailCampaignActivity[]> {
  return api.get<EmailCampaignActivity[]>(`/marketing/email-campaigns/${uuid}/activity`);
}
