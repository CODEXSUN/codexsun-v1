import { createHash } from "node:crypto";
import type { Kysely } from "kysely";
import { enquiryCommentRemoteName } from "./enquiry-sync.comment-identity.js";
import {
  EnquirySyncRepository,
  scopedFrappeCommentKey,
  type EnquiryDatabase
} from "@codexsun/crm-api/enquiry-sync";
import {
  createEnquiryJobComment,
  FrappeConnectionRepository,
  listEnquiryJobComments,
  type FrappeDatabase,
  type FrappeSettings
} from "../connection/index.js";

export async function postEnquiryComment(
  database: Kysely<FrappeDatabase>,
  eventId: number,
  settings: FrappeSettings
) {
  const sync = new EnquirySyncRepository(database as unknown as Kysely<EnquiryDatabase>);
  const event = await sync.getEvent(eventId);
  if (!event?.entity_id) throw new Error("The comment sync event has no comment identity.");
  const comment = await sync.commentForSync(event.enquiry_id, event.entity_id);
  if (!comment) throw new Error("The enquiry comment was not found.");
  const linked = await new FrappeConnectionRepository(database).get(event.enquiry_id);
  if (!linked) {
    const upsert = await sync.latestUpsert(event.enquiry_id);
    throw new Error(
      upsert?.status !== "synced" && upsert?.last_error
        ? `Enquiry export blocked: ${upsert.last_error}`
        : "Sync the enquiry before posting its comments."
    );
  }
  const comments = await listEnquiryJobComments(settings, [linked.remote_name]);
  let parentName: string | null = null;
  if (comment.parent_id) {
    const parent = await sync.commentForSync(event.enquiry_id, comment.parent_id);
    if (!parent) throw new Error("The reply parent is not part of this enquiry.");
    const parentEvent = await sync.commentSyncEvent(parent.id);
    if (parentEvent?.status === "synced") parentName = parentEvent.remote_name;
    if (!parentName && parent.request_id?.startsWith("frappe:")) {
      parentName =
        comments.find((remote) =>
          [
            `frappe:${createHash("sha256").update(remote.name).digest("hex")}`,
            scopedFrappeCommentKey(
              event.enquiry_id,
              `frappe:${createHash("sha256").update(remote.name).digest("hex")}`
            )
          ].includes(parent.request_id!)
        )?.name ?? null;
    }
    if (!parentName) throw new Error("Sync the parent comment before posting this reply.");
    if (
      !comments.some(
        (remote) =>
          remote.name === parentName &&
          remote.job_type === "Enquiry" &&
          remote.job_id === linked.remote_name
      )
    )
      throw new Error("The remote reply parent is missing or linked to another enquiry.");
  }
  const remoteName = enquiryCommentRemoteName(settings.baseUrl, event.idempotency_key);
  const body = comment.body_format === "html" ? comment.body : escapeHtml(comment.body);
  const existing = comments.find((remote) => remote.name === remoteName);
  if (existing) {
    if (
      existing.job_type !== "Enquiry" ||
      existing.job_id !== linked.remote_name ||
      existing.comment !== body ||
      (existing.parent_comment || null) !== parentName
    )
      throw new Error(
        "The remote comment identity has different content or an enquiry link. Review before retrying."
      );
    return existing.name;
  }
  // Frappe v2 accepts an explicit name; its primary key prevents duplicate retry inserts.
  const created = await createEnquiryJobComment(
    settings,
    {
      enquiryName: linked.remote_name,
      comment: body,
      mode: parentName ? "Reply" : "Comment",
      parentName,
      remoteName
    },
    true
  );
  if (created.name !== remoteName)
    throw new Error("Frappe did not preserve the comment retry identity.");
  return created.name;
}

function escapeHtml(body: string) {
  return body
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("\n", "<br>");
}
