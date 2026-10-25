import { AppError } from "@codexsun/framework/errors";
import type { MarketingContext } from "../../context.js";
import { SubmissionRepository } from "./submission.repository.js";
import type { SubmissionRecord } from "./submission.types.js";
import { LeadService } from "../lead/index.js";

export async function processSubmissionHandoff(
  context: MarketingContext,
  uuid: string,
  intake?: ((row: SubmissionRecord) => Promise<{ uuid: string } | null>) | undefined
) {
  await context.authorize("marketing.submission.record.create");
  const repo = new SubmissionRepository(context),
    row = await repo.get(uuid);
  if (!row) throw AppError.notFound("The pending submission is not available to this worker.");
  if (row.status === "delivered") return { uuid, leadUuid: row.leadUuid, status: "delivered" };
  const lead = intake
    ? await intake(row)
    : await new LeadService(context).intake(row);
  if (!lead) throw AppError.conflict("Marketing lead intake did not return its receipt.");
  await repo.delivered(uuid, lead.uuid);
  return { uuid, leadUuid: lead.uuid, status: "delivered" };
}
