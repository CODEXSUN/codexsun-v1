import { sql, type Transaction } from "kysely";
import type { EnquiryDatabase } from "./enquiry.types.js";
import { EnquirySyncRepository } from "./enquiry.sync.repository.js";

type PinCapture = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string;
};

export function pinLocationDetails(input: PinCapture) {
  const latitude = input.latitude.toFixed(7);
  const longitude = input.longitude.toFixed(7);
  const accuracy = input.accuracyMeters === null ? "Unknown" : input.accuracyMeters.toFixed(2);
  return (
    `[${latitude}, ${longitude}](https://www.google.com/maps?q=${latitude},${longitude})` +
    ` · Accuracy: ${accuracy} m · Captured: ${new Date(input.capturedAt).toISOString()}`
  );
}

export async function recordEnquiryPin(
  transaction: Transaction<EnquiryDatabase>,
  enquiryId: number,
  capture: PinCapture,
  actor: string,
  requestId: string
) {
  const details = pinLocationDetails(capture);
  const comment = await transaction
    .insertInto("crm_enquiry_comments")
    .values({
      enquiry_id: enquiryId,
      parent_id: null,
      request_id: requestId,
      body: `Pin Location : ${details}`,
      body_format: "plain",
      status: "active",
      created_by: actor,
      created_at: sql`UTC_TIMESTAMP()`,
      updated_at: sql`UTC_TIMESTAMP()`
    })
    .executeTakeFirstOrThrow();
  await transaction
    .insertInto("crm_enquiry_activity")
    .values({
      enquiry_id: enquiryId,
      action: "pin-location",
      details,
      created_by: actor,
      status: "active",
      created_at: sql`UTC_TIMESTAMP()`,
      updated_at: sql`UTC_TIMESTAMP()`
    })
    .execute();
  await new EnquirySyncRepository(transaction).enqueue(
    {
      actorEmail: actor,
      enquiryId,
      entityId: Number(comment.insertId),
      eventType: "comment-add",
      correlationId: `crm-enquiry:${enquiryId}:comment:${Number(comment.insertId)}`
    },
    transaction
  );
  return details;
}
