import { AppError } from "@codexsun/framework/errors";
import type { Transaction } from "kysely";
import { EnquiryRepository } from "./enquiry.repository.js";
import type { EnquiryDatabase } from "./enquiry.types.js";

export async function createEnquiryFromLead(
  database: Transaction<EnquiryDatabase>,
  input: {
    uuid: string;
    name: string;
    email: string;
    phone: string;
    message: string;
    contactId: number;
    assignedTo: string;
  },
  actor: string
) {
  const status = await database
    .selectFrom("crm_enquiry_statuses")
    .select("id")
    .where("code", "=", "new")
    .where("status", "=", "active")
    .executeTakeFirst();
  const priority = await database
    .selectFrom("crm_enquiry_priorities")
    .select("id")
    .where("code", "=", "normal")
    .where("status", "=", "active")
    .executeTakeFirst();
  const user = await database
    .selectFrom("app_users")
    .select("id")
    .where("email", "=", input.assignedTo)
    .where("status", "=", "active")
    .executeTakeFirst();
  if (!status || !priority || !user)
    throw AppError.conflict("Active enquiry defaults and user are required.");
  const enquiry = await new EnquiryRepository(database).create(
    {
      title: input.message.slice(0, 160) || `Lead from ${input.name}`,
      description: input.message || null,
      contactId: input.contactId,
      capturedName: input.name,
      capturedEmail: input.email || null,
      capturedPhone: input.phone,
      source: "lead",
      sourceReference: input.uuid,
      listInId: null,
      statusId: status.id,
      priorityId: priority.id,
      assignedUserId: user.id,
      enquiredAt: new Date().toISOString(),
      dueDate: null,
      closedReason: null
    },
    actor
  );
  if (!enquiry) throw AppError.conflict("Enquiry conversion failed.");
  return { id: enquiry.id, enquiryNo: enquiry.enquiryNo };
}
