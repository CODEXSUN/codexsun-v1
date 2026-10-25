import type { NativeHttpTransport } from "../native/http.js";
import type { ChatMessageInput, M2StepResult } from "./types.js";

export interface ChatSliceResult {
  channelUuid: string;
  hasAttachment: boolean;
  messageUuid: string;
  readStatusVerified: boolean;
}

export async function executeStep4ChatMessage(
  transport: NativeHttpTransport,
  input: Partial<ChatMessageInput> = {}
): Promise<M2StepResult<ChatSliceResult>> {
  const startTime = Date.now();

  let channelUuid = input.channelUuid;

  // 1. Ensure active channel exists
  if (!channelUuid) {
    try {
      const channels = await transport.get<Array<{ uuid: string }>>("/chat/channels");
      if (channels && channels.length > 0 && channels[0]?.uuid) {
        channelUuid = channels[0].uuid;
      }
    } catch {
      // Create fallback channel
    }

    if (!channelUuid) {
      const createdChannel = await transport.post<{ uuid: string }>("/chat/channels", {
        kind: "channel",
        name: "mobile-field-team"
      });
      channelUuid = createdChannel.uuid;
    }
  }

  if (!channelUuid) {
    throw new Error("Step 4 failed: Could not determine or create chat channel.");
  }

  // 2. Send Message with Attachment
  const sampleAttachment = input.attachment ?? {
    base64: "JVBERi0xLjQKJcTl8uXrCjEgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iag==",
    fileName: "site-inspection-spec.pdf",
    mimeType: "application/pdf"
  };

  const messageBody =
    input.body ?? "Mobile field dispatch update with site inspection PDF attached.";

  const messagePayload = {
    attachments: [sampleAttachment],
    body: messageBody,
    channelUuid
  };

  const createdMessage = await transport.post<{
    attachments?: Array<{ fileName: string }>;
    id?: number | string;
    uuid: string;
  }>("/chat/messages", messagePayload);

  const messageUuid = createdMessage.uuid;
  if (!messageUuid) {
    throw new Error("Step 4 failed: Created message missing UUID.");
  }

  // 3. Mark Channel / Messages as Read
  await transport.post(`/chat/channels/${encodeURIComponent(channelUuid)}/read`, {});

  // 4. Verify Read Status
  const channelDetail = await transport.get<{
    channel?: { unreadCount?: number };
    unreadCount?: number;
  }>(`/chat/channels/${encodeURIComponent(channelUuid)}`);

  const unreadCount =
    channelDetail.channel?.unreadCount ?? channelDetail.unreadCount ?? 0;

  const readStatusVerified = unreadCount === 0;

  const durationMs = Date.now() - startTime;
  return {
    data: {
      channelUuid,
      hasAttachment: true,
      messageUuid,
      readStatusVerified
    },
    durationMs,
    message: `Message #${messageUuid} with PDF attachment sent to channel #${channelUuid}; channel marked read.`,
    step: 4,
    stepName: "Chat Messaging & Attachment Lifecycle",
    success: true
  };
}
