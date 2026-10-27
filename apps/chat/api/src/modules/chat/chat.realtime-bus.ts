import { randomUUID } from "node:crypto";
import { ChatRepository } from "./chat.repository.js";
import type { ChatMessage, ChatRuntimeContext } from "./chat.types.js";

export type ChatRealtimeSocket = {
  close: (code?: number, reason?: string) => void;
  send: (frame: string) => void;
};

export type ChatRealtimeConnection = {
  channels: Set<string>;
  connectionId: string;
  context: ChatRuntimeContext;
  socket: ChatRealtimeSocket;
};

export class ChatConnectionManager {
  private readonly connections = new Map<string, ChatRealtimeConnection>();

  admit(connection: ChatRealtimeConnection): void {
    this.connections.set(connection.connectionId, connection);
  }

  remove(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  get(connectionId: string): ChatRealtimeConnection | undefined {
    return this.connections.get(connectionId);
  }

  subscribe(connectionId: string, channelUuid: string): void {
    this.get(connectionId)?.channels.add(channelUuid);
  }

  unsubscribe(connectionId: string, channelUuid: string): void {
    this.get(connectionId)?.channels.delete(channelUuid);
  }

  subscribers(context: ChatRuntimeContext, channelUuid: string): ChatRealtimeConnection[] {
    return [...this.connections.values()].filter(
      (connection) =>
        connection.channels.has(channelUuid) &&
        connection.context.tenantId === context.tenantId &&
        connection.context.tenantDatabase === context.tenantDatabase &&
        connection.context.companyId === context.companyId
    );
  }
}

type ChannelAccessCheck = (context: ChatRuntimeContext, channelUuid: string) => Promise<void>;

export class ChatRealtimeBus {
  constructor(
    private readonly manager: ChatConnectionManager,
    private readonly checkMembership: ChannelAccessCheck = async (context, channelUuid) => {
      await new ChatRepository().requireChannel(context, channelUuid);
    }
  ) {}

  async assertChannelAccess(context: ChatRuntimeContext, channelUuid: string): Promise<void> {
    await context.authorize("chat.manage");
    await this.checkMembership(context, channelUuid);
  }

  async messageCreatedInScope(context: ChatRuntimeContext, message: ChatMessage): Promise<void> {
    await this.messageCreated(context, message.channelUuid, message);
  }

  async messageCreated(context: ChatRuntimeContext, channelUuid: string, message: ChatMessage) {
    await this.publish(
      context,
      channelUuid,
      realtimeFrame("message.created", { channelUuid, message })
    );
  }

  async messageChanged(context: ChatRuntimeContext, channelUuid: string, message: ChatMessage) {
    await this.publish(
      context,
      channelUuid,
      realtimeFrame("message.updated", { channelUuid, message })
    );
  }

  async messageDeleted(context: ChatRuntimeContext, channelUuid: string, uuid: string) {
    await this.publish(
      context,
      channelUuid,
      realtimeFrame("message.deleted", { channelUuid, uuid })
    );
  }

  async publish(
    context: ChatRuntimeContext,
    channelUuid: string,
    frame: string,
    excludeEmail?: string
  ): Promise<void> {
    for (const connection of await this.authorizedSubscribers(context, channelUuid)) {
      if (!this.isCurrentSubscriber(connection, channelUuid)) continue;
      if (excludeEmail?.toLowerCase() === connection.context.actorEmail.toLowerCase()) continue;
      try {
        connection.socket.send(frame);
      } catch {
        if (this.manager.get(connection.connectionId) === connection)
          this.manager.remove(connection.connectionId);
      }
    }
  }

  async publishPresence(context: ChatRuntimeContext, channelUuid: string): Promise<void> {
    const subscribers = (await this.authorizedSubscribers(context, channelUuid)).filter(
      (connection) => this.isCurrentSubscriber(connection, channelUuid)
    );
    const online = [...new Set(subscribers.map((connection) => connection.context.actorEmail))];
    const frame = realtimeFrame("presence.updated", { channelUuid, online });
    for (const connection of subscribers) {
      if (!this.isCurrentSubscriber(connection, channelUuid)) continue;
      try {
        connection.socket.send(frame);
      } catch {
        if (this.manager.get(connection.connectionId) === connection)
          this.manager.remove(connection.connectionId);
      }
    }
  }

  private async authorizedSubscribers(context: ChatRuntimeContext, channelUuid: string) {
    const authorized: ChatRealtimeConnection[] = [];
    for (const connection of this.manager.subscribers(context, channelUuid)) {
      try {
        await this.assertChannelAccess(connection.context, channelUuid);
        // Access checks can outlive an unsubscribe or socket close.
        if (this.isCurrentSubscriber(connection, channelUuid)) authorized.push(connection);
      } catch {
        if (this.manager.get(connection.connectionId) === connection)
          this.manager.unsubscribe(connection.connectionId, channelUuid);
      }
    }
    return authorized;
  }

  private isCurrentSubscriber(connection: ChatRealtimeConnection, channelUuid: string): boolean {
    return (
      this.manager.get(connection.connectionId) === connection &&
      connection.channels.has(channelUuid)
    );
  }
}

export function realtimeFrame(eventType: string, payload: Record<string, unknown>): string {
  return JSON.stringify({
    eventId: randomUUID(),
    eventType,
    payload,
    timestamp: new Date().toISOString()
  });
}
