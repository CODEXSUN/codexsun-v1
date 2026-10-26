import type { DutyReportDrilldown } from "./duty-report.types";
import { useQuery } from "@tanstack/react-query";
import { getReportOptions, listReports } from "./duty-report.services";
export function useReportOptions() {
  return useQuery({ queryKey: ["crm", "duty-reports", "options"], queryFn: getReportOptions });
}
export function useDutyReportPage(
  search: string,
  page: number,
  from: string,
  to: string,
  canViewAll: boolean | undefined,
  filters: DutyReportDrilldown = {}
) {
  return useQuery({
    queryKey: ["crm", "duty-reports", search, page, from, to, canViewAll, filters],
    queryFn: () => listReports(search, page, from, to, filters),
    enabled: canViewAll === true,
    refetchInterval: 15000
  });
}
