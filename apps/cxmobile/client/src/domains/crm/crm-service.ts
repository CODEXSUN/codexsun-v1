/**
 * CRM Service Layer for cxmobile Native Transport
 * Exposes all supported M0 workflows, role/permission checks, and persistence reload guarantees.
 */

import type { NativeHttpTransport } from "../../native/http.js";
import { formatAttachmentCommentBody, uploadCrmAttachment } from "./crm-attachment.js";
import { assertCrmPermission, CrmPermissionDeniedError } from "./crm-routes.js";
import type {
  CrmAttachment,
  CrmCallLogInput,
  CrmCallLogRecord,
  CrmClosureRequest,
  CrmDutyAssignmentInput,
  CrmDutyAssignmentRecord,
  CrmDutyReportInput,
  CrmDutyReportRecord,
  CrmEnquiryComment,
  CrmEnquiryInput,
  CrmEnquiryJob,
  CrmEnquiryRecord,
  CrmMasterInput,
  CrmMasterRecord,
  CrmScheduleInput,
  CrmScheduleRecord,
  CrmSopInput,
  CrmSopItemInput,
  CrmSopItemRecord,
  CrmSopRecord,
  CrmTaskComment,
  CrmTaskInput,
  CrmTaskJob,
  CrmTaskRecord
} from "./types.js";

export class CrmService {
  private readonly transport: NativeHttpTransport;
  private readonly hasPermissionFn: (perm: string) => boolean;

  constructor(transport: NativeHttpTransport, hasPermissionFn: (perm: string) => boolean = () => true) {
    this.transport = transport;
    this.hasPermissionFn = hasPermissionFn;
  }

  // ==========================================
  // 1. OVERVIEW & METRICS
  // ==========================================

  public async getOverviewCounts(): Promise<{
    active: number;
    allCount: number;
    attention: number;
    newCalls: number;
    total: number;
  }> {
    assertCrmPermission("crm.enquiry.view", this.hasPermissionFn, "crm.overview");
    return this.transport.get<{
      active: number;
      allCount: number;
      attention: number;
      newCalls: number;
      total: number;
    }>("/crm/enquiries/counts");
  }

  public async getEnquirySummary(): Promise<Record<string, unknown>> {
    assertCrmPermission("crm.enquiry.view", this.hasPermissionFn, "crm.overview");
    const today = new Date().toISOString().slice(0, 10);
    return this.transport.get<Record<string, unknown>>(`/crm/enquiries/summary?today=${today}`);
  }

  public async getEnquiryAttention(): Promise<Record<string, unknown>> {
    assertCrmPermission("crm.enquiry.view", this.hasPermissionFn, "crm.overview");
    const today = new Date().toISOString().slice(0, 10);
    return this.transport.get<Record<string, unknown>>(`/crm/enquiries/attention?today=${today}`);
  }

  // ==========================================
  // 2. ENQUIRIES (ALL, MY-JOB, MY-CALLS)
  // ==========================================

  public async listEnquiries(options: {
    columnFilters?: Record<string, string>;
    contactId?: number;
    filter?: string;
    mobile?: string;
    page?: number;
    pageSize?: number;
    scope?: "all" | "assigned" | "created";
    search?: string;
  } = {}): Promise<{
    items: CrmEnquiryRecord[];
    statusCounts: Array<{ code: string; count: number }>;
    total: number;
  }> {
    assertCrmPermission("crm.enquiry.view", this.hasPermissionFn, "crm.enquiries");

    const query = new URLSearchParams({
      filter: options.filter ?? "all",
      page: String(options.page ?? 1),
      pageSize: String(options.pageSize ?? 100),
      scope: options.scope ?? "all",
      search: options.search ?? ""
    });

    if (options.mobile) query.set("mobile", options.mobile);
    if (options.contactId) query.set("contactId", String(options.contactId));

    if (options.columnFilters) {
      for (const [col, val] of Object.entries(options.columnFilters)) {
        if (val.trim()) query.set(`search${col[0]!.toUpperCase()}${col.slice(1)}`, val.trim());
      }
    }

    return this.transport.get<{
      items: CrmEnquiryRecord[];
      statusCounts: Array<{ code: string; count: number }>;
      total: number;
    }>(`/crm/enquiries?${query.toString()}`);
  }

