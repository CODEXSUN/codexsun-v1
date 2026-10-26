import { crmRequest } from "../../crm-request";

export const scheduleSources = ["enquiry", "task", "call-log", "duty", "sop"] as const;
export type ScheduleSourceType = (typeof scheduleSources)[number];
export type ScheduleRecord = {
  id: number;
  uuid: string;
  notes: string;
  sourceType: ScheduleSourceType;
  sourceId: number;
  sourceLabel: string;
  scheduledAt: string;
  acknowledgedAt: string | null;
  status: "scheduled" | "completed" | "cancelled";
  assignedUserId: number;
  assignedTo: string;
  createdBy: string;
  createdAt: string;
};
export type ScheduleInput = Pick<
  ScheduleRecord,
  "notes" | "sourceType" | "sourceId" | "scheduledAt"
>;
export type ScheduleSourceOption = { id: number; label: string };

export const listSchedules = (
  view: "schedules" | "reminders" = "schedules",
  source?: { sourceType: ScheduleSourceType; sourceId: number }
) => {
  const query = new URLSearchParams({ view });
  if (source) {
    query.set("sourceType", source.sourceType);
    query.set("sourceId", String(source.sourceId));
  }
  return crmRequest<ScheduleRecord[]>(`/crm/schedules?${query}`);
};
export const listDueReminders = () => crmRequest<ScheduleRecord[]>("/crm/schedules/reminders");
export const searchScheduleSources = (sourceType: ScheduleSourceType, search: string) => {
  const query = new URLSearchParams({ sourceType, search });
  return crmRequest<ScheduleSourceOption[]>(`/crm/schedules/sources?${query}`);
};
export const createSchedule = (input: ScheduleInput) =>
  crmRequest<ScheduleRecord>("/crm/schedules", { method: "POST", body: JSON.stringify(input) });
export const acknowledgeReminder = (id: number) =>
  crmRequest<ScheduleRecord>(`/crm/schedules/${id}/acknowledge`, { method: "POST" });
export const updateScheduleStatus = (id: number, status: "completed" | "cancelled") =>
  crmRequest<ScheduleRecord>(`/crm/schedules/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ status })
  });

export const sourceLabels: Record<ScheduleSourceType, string> = {
  enquiry: "Enquiry",
  task: "Task",
  "call-log": "Call log",
  duty: "Duty",
  sop: "SOP"
};

export const getReminderCount = () =>
  crmRequest<{ total: number }>("/crm/schedules/reminders/count");

export const rescheduleReminder = (id: number, scheduledAt: string) =>
  crmRequest<ScheduleRecord>(`/crm/schedules/${id}/reschedule`, {
    method: "POST",
    body: JSON.stringify({ scheduledAt })
  });
