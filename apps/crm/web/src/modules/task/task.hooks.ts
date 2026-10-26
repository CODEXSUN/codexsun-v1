import { useQuery } from "@tanstack/react-query";
import { getTask, getTaskOptions, listTasks } from "./task.services";
import type { TaskColumnFilters } from "./task.types";
export const taskQueryKey = ["crm", "tasks"] as const;
export const taskOptionsQueryKey = ["crm", "tasks", "options"] as const;
export function useTasks(
  search: string,
  page: number,
  pageSize: number,
  filter: string,
  columnFilters: TaskColumnFilters,
  dateRange: { fromDate: string; toDate: string } = { fromDate: "", toDate: "" }
) {
  return useQuery({
    queryKey: [...taskQueryKey, search, filter, columnFilters, dateRange, page, pageSize],
    queryFn: () => listTasks(search, page, pageSize, filter, columnFilters, dateRange),
    refetchInterval: 15000
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: [...taskQueryKey, "detail", id],
    queryFn: () => getTask(Number(id)),
    enabled: Boolean(id)
  });
}
export function useTaskOptions() {
  return useQuery({ queryKey: taskOptionsQueryKey, queryFn: getTaskOptions });
}

export function useTaskNavigationCount(enabled: boolean) {
  const query = useQuery({
    queryKey: [...taskQueryKey, "navigation-count", "active"],
    queryFn: async () => (await listTasks("", 1, 1, "active", {})).total,
    enabled
  });

  return query.data ?? 0;
}
