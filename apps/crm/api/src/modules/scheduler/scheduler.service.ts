import { AppError } from "@codexsun/framework/errors";
import { SchedulerRepository } from "./scheduler.repository.js";
import type {
  ScheduleInput,
  ScheduleSourceType,
  ScheduleStatus,
  SchedulerContext
} from "./scheduler.types.js";

export class SchedulerService {
  constructor(
    private readonly repository: SchedulerRepository,
    private readonly context: SchedulerContext
  ) {}

  async list(view: "schedules" | "reminders", sourceType?: string, sourceId?: number) {
    await this.context.authorize("crm.schedule.view");
    const canViewAll = await this.context.hasPermission("crm.schedule.view-all");
    return this.repository.list(this.scope(canViewAll), {
      view,
      ...(sourceType ? { sourceType } : {}),
      ...(sourceId ? { sourceId } : {})
    });
  }

  async reminderCount() {
    await this.context.authorize("crm.schedule.view");
    const canViewAll = await this.context.hasPermission("crm.schedule.view-all");
    return { total: await this.repository.reminderCount(this.scope(canViewAll)) };
  }

  async reminders() {
    await this.context.authorize("crm.schedule.view");
    const canViewAll = await this.context.hasPermission("crm.schedule.view-all");
    return this.repository.reminders(this.scope(canViewAll));
  }

  async sources(sourceType: ScheduleSourceType, search: string) {
    await this.context.authorize("crm.schedule.create");
    const sourceAccess = await this.sourceScope(sourceType);
    return this.repository.listSources(sourceType, search, sourceAccess);
  }

  async create(input: ScheduleInput) {
    await this.context.authorize("crm.schedule.create");
    if (!input.notes.trim()) throw AppError.validation("Schedule notes are required.");
    if (!Number.isFinite(Date.parse(input.scheduledAt)))
      throw AppError.validation("The schedule time must be a valid date.");
    if (input.reminderAt) {
      if (!Number.isFinite(Date.parse(input.reminderAt)))
        throw AppError.validation("The reminder time must be a valid date.");
      if (Date.parse(input.reminderAt) > Date.parse(input.scheduledAt))
        throw AppError.validation("The reminder time must be on or before the schedule time.");
    }
    const sourceScope = await this.sourceScope(input.sourceType);
    const source = await this.repository.findSource(input.sourceType, input.sourceId, sourceScope);
    if (!source) throw AppError.notFound("The linked CRM record is unavailable.");
    const record = await this.repository.create(
      input,
      source.label,
      this.context.actorEmail,
      this.context.actorUserId
    );
    if (!record) throw AppError.internal("The schedule was saved but could not be loaded.");
    return record;
  }

  async updateStatus(id: number, status: Exclude<ScheduleStatus, "scheduled">) {
    const canManage = await this.context.hasPermission("crm.schedule.manage");
    if (!canManage) await this.context.authorize("crm.schedule.update-own");
    const record = await this.repository.updateStatus(id, status, this.scope(canManage));
    if (!record) throw AppError.notFound("Schedule not found.");
    return record;
  }

  async reschedule(id: number, scheduledAt: string) {
    const canManage = await this.context.hasPermission("crm.schedule.manage");
    if (!canManage) await this.context.authorize("crm.schedule.update-own");
    if (!Number.isFinite(Date.parse(scheduledAt)))
      throw AppError.validation("The schedule time must be a valid date.");
    const record = await this.repository.reschedule(id, scheduledAt, this.scope(canManage));
    if (!record) throw AppError.notFound("Open reminder not found.");
    return record;
  }

  async acknowledge(id: number) {
    const canManage = await this.context.hasPermission("crm.schedule.manage");
    if (!canManage) await this.context.authorize("crm.schedule.update-own");
    const record = await this.repository.acknowledge(id, this.scope(canManage));
    if (!record) throw AppError.notFound("Reminder not found.");
    return record;
  }

  private async sourceScope(sourceType: ScheduleSourceType) {
    switch (sourceType) {
      case "enquiry":
        await this.context.authorize("crm.enquiry.view");
        return this.scope(await this.context.hasPermission("crm.enquiry.view-all"));
      case "task":
        await this.context.authorize("crm.task.view");
        return this.scope(await this.context.hasPermission("crm.task.view-all"));
      case "call-log":
        await this.context.authorize("crm.call-log.view");
        return this.scope(true);
      case "duty": {
        const canViewAll = await this.context.hasPermission("crm.duty.view.all");
        if (!canViewAll) await this.context.authorize("crm.duty.view.own");
        return this.scope(canViewAll);
      }
      case "sop":
        await this.context.authorize("crm.sop.view");
        return this.scope(true);
    }
  }

  private scope(viewAll: boolean) {
    return { email: this.context.actorEmail, userId: this.context.actorUserId, viewAll };
  }
}
