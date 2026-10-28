import { getTenantDbName, getTenantId, getToken } from "../../../shared/api/tenant-context";
import { requiredClientEnv } from "../../../shared/env/client-env";
import type { FinancialYearRecord, FinancialYearSavePayload } from "./financial-year.types";
const base = requiredClientEnv("VITE_PLATFORM_API_URL");
const path = "/core/organisation/financial-years";
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
    throw new Error(body.success ? "Financial year request failed." : body.error.message);
  return body.data;
}
export const listFinancialYears = (signal?: AbortSignal) =>
  request<FinancialYearRecord[]>("", signal ? { signal } : {});
export const createFinancialYear = (payload: FinancialYearSavePayload) =>
  request<FinancialYearRecord>("", { method: "POST", body: JSON.stringify(payload) });
export const updateFinancialYear = (id: number, payload: FinancialYearSavePayload) =>
  request<FinancialYearRecord>(`/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const activateFinancialYear = (id: number) =>
  request<FinancialYearRecord>(`/${id}/activate`, { method: "POST" });
export const deactivateFinancialYear = (id: number) =>
  request<FinancialYearRecord>(`/${id}/deactivate`, { method: "POST" });
export const setCurrentFinancialYear = (id: number) =>
  request<FinancialYearRecord>(`/${id}/current`, { method: "POST" });
export const forceDeleteFinancialYear = (id: number) =>
  request<FinancialYearRecord>(`/${id}/force`, { method: "DELETE" });
