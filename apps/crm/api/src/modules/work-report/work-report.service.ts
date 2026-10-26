import { AppError } from "@codexsun/framework/errors";
import { WorkReportRepository } from "./work-report.repository.js";
import type {
  WorkReportContext,
  WorkReportHistoryFilter,
  WorkReportInput,
  WorkReportTarget
} from "./work-report.types.js";
export class WorkReportService {
  private readonly repository: WorkReportRepository;
  constructor(private readonly context: WorkReportContext) {
    this.repository = new WorkReportRepository(context.database);
  }
  async pendingEnquiryCollectionIds() {
    await this.context.authorize("crm.enquiry.view");
    return this.repository.pendingEnquiryCollectionIds(
      this.context.actorUserId,
      this.context.actorEmail
    );
  }
  async list(target: WorkReportTarget) {
    await this.access(target, false);
    return this.repository.list(target);
  }
  async history(
    target: WorkReportTarget,
    page: number,
    pageSize: number,
    filter: WorkReportHistoryFilter = "all"
  ) {
    await this.access(target, false);
    return this.repository.history(target, page, pageSize, filter);
  }
  async checkpoint(target: WorkReportTarget) {
    await this.access(target, false);
    return this.repository.checkpoint(target, this.context.actorEmail);
  }
  async create(input: WorkReportInput) {
    input = {
      ...input,
      latitude: input.latitude === null ? null : Number(input.latitude.toFixed(7)),
      longitude: input.longitude === null ? null : Number(input.longitude.toFixed(7)),
      accuracyMeters:
        input.accuracyMeters === null ? null : Number(input.accuracyMeters.toFixed(2)),
      amount: input.amount === null ? null : Number(input.amount.toFixed(2))
    };
    await this.access(input, true, input.action);
    if (!["report", "check-in", "check-out", "charge", "collection"].includes(input.action))
      throw AppError.forbidden("Workflow events must use their owning operation.");
    return this.repository.create(input, this.context);
  }
  private async access(
    target: WorkReportTarget,
    writing: boolean,
    action?: WorkReportInput["action"]
  ) {
    const resource = target.enquiryId !== null ? "enquiry" : "task";
    await this.context.authorize(`crm.${resource}.view`);
    const parent = await this.repository.target(target);
    let all = false;
    try {
      await this.context.authorize(`crm.${resource}.view-all`);
      all = true;
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "FORBIDDEN") throw error;
    }
    const assigned =
      this.context.actorUserId !== null && parent.assigned_user_id === this.context.actorUserId;
    const creator =
      !writing && parent.created_by.toLowerCase() === this.context.actorEmail.toLowerCase();
    if (!all && !assigned && !creator)
      throw AppError.forbidden("Only the assignee or a work manager can report on this work.");
    if (writing) {
      const permission =
        resource === "task"
          ? "crm.task.work"
          : action === "check-in" || action === "check-out"
            ? "crm.enquiry.work"
            : "crm.enquiry.update";
      await this.context.authorize(permission);
    }
  }
}