  public async getEnquiry(id: string): Promise<CrmEnquiryRecord> {
    assertCrmPermission("crm.enquiry.view", this.hasPermissionFn, "crm.enquiries.show");
    return this.transport.get<CrmEnquiryRecord>(`/crm/enquiries/${encodeURIComponent(id)}`);
  }

  public async createEnquiry(input: CrmEnquiryInput): Promise<CrmEnquiryRecord> {
    assertCrmPermission("crm.enquiry.view", this.hasPermissionFn, "crm.enquiries.new");
    const payload = {
      assignedUserId: input.assignedUserId ?? null,
      capturedEmail: input.email ?? input.capturedEmail ?? null,
      capturedName: input.customerName ?? input.capturedName ?? null,
      capturedPhone: input.mobile ?? input.capturedPhone ?? null,
      closedReason: input.closedReason ?? null,
      contactId: input.contactId ?? null,
      customerName: input.customerName ?? "Customer Enquiry",
      description: input.requirements ?? input.description ?? null,
      dueDate: input.dueDate ?? null,
      enquiredAt: input.enquiredAt ?? new Date().toISOString(),
      listInId: input.listInId ?? null,
      priorityId: input.priorityId ?? "1",
      requirements: input.requirements ?? "General enquiry",
      source: input.source ?? input.sourceName ?? "Mobile App",
      sourceName: input.sourceName ?? "Mobile App",
      sourceReference: input.sourceReference ?? null,
      statusId: input.statusId ?? "1",
      statusName: input.statusName ?? "open",
      title: input.title ?? input.customerName ?? "New Customer Enquiry"
    };

    return this.transport.post<CrmEnquiryRecord>("/crm/enquiries", payload);
  }

  public async updateEnquiry(id: string, payload: Partial<CrmEnquiryInput>): Promise<CrmEnquiryRecord> {
    assertCrmPermission("crm.enquiry.view", this.hasPermissionFn, "crm.enquiries.show");
    return this.transport.put<CrmEnquiryRecord>(`/crm/enquiries/${encodeURIComponent(id)}`, payload);
  }

  public async updateEnquiryProperties(
    id: string,
    patch: {
      assignedUserId?: string | null;
      dueDate?: string | null;
      listInId?: string | null;
      priorityId?: string;
      statusId?: string;
    }
  ): Promise<CrmEnquiryRecord> {
    assertCrmPermission("crm.enquiry.view", this.hasPermissionFn, "crm.enquiries.show");
    return this.transport.patch<CrmEnquiryRecord>(
      `/crm/enquiries/${encodeURIComponent(id)}/properties`,
      patch
    );
  }

  public async assignEnquiry(id: string, assignedUserId: string): Promise<CrmEnquiryRecord> {
    return this.updateEnquiryProperties(id, { assignedUserId });
  }

  public async updateEnquiryStatus(id: string, statusId: string): Promise<CrmEnquiryRecord> {
    return this.updateEnquiryProperties(id, { statusId });
  }

  public async updateEnquiryPriority(id: string, priorityId: string): Promise<CrmEnquiryRecord> {
    return this.updateEnquiryProperties(id, { priorityId });
  }

  public async openNewEnquiryCall(id: string): Promise<CrmEnquiryRecord> {
    assertCrmPermission("crm.enquiry.view", this.hasPermissionFn, "crm.my-calls");
    return this.transport.post<CrmEnquiryRecord>(
      `/crm/enquiries/${encodeURIComponent(id)}/open-new-call`,
      {}
    );
  }

  // ==========================================
  // ENQUIRY COMMENTS & ATTACHMENTS
  // ==========================================

  public async listEnquiryComments(enquiryId: string): Promise<CrmEnquiryComment[]> {
    assertCrmPermission("crm.enquiry.view", this.hasPermissionFn, "crm.enquiries.show");
    return this.transport.get<CrmEnquiryComment[]>(
      `/crm/enquiries/${encodeURIComponent(enquiryId)}/comments`
    );
  }

