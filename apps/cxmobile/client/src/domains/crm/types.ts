/**
 * CRM Mobile Parity Domain Types & Contracts
 * Based on M0 route inventory and @codexsun/crm-web specifications.
 */

export type CrmRouteSection = "pipeline" | "operations" | "compliance" | "masters";

export type CrmRouteKey =
  | "crm.overview"
  | "crm.my-job"
  | "crm.my-calls"
  | "crm.leads"
  | "crm.enquiries"
  | "crm.enquiries.new"
  | "crm.enquiries.show"
  | "crm.tasks"
  | "crm.tasks.new"
  | "crm.tasks.show"
  | "crm.activities"
  | "crm.closures"
  | "crm.schedules"
  | "crm.reminders"
  | "crm.call-logs"
  | "crm.sops"
  | "crm.duties"
  | "crm.duty-assignment"
  | "crm.duty-reporting"
  | "crm.reports"
  | "crm.contacts"
  | "crm.list-in"
  | "crm.status"
  | "crm.priority"
  | "crm.contact-360";

export type CrmPermissionKey =
  | "crm.enquiry.view"
  | "crm.enquiry.view-all"
  | "crm.lead.view"
  | "crm.task.view"
  | "crm.task.view-all"
  | "crm.task.create"
  | "crm.task.update"
  | "crm.task.work"
  | "crm.task.respond"
  | "crm.closure.review"
  | "crm.schedule.view"
  | "crm.schedule.create"
  | "crm.schedule.update-own"
  | "crm.call-log.view"
  | "crm.sop.view"
  | "crm.sop.create"
  | "crm.sop.update"
  | "crm.sop.publish"
  | "crm.duty.view.own"
  | "crm.duty.assign"
  | "crm.duty.manage"
  | "crm.duty-report.view.own"
  | "crm.duty-report.create.own"
  | "crm.duty-report.view.all"
  | "crm.contact.view"
  | "admin"
  | "super-admin";

export interface CrmRouteMetadata {
  description: string;
  id: CrmRouteKey;
  isLocalScopeOnly?: boolean;
  isMasked?: boolean;
  label: string;
  requiredPermissions: CrmPermissionKey[];
  section: CrmRouteSection;
  shortTitle: string;
}

export interface CrmAttachment {
  createdAt?: string | undefined;
  dataBase64?: string | undefined;
  filename: string;
  id?: string | number | undefined;
  mimeType: string;
  sizeBytes?: number | undefined;
  url?: string | undefined;
}

export interface CrmEnquiryInput {
  assignedUserId?: string | null;
  capturedEmail?: string | null;
  capturedName?: string | null;
  capturedPhone?: string | null;
  closedReason?: string | null;
  contactId?: number | null;
  customerName?: string;
  description?: string | null;
  dueDate?: string | null;
  email?: string;
  enquiredAt?: string;
  listInId?: string | null;
  mobile?: string;
  priorityId?: string;
  requirements?: string;
  source?: string;
  sourceName?: string;
  sourceReference?: string | null;
  statusId?: string;
  statusName?: string;
  title?: string;
}

export interface CrmEnquiryRecord {
  assignedToName?: string | null;
  assignedUserId?: string | null;
  capturedEmail?: string | null;
  capturedName?: string | null;
  capturedPhone?: string | null;
  closedReason?: string | null;
  closurePending?: boolean;
  contactId?: number | null;
  contactName?: string | null;
  createdAt: string;
  createdBy: string;
  createdByName?: string | null;
  customerName?: string;
  description?: string | null;
  dueDate?: string | null;
  email?: string;
  enquiryNo?: string | number;
  id: string;
  listIn?: string | null;
  listInId?: string | null;
  mobile?: string;
  priority?: string;
  priorityId?: string;
  priorityName?: string;
  requirements?: string;
  source?: string;
  status?: string;
  statusId?: string;
  statusName?: string;
  title?: string;
  updatedAt: string;
  uuid?: string;
}

export interface CrmEnquiryComment {
  attachment?: CrmAttachment | null;
  body: string;
  bodyFormat?: "plain" | "html";
  createdAt: string;
  createdBy: string;
  createdByName?: string | null;
  enquiryId: string;
  id: string | number;
  parentId?: string | number | null;
  uuid?: string;
}

export interface CrmEnquiryJob {
  createdAt: string;
  createdBy: string;
  durationSeconds: number;
  employee?: string;
  employeeUserId?: string | null;
  enquiryId: string;
  id: string;
  ratePerHour: number;
  startAt: string;
  status: "running" | "completed" | "cancelled";
  stopAt?: string | null;
  totalCost?: number;
  uuid?: string;
}

