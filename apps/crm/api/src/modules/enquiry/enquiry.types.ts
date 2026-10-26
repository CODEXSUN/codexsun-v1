import type { ColumnType, Generated } from "kysely";
import type { ListInDatabase } from "../list-in/index.js";
import type { StatusDatabase } from "../status/index.js";
import type { PriorityDatabase } from "../priority/index.js";

export type EnquiryInput = {
  title: string;
  description: string | null;
  contactId: number | null;
  capturedName: string | null;
  capturedEmail: string | null;
  capturedPhone: string | null;
  source: string;
  sourceReference: string | null;
  listInId: number | null;
  statusId: number;
  priorityId: number;
  assignedUserId: number | null;
  enquiredAt: string;
  dueDate: string | null;
  closedReason: string | null;
};

export type EnquiryRecord = EnquiryInput & {
  id: number;
  enquiryNo: number;
  uuid: string;
  contactName: string | null;
  listIn: string | null;
  status: string;
  statusName: string;
  priority: string;
  priorityName: string;
  createdBy: string;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
  closurePending?: boolean;
  runningJobId?: number | null;
  runningJobStartedAt?: string | null;
};

export type EnquiryListScope = "all" | "assigned" | "created";
export type EnquirySearchColumn =
  | "all"
  | "customer"
  | "details"
  | "listIn"
  | "dueDate"
  | "priority"
  | "creator"
  | "assignedTo"
  | "status";
export type EnquiryListOptions = {
  scope: EnquiryListScope;
  page: number;
  pageSize: number;
  search: string;
  mobile?: string | undefined;
  contactId?: number | undefined;
  searchCustomer?: string | undefined;
  searchDetails?: string | undefined;
  searchListIn?: string | undefined;
  searchDueDate?: string | undefined;
  searchPriority?: string | undefined;
  searchCreator?: string | undefined;
  searchAssignedTo?: string | undefined;
  searchStatus?: string | undefined;
  filter: string;
  fromAt?: string | undefined;
  toAt?: string | undefined;
  listInId?: string | undefined;
  createdBy?: string | undefined;
  assignedUserId?: string | undefined;
  actorEmail: string;
  actorUserId: number | null;
  canViewAll: boolean;
};
export type EnquiryReportRow = {
  listInId: number | null;
  listIn: string | null;
  createdBy: string;
  assignedUserId: number | null;
  status: string;
  statusName: string;
  count: number;
};
export type EnquiryPage = {
  items: EnquiryRecord[];
  total: number;
  statusCounts: Array<{ code: string; count: number }>;
};
export type EnquiryScopeSummary = {
  total: number;
  active: number;
  newCalls: number;
  attention: number;
  updated7: number;
  updated30: number;
  created7: number;
  created30: number;
  oldestActiveDays: number | null;
  statusCounts: Array<{ code: string; count: number }>;
  priorityCounts: Array<{ code: string; count: number }>;
};
export type EnquirySummary = {
  allCount: number;
  assigned: EnquiryScopeSummary;
  created: EnquiryScopeSummary;
  all: EnquiryScopeSummary;
};

export type EnquiryRow = {
  id: Generated<number>;
  enquiry_no: number;
  uuid: Generated<string>;
  title: string;
  description: string | null;
  contact_id: number | null;
  captured_name: string | null;
  captured_email: string | null;
  captured_phone: string | null;
  source: string;
  source_reference: string | null;
  list_in_id: number | null;
  status_id: number;
  priority_id: number;
  assigned_user_id: number | null;
  enquired_at: string;
  due_date: string | null;
  closed_reason: string | null;
  created_by: string;
  created_at: ColumnType<string, string | undefined, string>;
  updated_at: ColumnType<string, string | undefined, string>;
};

export type EnquiryDatabase = ListInDatabase &
  StatusDatabase &
  PriorityDatabase & {
    crm_enquiries: EnquiryRow;
    crm_enquiry_sync_events: EnquirySyncEventRow;
    crm_enquiry_sync_validation: EnquirySyncValidationRow;
    crm_enquiry_number_sequence: { id: number; next_no: number };
    crm_enquiry_comments: EnquiryCommentRow;
    crm_enquiry_jobs: EnquiryJobRow;
    crm_enquiry_estimates: EnquiryEstimateRow;
    crm_enquiry_activity: EnquiryActivityRow;
    crm_enquiry_alerts: EnquiryAlertRow;
    app_users: { id: number; name: string; email: string; status: string };
  };

