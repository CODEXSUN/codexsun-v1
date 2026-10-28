type Envelope<T> = { data: T; success: true } | { error: { message: string }; success: false };

export class CrmResponseFormatError extends Error {}

export class CrmHttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function crmRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = (window as Window & { __CODEXSUN_RUNTIME_CONFIG__?: Record<string, string> })
    .__CODEXSUN_RUNTIME_CONFIG__?.VITE_PLATFORM_API_URL;
  if (!baseUrl) throw new Error("Missing VITE_PLATFORM_API_URL for CRM.");
  const database = sessionStorage.getItem("codexsun_tenant_db_name");
  const tenantId = sessionStorage.getItem("codexsun_tenant_id");
  const companyId = sessionStorage.getItem("codexsun.tenant.company-id");
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(database ? { "x-tenant-db": database } : {}),
      ...(tenantId ? { "x-tenant-id": tenantId } : {}),
      ...(companyId ? { "x-company-id": companyId } : {}),
      ...options.headers
    }
  });
  const rawBody = await response.text();
  if (!rawBody.trim()) {
    throw new CrmResponseFormatError(
      `CRM returned an empty response (HTTP ${response.status}) for ${path}. Refresh and check the saved data before retrying.`
    );
  }
  let result: Envelope<T>;
  try {
    result = JSON.parse(rawBody) as Envelope<T>;
  } catch {
    throw new CrmResponseFormatError(
      `CRM returned an invalid response (HTTP ${response.status}) for ${path}.`
    );
  }
  if (!result || typeof result !== "object" || typeof result.success !== "boolean") {
    throw new CrmResponseFormatError(
      `CRM returned an unexpected response (HTTP ${response.status}) for ${path}.`
    );
  }
  if (!result.success && typeof result.error?.message !== "string") {
    throw new CrmResponseFormatError(
      `CRM returned an unexpected error response (HTTP ${response.status}) for ${path}.`
    );
  }
  if (!response.ok || !result.success) {
    throw new CrmHttpError(
      result.success ? "CRM request failed." : result.error.message,
      response.status
    );
  }
  return result.data;
}