  public async addEnquiryComment(
    enquiryId: string,
    body: string,
    parentId: string | null = null,
    attachment?: {
      data: Blob | string;
      filename: string;
      mimeType?: string;
    }
  ): Promise<CrmEnquiryComment> {
    assertCrmPermission("crm.enquiry.view", this.hasPermissionFn, "crm.enquiries.show");

    let uploadedAttachment: CrmAttachment | undefined;
    let finalBody = body;

    if (attachment) {
      uploadedAttachment = await uploadCrmAttachment(
        this.transport,
        `/crm/enquiries/${encodeURIComponent(enquiryId)}/attachments`,
        attachment
      );
      finalBody = formatAttachmentCommentBody(body, uploadedAttachment);
    }

    return this.transport.post<CrmEnquiryComment>(
      `/crm/enquiries/${encodeURIComponent(enquiryId)}/comments`,
      {
        attachment: uploadedAttachment ?? null,
        body: finalBody,
        bodyFormat: "plain",
        parentId
      }
    );
  }

  // ==========================================
  // ENQUIRY JOBS & TIMER
  // ==========================================

  public async listEnquiryJobs(enquiryId: string): Promise<CrmEnquiryJob[]> {
    assertCrmPermission("crm.enquiry.view", this.hasPermissionFn, "crm.enquiries.show");
    return this.transport.get<CrmEnquiryJob[]>(
      `/crm/enquiries/${encodeURIComponent(enquiryId)}/jobs`
    );
  }

  public async startEnquiryJob(enquiryId: string): Promise<CrmEnquiryJob> {
    assertCrmPermission("crm.enquiry.view", this.hasPermissionFn, "crm.enquiries.show");
    return this.transport.post<CrmEnquiryJob>(
      `/crm/enquiries/${encodeURIComponent(enquiryId)}/jobs/start`,
      {}
    );
  }

  public async stopEnquiryJob(enquiryId: string, jobId: string): Promise<CrmEnquiryJob> {
    assertCrmPermission("crm.enquiry.view", this.hasPermissionFn, "crm.enquiries.show");
    return this.transport.post<CrmEnquiryJob>(
      `/crm/enquiries/${encodeURIComponent(enquiryId)}/jobs/${encodeURIComponent(jobId)}/stop`,
      {}
    );
  }

  public async requestEnquiryClosure(enquiryId: string, note: string): Promise<CrmClosureRequest> {
    assertCrmPermission("crm.enquiry.view", this.hasPermissionFn, "crm.enquiries.show");
    return this.transport.post<CrmClosureRequest>(
      `/crm/enquiries/${encodeURIComponent(enquiryId)}/closure-requests`,
      { note }
    );
  }

  // ==========================================
  // 3. MARKETING LEADS
  // ==========================================

  public async listLeads(): Promise<Array<{
    company?: string;
    createdAt: string;
    email: string;
    id: number | string;
    mobile?: string;
    name: string;
    status: string;
    uuid: string;
  }>> {
    assertCrmPermission("crm.lead.view", this.hasPermissionFn, "crm.leads");
    return this.transport.get<Array<{
      company?: string;
      createdAt: string;
      email: string;
      id: number | string;
      mobile?: string;
      name: string;
      status: string;
      uuid: string;
    }>>("/crm/leads");
  }

  public async getLead(uuid: string): Promise<{
    company?: string;
    createdAt: string;
    email: string;
    id: number | string;
    mobile?: string;
    name: string;
    notes?: string;
    status: string;
    uuid: string;
  }> {
    assertCrmPermission("crm.lead.view", this.hasPermissionFn, "crm.leads");
    return this.transport.get<{
      company?: string;
      createdAt: string;
      email: string;
      id: number | string;
      mobile?: string;
      name: string;
      notes?: string;
      status: string;
      uuid: string;
    }>(`/crm/leads/${encodeURIComponent(uuid)}`);
  }

  // ==========================================
  // 4. TASKS (LOCAL SCOPE PRESERVED)
  // ==========================================

