import { AppError } from "@codexsun/framework/errors";
import type { Kysely } from "kysely";
import type { EnquiryDatabase } from "./enquiry.types.js";

/** Read visibility alone must never authorize work on another assignee's record. */
export async function authorizeEnquiryWrite(
  method: string,
  path: string,
  context: {
    database: Kysely<EnquiryDatabase>;
    actorEmail: string;
    authorize: (permission: string) => Promise<void>;
  }
) {
  const match = /^\/crm\/(?:mobile\/)?enquiries\/(\d+)(?:\/|$)/u.exec(path);
  if (method === "GET" || method === "HEAD" || !match) return;
  await context.authorize("crm.enquiry.view");
  try {
    await context.authorize("crm.enquiry.view-all");
    return;
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== "FORBIDDEN") throw error;
  }
  const row = await context.database
    .selectFrom("crm_enquiries")
    .innerJoin("app_users", (join) =>
      join.on("app_users.email", "=", context.actorEmail).on("app_users.status", "=", "active")
    )
    .select(["crm_enquiries.assigned_user_id as assignee", "app_users.id as actor"])
    .where("crm_enquiries.id", "=", Number(match[1]))
    .executeTakeFirst();
  if (!row || row.assignee !== row.actor)
    throw AppError.forbidden("Only the assignee or an enquiry manager can post work actions.");
}