export interface CrmTaskInput {
  assignedUserId?: number | null;
  contactId?: number | null;
  description?: string | null;
  dueDate?: string | null;
  listInId?: number | null;
  priorityId?: number;
  statusId?: number;
  title: string;
}

export interface CrmTaskRecord {
  assignedTo?: string | null;
  assignedUserId?: number | null;
  contactId?: number | null;
  contactName?: string | null;
  createdAt: string;
  createdBy: string;
  creator?: string;
  description?: string | null;
  dueDate?: string | null;
  id: number;
  listIn?: string | null;
  listInId?: number | null;
  priority?: string;
  priorityId?: number;
  status?: string;
  statusId?: number;
  title: string;
  updatedAt?: string;
  uuid?: string;
}

export interface CrmTaskComment {
  body: string;
  createdAt: string;
  createdBy?: string;
  id: number;
  parentId?: number | null;
  taskId: number;
}

export interface CrmTaskJob {
  createdAt: string;
  createdBy?: string;
  durationSeconds?: number;
  id: number;
  startAt: string;
  status: "running" | "completed";
  stopAt?: string | null;
  taskId: number;
}

export interface CrmClosureRequest {
  createdAt: string;
  createdBy?: string;
  id: number;
  note?: string;
  reason?: string;
  recordId?: string | number;
  recordType?: "enquiry" | "task";
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  status: "pending" | "approved" | "rejected";
}

export interface CrmScheduleInput {
  notes: string;
  scheduledAt: string;
  sourceId: number;
  sourceType: "enquiry" | "task" | "call-log" | "duty" | "sop";
}

export interface CrmScheduleRecord {
  acknowledgedAt?: string | null;
  assignedTo?: string;
  assignedUserId?: number;
  createdAt: string;
  createdBy: string;
  id: number;
  notes: string;
  scheduledAt: string;
  sourceId: number;
  sourceLabel?: string;
  sourceType: "enquiry" | "task" | "call-log" | "duty" | "sop";
  status: "scheduled" | "completed" | "cancelled";
  uuid?: string;
}

export interface CrmCallLogInput {
  contactName: string;
  notes?: string;
  phone: string;
  status: string;
  type: string;
}

export interface CrmCallLogRecord {
  contactName: string;
  createdAt: string;
  createdBy?: string;
  id: number | string;
  name?: string;
  notes?: string;
  phone: string;
  status: string;
  type: string;
}

export interface CrmSopInput {
  code: string;
  purpose: string;
  title: string;
}

export interface CrmSopRecord {
  code: string;
  id: number;
  purpose: string;
  status: "active" | "inactive";
  title: string;
}

export interface CrmSopItemInput {
  code: string;
  department: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "annually" | "once";
  revision: { evidenceGuidance: string; instructions: string };
  sopId: number;
  sortOrder: number;
  title: string;
}

export interface CrmSopItemRecord {
  code: string;
  currentRevision?: {
    evidenceGuidance: string;
    id: number;
    instructions: string;
    revision: number;
    status: string;
  } | null;
  department: string;
  frequency: string;
  id: number;
  sopId: number;
  sortOrder: number;
  status: "active" | "inactive";
  title: string;
}

export interface CrmDutyAssignmentInput {
  assigneeUserId: number;
  displayOrder: number;
  endDate?: string | null;
  revisionId: number;
  sopItemId: number;
  startDate: string;
}

export interface CrmDutyAssignmentRecord {
  assigneeEmail?: string;
  assigneeName: string;
  assigneeUserId: number;
  displayOrder: number;
  endDate?: string | null;
  id: number;
  itemTitle: string;
  revisionId: number;
  sopItemId: number;
  sopTitle: string;
  startDate: string;
  status: string;
}

export interface CrmDutyReportInput {
  actions: string;
  assignmentId: number;
  performedDate: string;
}

export interface CrmDutyReportRecord {
  actions: string;
  assigneeUserId?: number;
  assignmentId: number;
  createdAt?: string;
  id: number;
  issueDetails?: string;
  performedDate: string;
  result?: string;
}

export interface CrmMasterRecord {
  code?: string;
  id: number;
  name: string;
  status: "active" | "inactive";
}

export interface CrmMasterInput {
  code?: string;
  name: string;
  sortOrder?: number;
}
