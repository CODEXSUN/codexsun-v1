import { useSyncExternalStore } from "react";

export function leadQueryScope() {
  if (typeof sessionStorage === "undefined") return "";
  return JSON.stringify([
    sessionStorage.getItem("codexsun_tenant_id"),
    sessionStorage.getItem("codexsun_tenant_db_name"),
    sessionStorage.getItem("codexsun.tenant.company-id")
  ]);
}

export const leadDetailQueryKey = (uuid: string) =>
  ["crm", "lead", leadQueryScope(), uuid] as const;
export function leadRequestContext(scope = leadQueryScope()) {
  const [tenantId, database, companyId] = JSON.parse(scope || "[]") as Array<string | null>;
  return {
    headers: {
      ...(tenantId ? { "x-tenant-id": tenantId } : {}),
      ...(database ? { "x-tenant-db": database } : {}),
      ...(companyId ? { "x-company-id": companyId } : {})
    }
  };
}
export const useLeadQueryScope = () => useSyncExternalStore(subscribe, leadQueryScope, () => "");

function subscribe(onChange: () => void) {
  const events = ["codexsun:company-change", "codexsun:tenant-change", "storage"];
  for (const event of events) window.addEventListener(event, onChange);
  return () => {
    for (const event of events) window.removeEventListener(event, onChange);
  };
}
