import { getTenantDbName, getTenantId, getToken } from "../../../shared/api/tenant-context";
import { requiredClientEnv } from "../../../shared/env/client-env";
import type {
  DefaultCompanyLookup,
  DefaultCompanyRecord,
  DefaultCompanySavePayload
} from "./default-company.types";
const base = requiredClientEnv("VITE_PLATFORM_API_URL");
const path = "/core/organisation/default-company";
type Envelope<T> = { data: T; success: true } | { error: { message: string }; success: false };
async function request<T>(suffix = "", options: RequestInit = {}) {
  const token = getToken("tenant");
  const database = getTenantDbName();
  const response = await fetch(`${base}${path}${suffix}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(database ? { "x-tenant-db": database } : {}),

      ...(getTenantId() ? { "x-tenant-id": getTenantId()! } : {}),
      ...options.headers
    }
  });
  const body = (await response.json()) as Envelope<T>;
  if (!response.ok || !body.success)
    throw new Error(body.success ? "Default company request failed." : body.error.message);
  return body.data;
}
export const getDefaultCompany = (signal?: AbortSignal) =>
  request<DefaultCompanyRecord | null>("", signal ? { signal } : {});
export const saveDefaultCompany = (payload: DefaultCompanySavePayload) =>
  request<DefaultCompanyRecord>("", { method: "PUT", body: JSON.stringify(payload) });
export const listDefaultCompanyLookups = async () => {
  const [companies, financialYears] = await Promise.all([
    request<DefaultCompanyLookup[]>("/company-lookups"),
    request<DefaultCompanyLookup[]>("/financial-year-lookups")
  ]);
  return { companies, financialYears };
};