export type EnquirySyncEventRow = {
  id: Generated<number>;
  uuid: Generated<string>;
  enquiry_id: number;
  event_type: "enquiry-upsert" | "comment-add" | "job-upsert" | "estimate-upsert";
  entity_id: number | null;
  actor_email: string;
  correlation_id: string;
  idempotency_key: string;
  status: "pending" | "processing" | "synced" | "retry" | "failed";
  attempts: Generated<number>;
  available_at: ColumnType<string, string | undefined, string>;
  remote_name: string | null;
  last_error: string | null;
  created_at: ColumnType<string, string | undefined, never>;
  updated_at: ColumnType<string, string | undefined, string>;
};

export type EnquirySyncValidationRow = {
  id: Generated<number>;
  uuid: Generated<string>;
  event_id: number;
  validation_status: "valid" | "invalid" | "warning";
  errors_json: string;
  checked_at: ColumnType<string, string | undefined, string>;
};

export type EnquiryAlertRow = {
  id: Generated<number>;
  uuid: Generated<string>;
  enquiry_id: number;
  user_id: number;
  kind: "assigned";
  read_at: string | null;
  status: "active";
  created_by: string;
  created_at: ColumnType<string, string | undefined, never>;
  updated_at: ColumnType<string, string | undefined, never>;
};
export type EnquiryAlert = {
  id: number;
  enquiryId: number;
  enquiryNo: number;
  title: string;
  createdAt: string;
};

export type EnquiryCommentRow = {
  created_by_name?: string | null;
  request_id: Generated<string | null>;
  id: Generated<number>;
  uuid: Generated<string>;
  enquiry_id: number;
  parent_id: number | null;
  body: string;
  body_format: Generated<"plain" | "html">;
  status: "active";
  created_by: string;
  created_at: ColumnType<string, string | undefined, string>;
  updated_at: ColumnType<string, string | undefined, string>;
};

export type EnquiryComment = {
  id: number;
  uuid: string;
  enquiryId: number;
  parentId: number | null;
  body: string;
  bodyFormat: "plain" | "html";
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
};

export type EnquiryJobStatus = "running" | "completed" | "cancelled";
export type EnquiryJobInput = {
  employeeUserId: number;
  startAt: string;
  stopAt: string | null;
  ratePerHour: number;
  status: EnquiryJobStatus;
};
export type EnquiryJobRow = {
  id: Generated<number>;
  uuid: Generated<string>;
  enquiry_id: number;
  employee_user_id: number | null;
  employee: string;
  start_at: string;
  stop_at: string | null;
  duration_seconds: number;
  rate_per_hour: string;
  total_cost: string;
  status: EnquiryJobStatus;
  created_by: string;
  created_at: ColumnType<string, string | undefined, never>;
  updated_at: ColumnType<string, string | undefined, never>;
};
export type EnquiryJob = Omit<EnquiryJobInput, "employeeUserId"> & {
  id: number;
  uuid: string;
  enquiryId: number;
  employeeUserId: number | null;
  employee: string;
  durationSeconds: number;
  totalCost: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type EnquiryEstimateInput = {
  date: string;
  itemName: string;
  supplierContactId: number;
  price: number;
};
export type EnquiryEstimateRow = {
  id: Generated<number>;
  uuid: Generated<string>;
  enquiry_id: number;
  estimate_date: string;
  item_name: string;
  supplier_contact_id: number;
  supplier_name: string;
  price: string;
  status: "active";
  created_by: string;
  created_at: ColumnType<string, string | undefined, never>;
  updated_at: ColumnType<string, string | undefined, never>;
};
export type EnquiryEstimate = EnquiryEstimateInput & {
  id: number;
  uuid: string;
  enquiryId: number;
  supplierName: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type EnquiryActivityRow = {
  id: Generated<number>;
  uuid: Generated<string>;
  enquiry_id: number;
  action: string;
  details: string;
  status: "active";
  created_by: string;
  created_at: ColumnType<string, string | undefined, never>;
  updated_at: ColumnType<string, string | undefined, never>;
};
export type EnquiryActivity = {
  id: number;
  uuid: string;
  enquiryId: number;
  action: string;
  details: string;
  createdBy: string;
  createdAt: string;
};
