import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import websocket from "@fastify/websocket";
import type { WebSocket as WsSocket } from "ws";
import { z } from "zod";
import { AppError } from "@codexsun/framework/errors";
import { ChatService } from "./chat.service.js";
import type { ChatModuleDependencies, ChatRuntimeContext } from "./chat.types.js";

/**
 * Realtime boundary for team chat. It owns socket lifecycle, channel
 * subscriptions, presence, typing fan-out, and protocol routing. All business
 * work (persistence, membership checks, broadcast rules) stays delegated to
 * ChatService and ChatRepository. Sockets authenticate during the HTTP upgrade
 * through the platform auth hook; the verified session context is captured at
 * admit time and reused for every frame. Unauthenticated upgrades close
 * immediately without a socket.
 */

export { ChatConnectionManager, ChatRealtimeBus, realtimeFrame } from "./chat.realtime-bus.js";
export type { ChatRealtimeConnection, ChatRealtimeSocket } from "./chat.realtime-bus.js";
import {
  ChatConnectionManager,
  ChatRealtimeBus,
  realtimeFrame,
  type ChatRealtimeConnection,
  type ChatRealtimeSocket
} from "./chat.realtime-bus.js";

const envelopeSchema = z.object({
  eventId: z.string().trim().min(1).max(80),
  eventType: z.string().trim().min(1).max(80),
  payload: z.record(z.string(), z.unknown())
});

type RealtimeEnvelope = z.infer<typeof envelopeSchema>;

const MAX_WS_PAYLOAD_BYTES = 256 * 1024;

// Realtime frames never carry HTTP requests. Services resolve their context
// from the verified upgrade-time session captured when the socket was admitted.
const realtimeRequest = { headers: {} } as FastifyRequest;

export class ChatRealtimeGateway {
  constructor(
    private readonly manager: ChatConnectionManager,
    private readonly bus: ChatRealtimeBus
  ) {}

  async handle(connectionId: string, raw: string): Promise<void> {
    if (Buffer.byteLength(raw, "utf8") > MAX_WS_PAYLOAD_BYTES) {
      this.send(connectionId, "error", {
        code: "PAYLOAD_TOO_LARGE",
        message: "Realtime frames are limited to 256 kB. Send attachments over HTTP."
      });
      return;
    }
    const parsed = envelopeSchema.safeParse(parseFrame(raw));
    if (!parsed.success) {
      this.send(connectionId, "error", { code: "INVALID_EVENT", message: "Malformed event." });
      return;
    }
    const connection = this.manager.get(connectionId);
    if (!connection) return;
    try {
      await connection.context.authorize("chat.manage");
    } catch {
      this.manager.remove(connectionId);
      connection.socket.close(4403, "Chat permission was revoked.");
      return;
    }
    const envelope = parsed.data;
    switch (envelope.eventType) {
      case "chat.ping":
        this.send(connectionId, "pong", {});
        return;
      case "chat.subscribe":
        await this.subscribe(connectionId, envelope, true);
        return;
      case "chat.unsubscribe":
        await this.subscribe(connectionId, envelope, false);
        return;
      case "chat.send":
        await this.sendMessage(connectionId, envelope);
        return;
      case "chat.typing":
        await this.typing(connectionId, envelope);
        return;
      case "chat.sync":
        await this.sync(connectionId, envelope);
        return;
      case "chat.read":
        await this.read(connectionId, envelope);
        return;
      default:
        this.send(connectionId, "error", {
          code: "UNSUPPORTED_EVENT",
          message: `Unsupported event type: ${envelope.eventType}.`
        });
    }
  }