  public async listTasks(options: {
    columnFilters?: Record<string, string>;
    contactId?: number;
    filter?: string;
    page?: number;
    pageSize?: number;
    search?: string;
  } = {}): Promise<{
    items: CrmTaskRecord[];
    statusCounts: Array<{ code: string; count: number }>;
    total: number;
  }> {
    assertCrmPermission("crm.task.view", this.hasPermissionFn, "crm.tasks");

    const query = new URLSearchParams({
      filter: options.filter ?? "all",
      page: String(options.page ?? 1),
      pageSize: String(options.pageSize ?? 100),
      search: options.search ?? ""
    });

    if (options.contactId) query.set("contactId", String(options.contactId));

    if (options.columnFilters) {
      for (const [col, val] of Object.entries(options.columnFilters)) {
        if (val.trim()) query.set(col, val.trim());
      }
    }

    return this.transport.get<{
      items: CrmTaskRecord[];
      statusCounts: Array<{ code: string; count: number }>;
      total: number;
    }>(`/crm/tasks?${query.toString()}`);
  }

  public async getTask(id: number): Promise<CrmTaskRecord> {
    assertCrmPermission("crm.task.view", this.hasPermissionFn, "crm.tasks.show");
    return this.transport.get<CrmTaskRecord>(`/crm/tasks/${id}`);
  }

  public async createTask(payload: CrmTaskInput): Promise<CrmTaskRecord> {
    assertCrmPermission("crm.task.create", this.hasPermissionFn, "crm.tasks.new");
    return this.transport.post<CrmTaskRecord>("/crm/tasks", payload);
  }

  public async updateTask(id: number, payload: Partial<CrmTaskInput>): Promise<CrmTaskRecord> {
    assertCrmPermission("crm.task.update", this.hasPermissionFn, "crm.tasks.show");
    return this.transport.put<CrmTaskRecord>(`/crm/tasks/${id}`, payload);
  }

  public async updateTaskProperties(
    id: number,
    patch: {
      assignedUserId?: number | null;
      dueDate?: string | null;
      listInId?: number | null;
      priorityId?: number;
      statusId?: number;
    }
  ): Promise<CrmTaskRecord> {
    assertCrmPermission("crm.task.update", this.hasPermissionFn, "crm.tasks.show");
    return this.transport.patch<CrmTaskRecord>(`/crm/tasks/${id}/properties`, patch);
  }

  public async listTaskComments(taskId: number): Promise<CrmTaskComment[]> {
    assertCrmPermission("crm.task.view", this.hasPermissionFn, "crm.tasks.show");
    return this.transport.get<CrmTaskComment[]>(`/crm/tasks/${taskId}/comments`);
  }

  public async addTaskComment(
    taskId: number,
    body: string,
    parentId: number | null = null
  ): Promise<CrmTaskComment> {
    assertCrmPermission("crm.task.respond", this.hasPermissionFn, "crm.tasks.show");
    return this.transport.post<CrmTaskComment>(`/crm/tasks/${taskId}/comments`, {
      body,
      parentId
    });
  }

  public async listTaskJobs(taskId: number): Promise<CrmTaskJob[]> {
    assertCrmPermission("crm.task.view", this.hasPermissionFn, "crm.tasks.show");
    return this.transport.get<CrmTaskJob[]>(`/crm/tasks/${taskId}/jobs`);
  }

  public async startTaskJob(taskId: number): Promise<CrmTaskJob> {
    assertCrmPermission("crm.task.work", this.hasPermissionFn, "crm.tasks.show");
    return this.transport.post<CrmTaskJob>(`/crm/tasks/${taskId}/jobs/start`, {});
  }

  public async stopTaskJob(taskId: number): Promise<{ stopped: boolean }> {
    assertCrmPermission("crm.task.work", this.hasPermissionFn, "crm.tasks.show");
    return this.transport.post<{ stopped: boolean }>(`/crm/tasks/${taskId}/jobs/stop`, {});
  }

  public async listTaskClosures(taskId: number): Promise<CrmClosureRequest[]> {
    assertCrmPermission("crm.task.view", this.hasPermissionFn, "crm.tasks.show");
    return this.transport.get<CrmClosureRequest[]>(`/crm/tasks/${taskId}/closure-requests`);
  }

  public async requestTaskClosure(taskId: number, reason: string): Promise<CrmClosureRequest> {
    assertCrmPermission("crm.task.update", this.hasPermissionFn, "crm.tasks.show");
    return this.transport.post<CrmClosureRequest>(`/crm/tasks/${taskId}/closure-requests`, {
      reason
    });
  }

