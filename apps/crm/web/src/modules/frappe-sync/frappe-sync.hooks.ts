import { useQuery } from "@tanstack/react-query";
import { crmRequest } from "../../crm-request";

export function useCrmFrappeSyncEnabled() {
  const tenant = sessionStorage.getItem("codexsun_tenant_id");
  const database = sessionStorage.getItem("codexsun_tenant_db_name");
  const query = useQuery({
    queryKey: ["crm", "frappe-sync-capabilities", tenant, database],
    queryFn: () => crmRequest<{ enabled: boolean }>("/crm/frappe-sync/capabilities"),
    refetchInterval: 5000,
    staleTime: 0,
    retry: false
  });
  return !query.isError && query.data?.enabled === true;
}
