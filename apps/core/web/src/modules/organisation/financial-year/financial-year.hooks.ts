import { useQuery } from "@tanstack/react-query";
import { listFinancialYears } from "./financial-year.services";
export const financialYearsQueryKey = ["core", "organisation", "financial-years"] as const;
export function useFinancialYears() {
  return useQuery({ queryKey: financialYearsQueryKey, queryFn: () => listFinancialYears() });
}