  public async reviewTaskClosure(
    closureId: number,
    decision: "approved" | "rejected",
    note = ""
  ): Promise<{ reviewed: boolean }> {
    assertCrmPermission("crm.closure.review", this.hasPermissionFn, "crm.closures");
    return this.transport.post<{ reviewed: boolean }>(
      `/crm/tasks/closure-requests/${closureId}/review`,
      { decision, note }
    );
  }

  // ==========================================
  // 5. ACTIVITIES & CLOSURE APPROVALS
  // ==========================================

  public async listActivities(filters: { page?: number; search?: string } = {}): Promise<{
    items: Array<{
      action: string;
      createdAt: string;
      createdBy: string;
      details: string;
      id: string | number;
      targetType?: string;
    }>;
    total: number;
  }> {
    assertCrmPermission("crm.enquiry.view", this.hasPermissionFn, "crm.activities");
    const query = new URLSearchParams();
    if (filters.page) query.set("page", String(filters.page));
    if (filters.search) query.set("search", filters.search);
    return this.transport.get<{
      items: Array<{
        action: string;
        createdAt: string;
        createdBy: string;
        details: string;
        id: string | number;
        targetType?: string;
      }>;
      total: number;
    }>(`/crm/activities?${query.toString()}`);
  }

  public async listClosureRequests(
    status: "pending" | "approved" | "rejected" = "pending"
  ): Promise<{ items: CrmClosureRequest[] }> {
    assertCrmPermission("crm.closure.review", this.hasPermissionFn, "crm.closures");
    return this.transport.get<{ items: CrmClosureRequest[] }>(
      `/crm/closure-requests?status=${status}`
    );
  }

  public async reviewClosureRequest(
    id: number,
    decision: "approve" | "reject",
    note = ""
  ): Promise<CrmClosureRequest> {
    assertCrmPermission("crm.closure.review", this.hasPermissionFn, "crm.closures");
    return this.transport.patch<CrmClosureRequest>(`/crm/closure-requests/${id}/review`, {
      decision,
      note
    });
  }

  // ==========================================
  // 6. SCHEDULES & REMINDERS
  // ==========================================

  public async listSchedules(view: "schedules" | "reminders" = "schedules"): Promise<CrmScheduleRecord[]> {
    assertCrmPermission("crm.schedule.view", this.hasPermissionFn, "crm.schedules");
    return this.transport.get<CrmScheduleRecord[]>(`/crm/schedules?view=${view}`);
  }

  public async listDueReminders(): Promise<CrmScheduleRecord[]> {
    assertCrmPermission("crm.schedule.view", this.hasPermissionFn, "crm.reminders");
    return this.transport.get<CrmScheduleRecord[]>("/crm/schedules/reminders");
  }

  public async createSchedule(input: CrmScheduleInput): Promise<CrmScheduleRecord> {
    assertCrmPermission("crm.schedule.create", this.hasPermissionFn, "crm.schedules");
    return this.transport.post<CrmScheduleRecord>("/crm/schedules", input);
  }

  public async acknowledgeReminder(id: number): Promise<CrmScheduleRecord> {
    assertCrmPermission("crm.schedule.update-own", this.hasPermissionFn, "crm.reminders");
    return this.transport.post<CrmScheduleRecord>(`/crm/schedules/${id}/acknowledge`, {});
  }

  public async updateScheduleStatus(
    id: number,
    status: "completed" | "cancelled"
  ): Promise<CrmScheduleRecord> {
    assertCrmPermission("crm.schedule.update-own", this.hasPermissionFn, "crm.schedules");
    return this.transport.post<CrmScheduleRecord>(`/crm/schedules/${id}/status`, { status });
  }

  // ==========================================
  // 7. MANUAL CALL LOGS
  // ==========================================

  public async listCallLogs(filters: {
    page?: number;
    search?: string;
    status?: string;
    type?: string;
  } = {}): Promise<{
    items: CrmCallLogRecord[];
    total: number;
  }> {
    assertCrmPermission("crm.call-log.view", this.hasPermissionFn, "crm.call-logs");
    const query = new URLSearchParams();
    if (filters.page) query.set("page", String(filters.page));
    if (filters.search) query.set("search", filters.search);
    if (filters.type) query.set("type", filters.type);
    if (filters.status) query.set("status", filters.status);
    return this.transport.get<{ items: CrmCallLogRecord[]; total: number }>(
      `/crm/call-logs?${query.toString()}`
    );
  }

