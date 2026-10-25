import { AppError } from "@codexsun/framework/errors";
import {
  EnquiryRepository,
  type EnquiryListOptions,
  type EnquiryRecord
} from "@codexsun/crm-api/enquiry-sync";
import type { Kysely } from "kysely";
import type { FrappeConnectionInput, FrappeDatabase, FrappeSettings } from "./connection.types.js";
import { FrappeConnectionRepository } from "./connection.repository.js";

const maxResponseBytes = 1024 * 1024;

export class FrappeConnectionService {
  constructor(
    private readonly database: Kysely<FrappeDatabase>,
    private readonly settings: FrappeSettings,
    private readonly loadEnquiry: (id: number) => Promise<EnquiryRecord>,
    private readonly viewer: Pick<EnquiryListOptions, "actorEmail" | "actorUserId" | "canViewAll">,
    private readonly encryptionSecret = "",
    private readonly mappedEmployeeCode: (
      localEmail: string,
      baseUrl: string
    ) => Promise<string | null> = async () => null,
    private readonly backgroundWorkerEnabled = false
  ) {}

  async configured() {
    const importState = await new FrappeConnectionRepository(this.database).importState();
    const stored = await new FrappeConnectionRepository(this.database).connection();
    if (stored) {
      const configured = Boolean(
        stored.base_url && stored.api_key_ciphertext && stored.api_secret_ciphertext
      );
      const enabled = Boolean(stored.enabled);
      return {
        source: "tenant" as const,
        configured,
        enabled,
        usable:
          !importState.completedAt &&
          configured &&
          enabled &&
          stored.verification_status === "verified",
        baseUrl: stored.base_url,
        connectionName: stored.connection_name,
        appKeyConfigured: Boolean(stored.api_key_ciphertext),
        appSecretConfigured: Boolean(stored.api_secret_ciphertext),
        verificationStatus: stored.verification_status,
        lastCheckedAt: stored.last_checked_at
          ? new Date(stored.last_checked_at).toISOString()
          : null,
        lastVerifiedAt: stored.last_verified_at
          ? new Date(stored.last_verified_at).toISOString()
          : null,
        importCompletedAt: importState.completedAt,
        backgroundWorkerEnabled: this.backgroundWorkerEnabled
      };
    }
    const configured = Boolean(
      this.settings.baseUrl && this.settings.apiKey && this.settings.apiSecret
    );
    return {
      source: "environment" as const,
      configured,
      enabled: this.settings.enabled,
      usable: !importState.completedAt && configured && this.settings.enabled,
      baseUrl: this.settings.baseUrl || null,
      connectionName: "Frappe",
      appKeyConfigured: Boolean(this.settings.apiKey),
      appSecretConfigured: Boolean(this.settings.apiSecret),
      verificationStatus: "unverified" as const,
      lastCheckedAt: null,
      lastVerifiedAt: null,
      importCompletedAt: importState.completedAt,
      backgroundWorkerEnabled: this.backgroundWorkerEnabled
    };
  }

  async saveConnection(input: FrappeConnectionInput) {
    const repository = new FrappeConnectionRepository(this.database);
    const current = await repository.connection();
    if (current?.base_url !== input.baseUrl && (!input.apiKey || !input.apiSecret)) {
      throw AppError.validation("Enter both API credentials when changing the Frappe URL.");
    }
    await repository.saveConnection(input, this.encryptionSecret);
    return this.configured();
  }

  async provider() {
    return {
      moduleKey: "crm.enquiries" as const,
      provider: "local" as const
    };
  }

  async saveProvider(provider: "local" | "frappe", actorEmail: string) {
    const repository = new FrappeConnectionRepository(this.database);
    if (provider === "frappe") {
      throw AppError.validation(
        "CRM enquiries use the local database. Frappe receives synced copies."
      );
    }
    return {
      moduleKey: "crm.enquiries" as const,
      provider: await repository.saveProvider("crm.enquiries", provider, actorEmail)
    };
  }

  async verify(input?: {
    baseUrl?: string | undefined;
    apiKey?: string | undefined;
    apiSecret?: string | undefined;
    enabled?: boolean | undefined;
  }) {
    const repository = new FrappeConnectionRepository(this.database);
    const saved = await repository.credentials(this.encryptionSecret);
    if (
      input?.baseUrl &&
      input.baseUrl !== (saved?.settings.baseUrl ?? this.settings.baseUrl) &&
      (!input.apiKey || !input.apiSecret)
    ) {
      throw AppError.validation("Enter both API credentials to verify a different Frappe URL.");
    }
    const settings = {
      ...(saved?.settings ?? this.settings),
      ...(input?.baseUrl ? { baseUrl: input.baseUrl } : {}),
      ...(input?.apiKey ? { apiKey: input.apiKey } : {}),
      ...(input?.apiSecret ? { apiSecret: input.apiSecret } : {}),
      ...(input?.enabled !== undefined ? { enabled: input.enabled } : {})
    };
    const candidate = Boolean(
      input &&
      ((input.baseUrl && input.baseUrl !== (saved?.settings.baseUrl ?? this.settings.baseUrl)) ||
        input.apiKey ||
        input.apiSecret ||
        (input.enabled !== undefined &&
          input.enabled !== (saved?.settings.enabled ?? this.settings.enabled)))
    );
    try {
      const response = await this.request<{ message?: unknown }>(
        "/api/method/frappe.auth.get_logged_user",
        "GET",
        undefined,
        settings
      );
      if (typeof response.message !== "string" || !response.message.trim()) {
        throw upstreamError("Frappe did not identify the authenticated user.");
      }
      if (saved && !candidate) await repository.recordVerification("verified");
      return {
        connected: true,
        user: response.message.trim(),
        saved: Boolean(saved && !candidate)
      };
    } catch (error) {
      if (saved && !candidate) await repository.recordVerification("failed");
      throw error;
    }
  }

