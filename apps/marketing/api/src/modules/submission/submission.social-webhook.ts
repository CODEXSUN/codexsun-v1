import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { sql } from "kysely";
import { AppError } from "@codexsun/framework/errors";
import type { MarketingContext } from "../../context.js";
import { SubmissionService } from "./submission.service.js";
import { processSubmissionHandoff } from "./submission.worker.js";
import type { SubmissionDependencies, SubmissionInput } from "./submission.types.js";

export type SocialWebhookResult = {
  received: boolean;
  submissionUuid: string;
  leadUuid: string | null;
  isTest: boolean;
  status: string;
};

export function verifyMetaSignature(
  rawPayload: string | Buffer,
  signatureHeader: string | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const prefix = "sha256=";
  const signature = signatureHeader.startsWith(prefix)
    ? signatureHeader.slice(prefix.length)
    : signatureHeader;
  const expected = createHmac("sha256", appSecret).update(rawPayload).digest("hex");
  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

export function verifyMetaSubscription(
  query: Record<string, unknown>,
  expectedToken?: string
): { challenge: string; status: string } {
  const mode = String(query["hub.mode"] ?? "subscribe");
  const token = String(query["hub.verify_token"] ?? "");
  const challenge = String(query["hub.challenge"] ?? "");
  if (mode !== "subscribe") {
    throw AppError.validation("Expected hub.mode to be 'subscribe'.");
  }
  const verifyToken = expectedToken || process.env.META_VERIFY_TOKEN;
  if (verifyToken && token !== verifyToken) {
    throw AppError.forbidden("Invalid Meta webhook verify token.");
  }
  return { challenge, status: "verified" };
}

export function verifyGoogleAdsKey(providedKey: string | undefined, expectedKey?: string): boolean {
  const key = expectedKey || process.env.GOOGLE_ADS_WEBHOOK_KEY;
  if (!key) return true;
  if (!providedKey || providedKey !== key) {
    throw AppError.unauthorized("Invalid Google Ads webhook key.");
  }
  return true;
}

async function resolveCaptureUuid(
  context: MarketingContext,
  providedCaptureUuid?: string | null
): Promise<string> {
  if (providedCaptureUuid && /^[a-f0-9]{8}$/.test(providedCaptureUuid)) {
    return providedCaptureUuid;
  }
  const row = (
    await sql<{ uuid: string }>`SELECT uuid FROM marketing_capture_forms
    WHERE company_id=${context.companyId} AND status='active'
    ORDER BY id ASC LIMIT 1`.execute(context.database)
  ).rows[0];
  if (!row) {
    throw AppError.notFound("No active capture definition found for inbound social lead.");
  }
  return row.uuid;
}

export async function handleMetaLeadWebhook(
  context: MarketingContext,
  deps: SubmissionDependencies,
  payload: Record<string, unknown>,
  headers?: Record<string, string | string[] | undefined>,
  query?: Record<string, unknown>
): Promise<SocialWebhookResult> {
  const sigHeader = (headers?.["x-hub-signature-256"] ||
    headers?.["X-Hub-Signature-256"]) as string | undefined;
  const appSecret = process.env.META_APP_SECRET;
  if (appSecret && sigHeader) {
    const rawBody = typeof payload === "string" ? payload : JSON.stringify(payload);
    if (!verifyMetaSignature(rawBody, sigHeader, appSecret)) {
      throw AppError.forbidden("Invalid Meta webhook signature.");
    }
  }

  let isTest = Boolean(payload.is_test);
  let leadgenId = (payload.leadgen_id as string) || "";
  let formId = (payload.form_id as string) || "";
  let adId = (payload.ad_id as string) || "";
  let pageId = (payload.page_id as string) || "";
  const captureUuidParam =
    (payload.captureUuid as string) || (query?.captureUuid as string | undefined);

  if (Array.isArray(payload.entry)) {
    for (const entry of payload.entry as Record<string, unknown>[]) {
      if (entry.id) pageId = String(entry.id);
      if (Array.isArray(entry.changes)) {
        for (const change of entry.changes as Record<string, unknown>[]) {
          if (change.field === "leadgen" && change.value && typeof change.value === "object") {
            const val = change.value as Record<string, unknown>;
            leadgenId = String(val.leadgen_id || leadgenId);
            formId = String(val.form_id || formId);
            adId = String(val.ad_id || adId);
            if (val.page_id) pageId = String(val.page_id);
            if (
              val.leadgen_id === "test_lead" ||
              val.ad_id === "0" ||
              String(val.leadgen_id).startsWith("test_")
            ) {
              isTest = true;
            }
          }
        }
      }
    }
  }

  if (leadgenId === "test_lead" || leadgenId.startsWith("test_")) {
    isTest = true;
  }

  let name = (payload.name as string) || "";
  let email = (payload.email as string) || "";
  let phone = (payload.phone as string) || "";

  if (Array.isArray(payload.field_data)) {
    for (const item of payload.field_data as { name?: string; values?: unknown[] }[]) {
      const k = String(item.name || "").toLowerCase();
      const v =
        Array.isArray(item.values) && item.values.length > 0 ? String(item.values[0]) : "";
      if (k === "full_name" || k === "name" || k === "first_name") {
        name = name || v;
      } else if (k === "email") {
        email = email || v;
      } else if (k === "phone_number" || k === "phone") {
        phone = phone || v;
      }
    }
  }

  if (isTest) {
    name = name || "Meta Test Lead";
    email = email || "meta-test@example.com";
    phone = phone || "+15550000000";
  } else {
    name = name || `Meta Lead ${leadgenId || "Social"}`;
    if (!email && !phone) {
      email = `${leadgenId || randomBytes(4).toString("hex")}@leads.facebook.com`;
    }
  }

  const captureUuid = await resolveCaptureUuid(context, captureUuidParam);
  const sourceKey = `meta_${leadgenId || randomBytes(4).toString("hex")}`;
  const submissionService = new SubmissionService(context, deps);
  const submissionInput: SubmissionInput = {
    captureUuid,
    sourceKey,
    name,
    email,
    phone,
    message: isTest
      ? `[TEST LEAD] Meta Lead Ads submission (form: ${formId || "unknown"}, page: ${pageId || "unknown"})`
      : `Meta Lead Ads submission (form: ${formId || "unknown"}, page: ${pageId || "unknown"})`,
    privacyConsent: true,
    sourceReference: `meta:${formId}:${leadgenId}${isTest ? ":test" : ""}`,
    sourceConsentAt: String(payload.created_time || payload.createdTime || payload.sourceConsentAt || "2026-10-25T00:00:00.000Z"),
    sourceNoticeVersion: "meta-leadgen-v1"
  };

  const submission = await submissionService.accept(submissionInput);
  const handoff = await processSubmissionHandoff(context, submission.uuid);

  return {
    received: true,
    submissionUuid: submission.uuid,
    leadUuid: handoff.leadUuid,
    isTest,
    status: handoff.status
  };
}

export async function handleGoogleAdsLeadWebhook(
  context: MarketingContext,
  deps: SubmissionDependencies,
  payload: Record<string, unknown>,
  headers?: Record<string, string | string[] | undefined>,
  query?: Record<string, unknown>
): Promise<SocialWebhookResult> {
  const providedKey =
    (payload.google_key as string) ||
    (headers?.["x-google-key"] as string) ||
    (query?.google_key as string);
  verifyGoogleAdsKey(providedKey);

  const leadId = (payload.lead_id as string) || "";
  const isTest = Boolean(payload.is_test || leadId === "test_lead" || leadId.startsWith("test_"));
  const formId = payload.form_id ? String(payload.form_id) : "";
  const campaignId = payload.campaign_id ? String(payload.campaign_id) : "";
  const captureUuidParam =
    (payload.captureUuid as string) || (query?.captureUuid as string | undefined);

  let name = (payload.name as string) || "";
  let email = (payload.email as string) || "";
  let phone = (payload.phone as string) || "";

  if (Array.isArray(payload.user_column_data)) {
    for (const col of payload.user_column_data as { column_id?: string; string_value?: string }[]) {
      const colId = String(col.column_id || "").toUpperCase();
      const val = String(col.string_value || "");
      if (colId === "FULL_NAME" || colId === "FIRST_NAME") {
        name = name || val;
      } else if (colId === "EMAIL") {
        email = email || val;
      } else if (colId === "PHONE_NUMBER") {
        phone = phone || val;
      }
    }
  }

  if (isTest) {
    name = name || "Google Ads Test Lead";
    email = email || "google-ads-test@example.com";
    phone = phone || "+15550000000";
  } else {
    name = name || "Google Ads Lead";
    if (!email && !phone) {
      email = `${leadId || randomBytes(4).toString("hex")}@leads.google.com`;
    }
  }

  const captureUuid = await resolveCaptureUuid(context, captureUuidParam);
  const sourceKey = `google_${leadId || randomBytes(4).toString("hex")}`;
  const submissionService = new SubmissionService(context, deps);
  const submissionInput: SubmissionInput = {
    captureUuid,
    sourceKey,
    name,
    email,
    phone,
    message: isTest
      ? `[TEST LEAD] Google Ads lead submission (campaign: ${campaignId || "unknown"}, form: ${formId || "unknown"})`
      : `Google Ads lead submission (campaign: ${campaignId || "unknown"}, form: ${formId || "unknown"})`,
    privacyConsent: true,
    sourceReference: `google:${campaignId}:${formId}${isTest ? ":test" : ""}`,
    sourceConsentAt: String(payload.created_time || payload.createdTime || payload.sourceConsentAt || "2026-10-25T00:00:00.000Z"),
    sourceNoticeVersion: "google-ads-v1"
  };

  const submission = await submissionService.accept(submissionInput);
  const handoff = await processSubmissionHandoff(context, submission.uuid);

  return {
    received: true,
    submissionUuid: submission.uuid,
    leadUuid: handoff.leadUuid,
    isTest,
    status: handoff.status
  };
}