  public async createCallLog(input: CrmCallLogInput): Promise<{ name: string }> {
    assertCrmPermission("crm.call-log.view", this.hasPermissionFn, "crm.call-logs");
    return this.transport.post<{ name: string }>("/crm/call-logs", input);
  }

  // ==========================================
  // 8. SOPS (CATALOG, REVISIONS, PUBLISH)
  // ==========================================

  public async listSops(): Promise<CrmSopRecord[]> {
    assertCrmPermission("crm.sop.view", this.hasPermissionFn, "crm.sops");
    return this.transport.get<CrmSopRecord[]>("/crm/sops");
  }

  public async createSop(input: CrmSopInput): Promise<CrmSopRecord> {
    assertCrmPermission("crm.sop.create", this.hasPermissionFn, "crm.sops");
    return this.transport.post<CrmSopRecord>("/crm/sops", input);
  }

  public async updateSop(id: number, input: CrmSopInput): Promise<CrmSopRecord> {
    assertCrmPermission("crm.sop.update", this.hasPermissionFn, "crm.sops");
    return this.transport.put<CrmSopRecord>(`/crm/sops/${id}`, input);
  }

  public async listSopItems(): Promise<CrmSopItemRecord[]> {
    assertCrmPermission("crm.sop.view", this.hasPermissionFn, "crm.sops");
    return this.transport.get<CrmSopItemRecord[]>("/crm/sop-items");
  }

  public async createSopItem(input: CrmSopItemInput): Promise<CrmSopItemRecord> {
    assertCrmPermission("crm.sop.create", this.hasPermissionFn, "crm.sops");
    return this.transport.post<CrmSopItemRecord>("/crm/sop-items", input);
  }

  public async createSopRevision(
    itemId: number,
    input: { evidenceGuidance: string; instructions: string }
  ): Promise<{
    author: string;
    createdAt: string;
    evidenceGuidance: string;
    id: number;
    instructions: string;
    revision: number;
    status: string;
  }> {
    assertCrmPermission("crm.sop.update", this.hasPermissionFn, "crm.sops");
    return this.transport.post<{
      author: string;
      createdAt: string;
      evidenceGuidance: string;
      id: number;
      instructions: string;
      revision: number;
      status: string;
    }>(`/crm/sop-items/${itemId}/revisions`, input);
  }

  public async publishSopItem(itemId: number, revisionId: number): Promise<void> {
    assertCrmPermission("crm.sop.publish", this.hasPermissionFn, "crm.sops");
    await this.transport.post(`/crm/sop-items/${itemId}/revisions/${revisionId}/publish`, {});
  }

  // ==========================================
  // 9. DUTIES & DUTY REPORTING
  // ==========================================

  public async listDutyAssignments(): Promise<CrmDutyAssignmentRecord[]> {
    assertCrmPermission("crm.duty.view.own", this.hasPermissionFn, "crm.duties");
    return this.transport.get<CrmDutyAssignmentRecord[]>("/crm/duty-assignments");
  }

  public async assignDuty(input: CrmDutyAssignmentInput): Promise<CrmDutyAssignmentRecord> {
    assertCrmPermission("crm.duty.assign", this.hasPermissionFn, "crm.duty-assignment");
    return this.transport.post<CrmDutyAssignmentRecord>("/crm/duty-assignments", input);
  }

  public async deactivateDuty(id: number): Promise<void> {
    assertCrmPermission("crm.duty.assign", this.hasPermissionFn, "crm.duty-assignment");
    await this.transport.post(`/crm/duty-assignments/${id}/deactivate`, {});
  }

  public async listDutyReports(search = "", from = "", to = ""): Promise<{
    items: CrmDutyReportRecord[];
    total: number;
  }> {
    assertCrmPermission("crm.duty-report.view.own", this.hasPermissionFn, "crm.duty-reporting");
    const query = new URLSearchParams({ page: "1", pageSize: "100", scope: "all", search });
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return this.transport.get<{ items: CrmDutyReportRecord[]; total: number }>(
      `/crm/duty-reports?${query.toString()}`
    );
  }

