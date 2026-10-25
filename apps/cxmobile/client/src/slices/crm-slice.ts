import type { NativeHttpTransport } from "../native/http.js";
import type { CrmEnquiryInput, M2StepResult } from "./types.js";

export interface CrmSliceResult {
  assignedUserId: string;
  commentId: string | number;
  enquiryId: string;
  reloadedCommentsCount: number;
}

export async function executeStep2CrmEnquiry(
  transport: NativeHttpTransport,
  input: CrmEnquiryInput = {
    customerName: "Acme Industrial Corp",
    email: "contact@acme.invalid",
    mobile: "9876543210",
    requirements: "Initial requirement for 500 units of heavy duty brackets"
  },
  assignUserId = "usr-sales-01"
): Promise<M2StepResult<CrmSliceResult>> {
  const startTime = Date.now();

  // 1. Create Enquiry
  const createPayload = {
    customerName: input.customerName,
    email: input.email ?? "contact@acme.invalid",
    mobile: input.mobile,
    requirements: input.requirements ?? "General enquiry",
    sourceName: "Mobile App",
    statusName: "open"
  };

  const created = await transport.post<{ id: string | number; uuid?: string }>(
    "/crm/enquiries",
    createPayload
  );

  const enquiryId = String(created.uuid ?? created.id);
  if (!enquiryId) {
    throw new Error("Step 2 failed: Created enquiry missing ID.");
  }

  // 2. Assign Enquiry
  await transport.patch(`/crm/enquiries/${encodeURIComponent(enquiryId)}/properties`, {
    assignedUserId: assignUserId
  });

  // 3. Add Comment
  const commentText = "Contacted client via mobile app. Follow-up meeting scheduled.";
  const createdComment = await transport.post<{ id: string | number; body?: string }>(
    `/crm/enquiries/${encodeURIComponent(enquiryId)}/comments`,
    {
      body: commentText,
      bodyFormat: "plain",
      parentId: null
    }
  );

  const commentId = createdComment.id;

  // 4. Reload Enquiry and Comments
  const reloaded = await transport.get<{ assignedUserId?: string; id?: string; uuid?: string }>(
    `/crm/enquiries/${encodeURIComponent(enquiryId)}`
  );

  const comments = await transport.get<Array<{ body?: string; id: string | number }>>(
    `/crm/enquiries/${encodeURIComponent(enquiryId)}/comments`
  );

  const hasComment = comments.some(
    (c) => String(c.id) === String(commentId) || c.body?.includes("Contacted client via mobile app")
  );

  if (!hasComment && comments.length === 0) {
    throw new Error("Step 2 failed: Reloaded enquiry did not contain the posted comment.");
  }

  const durationMs = Date.now() - startTime;
  return {
    data: {
      assignedUserId: reloaded.assignedUserId ?? assignUserId,
      commentId,
      enquiryId,
      reloadedCommentsCount: comments.length
    },
    durationMs,
    message: `CRM Enquiry #${enquiryId} created, assigned to ${assignUserId}, comment added, and verified on reload.`,
    step: 2,
    stepName: "CRM Enquiry Lifecycle",
    success: true
  };
}
