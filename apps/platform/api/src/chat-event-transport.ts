import { createHmac, timingSafeEqual } from "node:crypto";
import { Redis } from "ioredis";
import { ChatRepository, type ChatMessage, type ChatRuntimeContext } from "@codexsun/chat-api";
import { env } from "./env.js";
import { queueRedisPrefix } from "./modules/queue-manager/queue-manager.bullmq.js";
import { TenantRepository } from "./modules/tenant/tenant.repository.js";
import { getTenantDatabase } from "./database/tenant-database.js";
import { authorizeTenantUser } from "./auth/tenant-access-context.js";

const channel = `${queueRedisPrefix}:chat:message-created`;

export function createChatEventPublisher() {
  const redis = connection();
  return {
    ready: () => redis.ping(),
    isReady: () => redis.status === "ready",
    close: async () => {
      redis.disconnect();
    },
    publish: async (context: ChatRuntimeContext, message: ChatMessage) => {
      const body = JSON.stringify({
        tenantId: context.tenantId,
        companyId: context.companyId,
        actorEmail: context.actorEmail,
        messageUuid: message.uuid,
        emittedAt: Date.now()
      });
      await redis.publish(channel, JSON.stringify({ body, signature: sign(body) }));
    }
  };
}

/** Notifications carry identity only. Chat data and recipient access stay authoritative in SQL. */
export async function subscribeExternalChatMessages(
  publish: (context: ChatRuntimeContext, message: ChatMessage) => Promise<void>
) {
  const redis = connection();
  let closing = false;
  const active = new Set<Promise<void>>();
  redis.on("message", (_channel, value) => {
    if (closing) return;
    const dispatch = receive(value).catch(() => {
      console.warn(
        "[chat.events] Notification deferred. Messages remain available through Chat history."
      );
    });
    active.add(dispatch);
    void dispatch.finally(() => active.delete(dispatch));
  });
  try {
    await redis.subscribe(channel);
  } catch (error) {
    redis.disconnect();
    throw error;
  }
  return async () => {
    closing = true;
    redis.disconnect();
    await Promise.all(active);
  };

  async function receive(value: string) {
    if (value.length > 4096) return;
    const envelope = JSON.parse(value) as { body?: unknown; signature?: unknown };
    if (typeof envelope.body !== "string" || typeof envelope.signature !== "string") return;
    const expected = Buffer.from(sign(envelope.body));
    const received = Buffer.from(envelope.signature);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return;
    const event = JSON.parse(envelope.body) as Record<string, unknown>;
    if (
      typeof event.tenantId !== "string" ||
      typeof event.actorEmail !== "string" ||
      typeof event.messageUuid !== "string" ||
      !Number.isSafeInteger(event.companyId) ||
      typeof event.emittedAt !== "number" ||
      Math.abs(Date.now() - event.emittedAt) > 60_000
    )
      return;
    const tenant = await new TenantRepository().findByIdOrCode(event.tenantId);
    if (
      !tenant ||
      tenant.uuid !== event.tenantId ||
      tenant.status !== "active" ||
      !tenant.enabledModuleKeys.includes("chat")
    )
      return;
    const database = getTenantDatabase(tenant);
    const enabled = await database
      .selectFrom("app_module_settings")
      .select("id")
      .where("module_key", "=", "chat")
      .where("enabled", "=", true)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!enabled) return;
    const actorEmail = event.actorEmail;
    const context: ChatRuntimeContext = {
      database: database as never,
      tenantId: tenant.uuid,
      tenantDatabase: tenant.dbName,
      actorEmail,
      companyId: event.companyId as number,
      authorize: () => authorizeTenantUser(database as never, actorEmail, "chat.manage")
    };
    await context.authorize("chat.manage");
    const message = await new ChatRepository().requireMessage(context, event.messageUuid);
    if (message.status !== "active") return;
    await publish(context, message);
  }
}

function sign(body: string) {
  return createHmac("sha256", env.JWT_SECRET)
    .update(`codexsun-chat-event:${channel}:${body}`)
    .digest("hex");
}

function connection() {
  const redis = new Redis(env.CODEXSUN_REDIS_URL, {
    connectTimeout: 3000,
    maxRetriesPerRequest: 1,
    retryStrategy: (attempt) => Math.min(attempt * 250, 3000)
  });
  redis.on("error", () => console.warn("[chat.events] Redis connection unavailable."));
  return redis;
}