  public async createDutyReport(input: CrmDutyReportInput): Promise<CrmDutyReportRecord> {
    assertCrmPermission("crm.duty-report.create.own", this.hasPermissionFn, "crm.duty-reporting");
    return this.transport.post<CrmDutyReportRecord>("/crm/duty-reports", {
      ...input,
      issueDetails: "",
      result: "completed"
    });
  }

  public async updateDutyReport(
    id: number,
    input: { actions: string; performedDate: string }
  ): Promise<CrmDutyReportRecord> {
    assertCrmPermission("crm.duty-report.create.own", this.hasPermissionFn, "crm.duty-reporting");
    return this.transport.put<CrmDutyReportRecord>(`/crm/duty-reports/${id}`, input);
  }

  public async getDutyReportSummary(
    view: "sop" | "department" | "user",
    search = "",
    from = "",
    to = ""
  ): Promise<Array<{ count: number; groupKey: string; groupName: string }>> {
    assertCrmPermission("crm.duty-report.view.all", this.hasPermissionFn, "crm.reports");
    const query = new URLSearchParams({ search, view });
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return this.transport.get<Array<{ count: number; groupKey: string; groupName: string }>>(
      `/crm/duty-reports/summary?${query.toString()}`
    );
  }

  // ==========================================
  // 10. REPORTS & CONTACTS
  // ==========================================

  public async getEnquiryReports(
    filters: Record<string, string>,
    view: "list-in" | "creator" | "assignee" | "status"
  ): Promise<Array<{ count: number; status: string; statusName: string }>> {
    assertCrmPermission("crm.enquiry.view-all", this.hasPermissionFn, "crm.reports");
    const query = new URLSearchParams({ view, ...filters });
    return this.transport.get<Array<{ count: number; status: string; statusName: string }>>(
      `/crm/enquiries/reports?${query.toString()}`
    );
  }

  public async listContacts(search = ""): Promise<Array<{
    email?: string;
    id: number;
    name: string;
    phone?: string;
    status: string;
  }>> {
    assertCrmPermission("crm.contact.view", this.hasPermissionFn, "crm.contacts");
    return this.transport.get<Array<{
      email?: string;
      id: number;
      name: string;
      phone?: string;
      status: string;
    }>>(`/crm/contacts?search=${encodeURIComponent(search)}`);
  }

  public async getContact(id: number): Promise<Record<string, unknown>> {
    assertCrmPermission("crm.contact.view", this.hasPermissionFn, "crm.contacts");
    return this.transport.get<Record<string, unknown>>(`/crm/contacts/${id}`);
  }

  public async createContact(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    assertCrmPermission("crm.contact.view", this.hasPermissionFn, "crm.contacts");
    return this.transport.post<Record<string, unknown>>("/crm/contacts", payload);
  }

  public async updateContact(id: number, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    assertCrmPermission("crm.contact.view", this.hasPermissionFn, "crm.contacts");
    return this.transport.put<Record<string, unknown>>(`/crm/contacts/${id}`, payload);
  }

  public async setContactActive(id: number, active: boolean): Promise<Record<string, unknown>> {
    assertCrmPermission("crm.contact.view", this.hasPermissionFn, "crm.contacts");
    return this.transport.post<Record<string, unknown>>(
      `/crm/contacts/${id}/${active ? "activate" : "deactivate"}`,
      {}
    );
  }

  public async forceDeleteContact(id: number): Promise<void> {
    assertCrmPermission("admin", this.hasPermissionFn, "crm.contacts");
    await this.transport.delete(`/crm/contacts/${id}/force`);
  }

  // ==========================================
  // 11. MASTERS (LIST-IN, STATUS, PRIORITY)
  // ==========================================

  public async listListIn(): Promise<CrmMasterRecord[]> {
    return this.transport.get<CrmMasterRecord[]>("/crm/list-ins");
  }

  public async createListIn(input: CrmMasterInput): Promise<CrmMasterRecord> {
    assertCrmPermission("admin", this.hasPermissionFn, "crm.list-in");
    return this.transport.post<CrmMasterRecord>("/crm/list-ins", input);
  }