  private async subscribe(connectionId: string, envelope: RealtimeEnvelope, subscribe: boolean) {
    const connection = this.manager.get(connectionId);
    if (!connection) return;
    const payload = z
      .object({ channelUuid: z.string().min(1).max(80) })
      .strict()
      .safeParse(envelope.payload);
    if (!payload.success) {
      this.send(connectionId, "error", { code: "INVALID_PAYLOAD", message: "Invalid channel." });
      return;
    }
    try {
      await this.serviceFor(connection).getChannel(realtimeRequest, payload.data.channelUuid);
    } catch {
      this.send(connectionId, "error", {
        code: "UNKNOWN_CHANNEL",
        message: "Channel was not found."
      });
      return;
    }
    if (subscribe) {
      this.manager.subscribe(connectionId, payload.data.channelUuid);
      await this.bus.publishPresence(connection.context, payload.data.channelUuid);
    } else {
      this.manager.unsubscribe(connectionId, payload.data.channelUuid);
    }
  }

  private async sendMessage(connectionId: string, envelope: RealtimeEnvelope) {
    const connection = this.manager.get(connectionId);
    if (!connection) return;
    const payload = z
      .object({
        body: z.string(),
        channelUuid: z.string().min(1).max(80),
        replyToUuid: z.string().min(1).max(80).optional()
      })
      .strict()
      .safeParse(envelope.payload);
    if (!payload.success) {
      this.send(connectionId, "error", { code: "INVALID_PAYLOAD", message: "Invalid message." });
      return;
    }
    try {
      await this.serviceFor(connection).createMessage(realtimeRequest, {
        attachments: [],
        body: payload.data.body,
        channelUuid: payload.data.channelUuid,
        ...(payload.data.replyToUuid ? { replyToUuid: payload.data.replyToUuid } : {})
      });
    } catch (error) {
      this.send(connectionId, "error", {
        code: error instanceof AppError ? error.code : "MESSAGE_SEND_FAILED",
        message: error instanceof AppError ? error.message : "Message could not be sent."
      });
    }
  }

  private async typing(connectionId: string, envelope: RealtimeEnvelope) {
    const connection = this.manager.get(connectionId);
    if (!connection) return;
    const payload = z
      .object({ channelUuid: z.string().min(1).max(80), typing: z.boolean() })
      .strict()
      .safeParse(envelope.payload);
    if (!payload.success) {
      this.send(connectionId, "error", {
        code: "INVALID_PAYLOAD",
        message: "Invalid typing event."
      });
      return;
    }
    try {
      await this.bus.assertChannelAccess(connection.context, payload.data.channelUuid);
    } catch {
      this.send(connectionId, "error", {
        code: "UNKNOWN_CHANNEL",
        message: "Channel was not found."
      });
      return;
    }
    await this.bus.publish(
      connection.context,
      payload.data.channelUuid,
      realtimeFrame(payload.data.typing ? "typing.started" : "typing.stopped", {
        channelUuid: payload.data.channelUuid,
        userEmail: connection.context.actorEmail
      }),
      connection.context.actorEmail
    );
  }

  private async sync(connectionId: string, envelope: RealtimeEnvelope) {
    const connection = this.manager.get(connectionId);
    if (!connection) return;
    const payload = z
      .object({
        after: z.string().min(1).max(40),
        channelUuid: z.string().min(1).max(80),
        limit: z.coerce.number().int().positive().max(200).default(100)
      })
      .strict()
      .safeParse(envelope.payload);
    if (!payload.success) {
      this.send(connectionId, "error", {
        code: "INVALID_PAYLOAD",
        message: "Invalid sync request."
      });
      return;
    }
    try {
      const messages = await this.serviceFor(connection).listMessagesAfter(
        realtimeRequest,
        payload.data.channelUuid,
        payload.data.after,
        payload.data.limit
      );
      this.send(connectionId, "sync.completed", {
        channelUuid: payload.data.channelUuid,
        messages
      });
    } catch (error) {
      this.send(connectionId, "error", {
        code: error instanceof AppError ? error.code : "SYNC_FAILED",
        message: error instanceof AppError ? error.message : "Synchronization failed."
      });
    }
  }