  async status(enquiryId: number) {
    await this.loadEnquiry(enquiryId);
    const row = await new FrappeConnectionRepository(this.database).get(enquiryId);
    return {
      enquiryId,
      remoteName: row?.remote_name ?? null,
      syncedAt: row?.synced_at ? new Date(row.synced_at).toISOString() : null
    };
  }

  async overview(page: number, pageSize: number, search: string) {
    const local = await new EnquiryRepository(this.database).listPage({
      ...this.viewer,
      page,
      pageSize,
      search,
      scope: "all",
      filter: "all"
    });
    const sync = await new FrappeConnectionRepository(this.database).overview(
      this.viewer,
      local.items.map((item) => item.id)
    );
    return {
      counts: { total: sync.total, synced: sync.synced, pending: sync.total - sync.synced },
      items: local.items.map((item) => {
        const state = sync.byId.get(item.id);
        return {
          id: item.id,
          enquiryNo: item.enquiryNo,
          title: item.title,
          status: item.statusName,
          updatedAt: item.updatedAt,
          remoteName: state?.remote_name ?? null,
          syncedAt: state?.synced_at ? new Date(state.synced_at).toISOString() : null
        };
      }),
      page,
      pageSize,
      total: local.total
    };
  }

  async sync(enquiryId: number) {
    void enquiryId;
    throw AppError.conflict("Sending CRM enquiries to Frappe is disabled.");
  }

  private async request<T>(
    path: string,
    method: "GET" | "POST" | "PUT" | "DELETE",
    body?: unknown,
    settings: FrappeSettings = this.settings
  ): Promise<T> {
    return requestFrappe<T>(path, method, settings, body);
  }
}

export async function requestFrappe<T>(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  settings: FrappeSettings,
  body?: unknown,
  options: { allowExport?: boolean; timeoutMs?: number } = {}
): Promise<T> {
  if (
    !options.allowExport &&
    method !== "GET" &&
    !(method === "POST" && path === "/api/v2/method/frappe.client.get_list")
  )
    throw AppError.conflict("Sending records to Frappe is disabled. Only imports are available.");
  const { baseUrl, apiKey, apiSecret, enabled } = settings;
  if (!enabled) throw AppError.conflict("Frappe sync is disabled.");
  if (!baseUrl || !apiKey || !apiSecret) {
    throw AppError.conflict("Configure the Frappe URL, key and secret before syncing.");
  }
  const url = new URL(baseUrl);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw AppError.validation(
      "Frappe URL must be an HTTP or HTTPS origin without credentials or a query."
    );
  }
  let response: Response;
  try {
    response = await fetch(`${url.toString().replace(/\/$/u, "")}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `token ${apiKey}:${apiSecret}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000)
    });
  } catch {
    throw upstreamError("Frappe could not be reached.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new AppError({
      code: "FRAPPE_AUTH_FAILED",
      message: "Frappe rejected the configured API credentials.",
      statusCode: 502
    });
  }
  if (response.status === 400 || response.status === 422) {
    throw AppError.validation(
      "Frappe rejected the record data. Check required fields and referenced values."
    );
  }
  if (response.status === 404) {
    throw AppError.validation("Frappe could not find a referenced record or DocType.");
  }
  if (response.status === 530) {
    try {
      const detail: unknown = JSON.parse(await readResponse(response));
      if (
        typeof detail === "object" &&
        detail !== null &&
        "error_code" in detail &&
        detail.error_code === 1033
      )
        throw upstreamError(
          "Frappe is unavailable: Cloudflare Tunnel error (HTTP 530, Error 1033). Retry after its tunnel is restored."
        );
    } catch (error) {
      if (error instanceof AppError) throw error;
    }
  }
  if (!response.ok) throw upstreamError(`Frappe returned HTTP ${response.status}.`);
  if (response.status === 204) return {} as T;
  const data = await readResponse(response);
  try {
    return JSON.parse(data) as T;
  } catch {
    throw upstreamError("Frappe returned invalid JSON.");
  }
}

function upstreamError(message: string) {
  return new AppError({ code: "FRAPPE_SYNC_FAILED", message, statusCode: 502 });
}

async function readResponse(response: Response) {
  if (!response.body) throw upstreamError("Frappe returned an empty response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > maxResponseBytes) {
      await reader.cancel();
      throw upstreamError("Frappe response is too large.");
    }
    chunks.push(chunk.value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