  public async updateListIn(id: number, input: CrmMasterInput): Promise<CrmMasterRecord> {
    assertCrmPermission("admin", this.hasPermissionFn, "crm.list-in");
    return this.transport.put<CrmMasterRecord>(`/crm/list-ins/${id}`, input);
  }

  public async activateListIn(id: number): Promise<CrmMasterRecord> {
    assertCrmPermission("admin", this.hasPermissionFn, "crm.list-in");
    return this.transport.post<CrmMasterRecord>(`/crm/list-ins/${id}/activate`, {});
  }

  public async deactivateListIn(id: number): Promise<CrmMasterRecord> {
    assertCrmPermission("admin", this.hasPermissionFn, "crm.list-in");
    return this.transport.post<CrmMasterRecord>(`/crm/list-ins/${id}/deactivate`, {});
  }

  public async forceDeleteListIn(id: number): Promise<void> {
    assertCrmPermission("admin", this.hasPermissionFn, "crm.list-in");
    await this.transport.delete(`/crm/list-ins/${id}/force`);
  }

  public async listStatuses(): Promise<CrmMasterRecord[]> {
    return this.transport.get<CrmMasterRecord[]>("/crm/statuses");
  }

  public async createStatus(input: CrmMasterInput): Promise<CrmMasterRecord> {
    assertCrmPermission("admin", this.hasPermissionFn, "crm.status");
    return this.transport.post<CrmMasterRecord>("/crm/statuses", input);
  }

  public async updateStatus(id: number, input: CrmMasterInput): Promise<CrmMasterRecord> {
    assertCrmPermission("admin", this.hasPermissionFn, "crm.status");
    return this.transport.put<CrmMasterRecord>(`/crm/statuses/${id}`, input);
  }

  public async activateStatus(id: number): Promise<CrmMasterRecord> {
    assertCrmPermission("admin", this.hasPermissionFn, "crm.status");
    return this.transport.post<CrmMasterRecord>(`/crm/statuses/${id}/activate`, {});
  }

  public async deactivateStatus(id: number): Promise<CrmMasterRecord> {
    assertCrmPermission("admin", this.hasPermissionFn, "crm.status");
    return this.transport.post<CrmMasterRecord>(`/crm/statuses/${id}/deactivate`, {});
  }

  public async forceDeleteStatus(id: number): Promise<void> {
    assertCrmPermission("admin", this.hasPermissionFn, "crm.status");
    await this.transport.delete(`/crm/statuses/${id}/force`);
  }

  public async listPriorities(): Promise<CrmMasterRecord[]> {
    return this.transport.get<CrmMasterRecord[]>("/crm/priorities");
  }

  public async createPriority(input: CrmMasterInput): Promise<CrmMasterRecord> {
    assertCrmPermission("admin", this.hasPermissionFn, "crm.priority");
    return this.transport.post<CrmMasterRecord>("/crm/priorities", input);
  }

  public async updatePriority(id: number, input: CrmMasterInput): Promise<CrmMasterRecord> {
    assertCrmPermission("admin", this.hasPermissionFn, "crm.priority");
    return this.transport.put<CrmMasterRecord>(`/crm/priorities/${id}`, input);
  }

  public async activatePriority(id: number): Promise<CrmMasterRecord> {
    assertCrmPermission("admin", this.hasPermissionFn, "crm.priority");
    return this.transport.post<CrmMasterRecord>(`/crm/priorities/${id}/activate`, {});
  }

  public async deactivatePriority(id: number): Promise<CrmMasterRecord> {
    assertCrmPermission("admin", this.hasPermissionFn, "crm.priority");
    return this.transport.post<CrmMasterRecord>(`/crm/priorities/${id}/deactivate`, {});
  }

  public async forceDeletePriority(id: number): Promise<void> {
    assertCrmPermission("admin", this.hasPermissionFn, "crm.priority");
    await this.transport.delete(`/crm/priorities/${id}/force`);
  }

  // ==========================================
  // 12. CONTACT-360 MASKING
  // ==========================================

  public async getContact360Profile(_contactId: number): Promise<never> {
    // Unfinished 360 customer profile tabs MUST remain masked and inaccessible
    throw new CrmPermissionDeniedError(
      "CRM Contact-360 remains masked and inaccessible on mobile client.",
      "admin",
      "crm.contact-360"
    );
  }
}
