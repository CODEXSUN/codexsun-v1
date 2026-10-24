export type EnquirySavePayload = {
  title: string;
  description: string | null;
  contactId: number | null;
  capturedName: string | null;
  capturedEmail: string | null;
  capturedPhone: string | null;
  source: string;
  sourceReference: string | null;
  listInId: string | null;
  statusId: string;
  priorityId: string;
  assignedUserId: string | null;
  enquiredAt: string;
  dueDate: string | null;
  closedReason: string | null;
};

export type EnquiryRecord = EnquirySavePayload & {
  id: string;
  enquiryNo: string;
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
  assignedToName: string | null;
  closurePending?: boolean;
  frappeSyncStatus?: "pending" | "processing" | "retry" | "failed" | "synced" | "unlinked" | null;
  frappeRemoteName?: string | null;
  frappeSyncError?: string | null;
  canViewFrappeSync?: boolean;
};

export type EnquiryFrappeSyncEvent = {
  id: string;
  eventType: "enquiry-upsert" | "comment-add" | "job-upsert" | "estimate-upsert";
  status: "pending" | "processing" | "retry" | "failed" | "synced";
  attempts: number;
  remoteName: string | null;
  lastError: string | null;
  createdAt: string;
  validation: {
    status: "valid" | "invalid" | "warning";
    errors: string[];
    checkedAt: string;
  } | null;
};

export type EnquiryPage = {
  items: EnquiryRecord[];
  total: number;
  statusCounts: Array<{ code: string; count: number }>;
};

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

export type EnquiryColumnFilters = Partial<Record<Exclude<EnquirySearchColumn, "all">, string>>;
export type EnquiryReportFilters = {
  fromDate?: string | undefined;
  toDate?: string | undefined;
  listInId?: string | undefined;
  createdBy?: string | undefined;
  assignedUserId?: string | undefined;
  filter?: string | undefined;
};
export type EnquiryReportRow = {
  listInId: string | null;
  listIn: string | null;
  createdBy: string;
  assignedUserId: string | null;
  status: string;
  statusName: string;
  count: number;
};
export type EnquiryAttention = {
  assignments: Array<{
    id: number;
    enquiryId: number;
    enquiryNo: number;
    title: string;
    createdAt: string;
  }>;
  due: EnquiryRecord[];
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

export type EnquiryLookup = {
  id: string | number;
  name: string;
  email?: string;
  status: string;
  primaryPhone?: string | null;
  phones?: Array<{ phone: string }>;
};

export type EnquiryMasterLookup = {
  id: string | number;
  name: string;
  status: "active" | "inactive";
  code?: string;
};

export type EnquiryComment = {
  id: string;
  uuid: string;
  enquiryId: string;
  parentId: string | null;
  body: string;
  bodyFormat: "plain" | "html";
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
};

export type EnquiryJobStatus = "running" | "completed" | "cancelled";
export type EnquiryJobSavePayload = {
  employeeUserId: string;
  startAt: string;
  stopAt: string | null;
  ratePerHour: number;
  status: EnquiryJobStatus;
};
export type EnquiryJob = Omit<EnquiryJobSavePayload, "employeeUserId"> & {
  id: string;
  uuid: string;
  enquiryId: string;
  employeeUserId: string | null;
  employee: string;
  durationSeconds: number;
  totalCost: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type EnquiryEstimateSavePayload = {
  date: string;
  itemName: string;
  supplierContactId: string;
  price: number;
};
export type EnquiryEstimate = EnquiryEstimateSavePayload & {
  id: string;
  uuid: string;
  enquiryId: string;
  supplierName: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type EnquiryActivity = {
  id: string;
  uuid: string;
  enquiryId: string;
  action: string;
  details: string;
  createdBy: string;
  createdAt: string;
};

export type EnquiryLocation = {
  id: number;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string;
  createdBy: string;
};

export type EnquiryPropertyPatch = Partial<
  Pick<
    EnquirySavePayload,
    "listInId" | "priorityId" | "assignedUserId" | "dueDate" | "statusId" | "closedReason"
  >
>;