  private async read(connectionId: string, envelope: RealtimeEnvelope) {
    const connection = this.manager.get(connectionId);
    if (!connection) return;
    const payload = z
      .object({ channelUuid: z.string().min(1).max(80) })
      .strict()
      .safeParse(envelope.payload);
    if (!payload.success) {
      this.send(connectionId, "error", { code: "INVALID_PAYLOAD", message: "Invalid read event." });
      return;
    }
    try {
      await this.serviceFor(connection).markRead(realtimeRequest, payload.data.channelUuid);
      this.send(connectionId, "read.ack", { channelUuid: payload.data.channelUuid });
    } catch {
      // Read tracking is best-effort over realtime; HTTP remains authoritative.
    }
  }

  private serviceFor(connection: ChatRealtimeConnection): ChatService {
    return new ChatService(
      {
        resolveContext: async () => connection.context
      },
      this.bus
    );
  }

  private send(connectionId: string, eventType: string, payload: Record<string, unknown>) {
    this.manager.get(connectionId)?.socket.send(realtimeFrame(eventType, payload));
  }
}

function parseFrame(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export async function registerChatRealtime(
  app: FastifyInstance,
  dependencies: ChatModuleDependencies & { events: ChatRealtimeBus; manager: ChatConnectionManager }
): Promise<void> {
  await app.register(websocket, { options: { maxPayload: MAX_WS_PAYLOAD_BYTES } });

  app.get("/chat/realtime", { websocket: true }, (socket: WsSocket, request: FastifyRequest) => {
    void admitConnection(request, socket, dependencies).catch(() => {
      socket.close(4403, "Chat realtime setup failed.");
    });
  });
}

async function admitConnection(
  request: FastifyRequest,
  socket: WsSocket,
  dependencies: ChatModuleDependencies & { events: ChatRealtimeBus; manager: ChatConnectionManager }
): Promise<void> {
  const authContext = (
    request as FastifyRequest & { authContext?: { payload: { email?: string } } }
  ).authContext;
  const actorEmail = authContext?.payload.email ?? "";
  if (!actorEmail) {
    socket.close(4401, "Chat realtime requires authentication.");
    return;
  }
  const query = (request.query ?? {}) as Record<string, string | undefined>;
  if (query.companyId) request.headers["x-company-id"] = query.companyId;
  if (query.tenantDatabase && !request.headers["x-tenant-db"]) {
    request.headers["x-tenant-db"] = query.tenantDatabase;
  }
  if (query.tenantId && !request.headers["x-tenant-id"]) {
    request.headers["x-tenant-id"] = query.tenantId;
  }
  let context: ChatRuntimeContext;
  try {
    context = await dependencies.resolveContext(request);
    await context.authorize("chat.manage");
  } catch {
    socket.close(4401, "Chat realtime session is not valid.");
    return;
  }
  if (!context.tenantDatabase) {
    socket.close(4408, "Chat realtime requires a tenant database.");
    return;
  }
  const realtimeSocket: ChatRealtimeSocket = {
    close: (code, reason) => socket.close(code, reason),
    send: (frame) => {
      if (socket.readyState === socket.OPEN) socket.send(frame);
    }
  };
  const gateway = new ChatRealtimeGateway(dependencies.manager, dependencies.events);
  const connectionId = randomUUID();
  const connection: ChatRealtimeConnection = {
    channels: new Set(),
    connectionId,
    context,
    socket: realtimeSocket
  };
  dependencies.manager.admit(connection);

  socket.on("message", (data) => {
    const raw = data.toString();
    void gateway.handle(connectionId, raw).catch(() => {
      realtimeSocket.send(
        realtimeFrame("error", { code: "INTERNAL", message: "Realtime processing failed." })
      );
    });
  });
  socket.on("close", () => {
    dependencies.manager.remove(connectionId);
    for (const channelUuid of connection.channels) {
      void dependencies.events.publishPresence(connection.context, channelUuid);
    }
  });
  socket.on("error", () => {
    dependencies.manager.remove(connectionId);
    socket.close(1011, "Chat realtime connection error");
  });
}
