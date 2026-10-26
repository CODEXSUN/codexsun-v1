import { AppError } from "@codexsun/framework/errors";
import { LeadRepository } from "./lead.repository.js";
import { createLeadFollowUp } from "../task/index.js";
import { createEnquiryFromLead, type EnquiryDatabase } from "../enquiry/index.js";
import type { Transaction } from "kysely";
import type { LeadContext, LeadFilters, LeadInput, LeadIntake } from "./lead.types.js";
export class LeadService {
  private readonly repository: LeadRepository;
  constructor(private readonly context: LeadContext) {
    this.repository = new LeadRepository(context);
  }
  async accept(input: LeadIntake) {
    await this.context.authorize("crm.lead.intake");
    await this.context.authorize("crm.task.create");
    if (!input.name.trim() || (!input.phone && !input.email))
      throw AppError.validation("Name and a contact channel are required.");
    return this.context.database.transaction().execute(async (database) => {
      const repository = new LeadRepository({ ...this.context, database });
      await repository.accept(input);
      const lead = await repository.lock(input.submissionUuid);
      if (!lead) throw AppError.conflict("Lead intake is unavailable.");
      if (lead.taskId === null) {
        const taskId = await createLeadFollowUp(
          database as never,
          this.context.actorEmail,
          lead.uuid,
          input.name
        );
        await repository.attachTask(lead.uuid, taskId);
        await repository.audit(
          lead.uuid,
          "intake",
          "Marketing lead received and follow-up created."
        );
      }
      return repository.getBySubmission(input.submissionUuid);
    });
  }
  async get(uuid: string) {
    await this.context.authorize("crm.lead.view");
    const record = await this.repository.get(uuid);
    if (!record) throw AppError.notFound("Lead was not found.");
    return record;
  }
  async list(filters?: LeadFilters) {
    await this.context.authorize("crm.lead.view");
    return this.repository.list(filters);
  }
  async campaigns(search: string) {
    await this.context.authorize("crm.lead.view");
    return this.repository.campaigns(search);
  }
  async page(filters: LeadFilters) {
    await this.context.authorize("crm.lead.view");
    return this.repository.page(filters);
  }
  async save(input: LeadInput, uuid?: string) {
    const editing = Boolean(uuid);
    await this.context.authorize(uuid ? "crm.lead.update" : "crm.lead.create");
    if (input.contactId !== null) {
      await this.context.authorize("crm.contact.view");
      const contact = await this.context.contact?.(input.contactId);
      if (!contact) throw AppError.validation("Select an active contact from this tenant.");
    }
    return this.context.database.transaction().execute(async (database) => {
      const repository = new LeadRepository({ ...this.context, database });
      if (uuid) {
        const existing = await repository.get(uuid, true);
        if (!existing) throw AppError.notFound("Lead was not found.");
        if (existing.enquiryId || existing.status === "converted")
          throw AppError.conflict("Converted leads cannot be edited.");
        if (input.revision !== existing.revision)
          throw AppError.conflict("This lead changed. Refresh before editing.");
        await repository.update(uuid, input);
      } else uuid = await repository.create(input);
      await repository.audit(uuid, editing ? "updated" : "created", "Lead details saved.");
      const saved = await repository.get(uuid);
      if (!saved) throw AppError.conflict("Lead could not be saved.");
      return saved;
    });
  }
  async convert(uuid: string) {
    await this.context.authorize("crm.lead.convert");
    await this.context.authorize("crm.enquiry.create");
    return this.context.database.transaction().execute(async (database) => {
      const repository = new LeadRepository({ ...this.context, database });
      const lead = await repository.get(uuid, true);
      if (!lead) throw AppError.notFound("Lead was not found.");
      if (lead.enquiryId) return lead;
      if (lead.status === "lost") throw AppError.conflict("Reopen this lead before converting it.");
      if (!/^\d{10}$/.test(lead.phone))
        throw AppError.validation("A 10-digit mobile number is required for conversion.");
      if (!this.context.resolveContact)
        throw AppError.conflict("Contact resolution is unavailable.");
      if (lead.contactId) await this.context.authorize("crm.contact.view");
      const contactId = await this.context.resolveContact(database, lead);
      const enquiry = await createEnquiryFromLead(
        database as unknown as Transaction<EnquiryDatabase>,
        { ...lead, contactId },
        this.context.actorEmail
      );
      await repository.converted(uuid, enquiry.id, contactId);
      await repository.audit(uuid, "converted", `Converted to enquiry #${enquiry.enquiryNo}.`);
      const saved = await repository.get(uuid);
      if (!saved) throw AppError.conflict("Lead conversion could not be saved.");
      return saved;
    });
  }
  async activity(uuid: string) {
    await this.get(uuid);
    return this.repository.activity(uuid);
  }
  async contacts(search: string) {
    await this.context.authorize("crm.lead.view");
    await this.context.authorize("crm.contact.view");
    if (!this.context.contacts) throw AppError.conflict("Contact lookup is unavailable.");
    return this.context.contacts(search);
  }
  async capabilities() {
    await this.context.authorize("crm.lead.view");
    const allowed = async (...permissions: string[]) => {
      try {
        for (const permission of permissions) await this.context.authorize(permission);
        return true;
      } catch (error) {
        if (error instanceof AppError && error.code === "FORBIDDEN") return false;
        throw error;
      }
    };
    return {
      canCreate: await allowed("crm.lead.create"),
      canUpdate: await allowed("crm.lead.update"),
      canConvert: await allowed("crm.lead.convert", "crm.enquiry.create")
    };
  }
}
export const acceptMarketingLead = (context: LeadContext, input: LeadIntake) =>
  new LeadService(context).accept(input);
