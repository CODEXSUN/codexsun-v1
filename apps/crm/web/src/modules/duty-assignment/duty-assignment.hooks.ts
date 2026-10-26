import { useQuery } from "@tanstack/react-query";
import { getDutyOptions, listDuties, listOwnDuties } from "./duty-assignment.services";
export function useDutyOptions() {
  return useQuery({ queryKey: ["crm", "duties", "options"], queryFn: getDutyOptions });
}
export function useDutyAssignments(canViewAll: boolean | undefined) {
  return useQuery({
    queryKey: ["crm", "duties", canViewAll],
    queryFn: () => (canViewAll ? listDuties() : listOwnDuties()),
    enabled: canViewAll !== undefined,
    refetchInterval: 15000
  });
}
