/**
 * CRM Mobile Attachment Handler
 * Handles file validation, multipart upload via NativeHttpTransport, and attachment formatting.
 */

import type { NativeHttpTransport } from "../../native/http.js";
import type { CrmAttachment } from "./types.js";

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv"
]);

export function validateAttachment(file: { filename: string; mimeType: string; sizeBytes?: number }): void {
  if (file.sizeBytes !== undefined && file.sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error(
      `File "${file.filename}" exceeds the maximum allowed size of 10MB (${(file.sizeBytes / (1024 * 1024)).toFixed(1)}MB).`
    );
  }

  if (file.mimeType && !ALLOWED_MIME_TYPES.has(file.mimeType.toLowerCase())) {
    throw new Error(
      `File type "${file.mimeType}" is not permitted. Supported formats: PDF, JPEG, PNG, WEBP, DOCX, TXT, CSV.`
    );
  }
}

export async function uploadCrmAttachment(
  transport: NativeHttpTransport,
  endpoint: string,
  file: {
    data: Blob | string;
    filename: string;
    mimeType?: string;
  },
  additionalFields: Record<string, string> = {}
): Promise<CrmAttachment> {
  const mimeType = file.mimeType ?? "application/octet-stream";
  const sizeBytes = typeof file.data === "string" ? file.data.length : file.data.size;

  validateAttachment({
    filename: file.filename,
    mimeType,
    sizeBytes
  });

  const formData = new FormData();
  if (typeof file.data === "string") {
    const blob = new Blob([file.data], { type: mimeType });
    formData.append("file", blob, file.filename);
  } else {
    formData.append("file", file.data, file.filename);
  }

  for (const [key, value] of Object.entries(additionalFields)) {
    formData.append(key, value);
  }

  const response = await transport.uploadMultipart<{
    id?: string | number;
    name?: string;
    url?: string;
    uuid?: string;
  }>(endpoint, formData);

  return {
    createdAt: new Date().toISOString(),
    filename: file.filename,
    id: response.id ?? response.uuid ?? Date.now(),
    mimeType,
    sizeBytes,
    url: response.url
  };
}

export function formatAttachmentCommentBody(bodyText: string, attachment: CrmAttachment): string {
  const attachmentNote = `[Attachment: ${attachment.filename} (${attachment.mimeType})]`;
  if (!bodyText.trim()) {
    return attachmentNote;
  }
  return `${bodyText}\n\n${attachmentNote}`;
}
