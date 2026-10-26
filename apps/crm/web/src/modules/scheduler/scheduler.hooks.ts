import { useQuery } from "@tanstack/react-query";
import { getReminderCount } from "./scheduler.services";

export function useReminderNavigationCount(enabled: boolean) {
  const query = useQuery({
    queryKey: ["crm-schedules", "navigation-count"],
    queryFn: getReminderCount,
    enabled,
    refetchInterval: 15000
  });
  return query.data?.total ?? 0;
}
