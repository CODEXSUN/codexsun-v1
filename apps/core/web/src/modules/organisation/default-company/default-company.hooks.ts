import { useQuery } from "@tanstack/react-query";
import { getDefaultCompany, listDefaultCompanyLookups } from "./default-company.services";
export const defaultCompanyQueryKey = ["core", "organisation", "default-company"] as const;
export const defaultCompanyLookupsQueryKey = [...defaultCompanyQueryKey, "lookups"] as const;
export function useDefaultCompany() {
  return useQuery({ queryKey: defaultCompanyQueryKey, queryFn: () => getDefaultCompany() });
}
export function useDefaultCompanyLookups() {
  return useQuery({ queryKey: defaultCompanyLookupsQueryKey, queryFn: listDefaultCompanyLookups });
}
