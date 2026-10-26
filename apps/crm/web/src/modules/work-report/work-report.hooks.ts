import { useQuery } from "@tanstack/react-query";
import { listWorkHistory } from "./work-report.services";
import type { WorkReportHistoryFilter, WorkReportTarget } from "./work-report.types";
export const workReportKey = (target: WorkReportTarget) => [
  "crm",
  "work-reports",
  target.enquiryId,
  target.taskId
];
export const useWorkReports = (
  target: WorkReportTarget,
  page = 1,
  filter: WorkReportHistoryFilter = "all",
  poll = true
) =>
  useQuery({
    queryKey: [...workReportKey(target), "history", page, filter],
    queryFn: () => listWorkHistory(target, page, filter),
    refetchInterval: poll ? 10000 : false
  });
