/**
 * Mobile Realtime Chat WebSocket Client
 * Implements M0 realtime contract:
 * - Connection, reconnect with exponential backoff, clean logout disconnect.
 * - Channel subscription restoration across reconnections.
 * - Presence, typing indicator fan-out, message broadcast routing.
 * - Handles unauthenticated socket rejection (4401) and foreign tenant drops.
 */

import {
  buildChatUpgradeHeaders,
  buildChatWebSocketUrl,
  defaultWebSocketFactory,
  NormalizedSocketAdapter,
  type ChatTransportContext,
  type WebSocketFactory
} from "./chat-transport.js";
import type {
  ChatMessage,
  ChatRealtimeEnvelope,
  ChatRealtimeHandlers,
  ChatRealtimeStatus
} from "./types.js";

export interface ChatRealtimeClientOptions {
  apiOrigin: string;
  autoConnect?: boolean;
  context?: ChatTransportContext & { token?: string | undefined };
  handlers?: ChatRealtimeHandlers;
  maxReconnectAttempts?: number;
  path?: string;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  socketFactory?: WebSocketFactory;
}

export class ChatRealtimeClient {
  private readonly apiOrigin: string;
  private readonly context?: (ChatTransportContext & { token?: string | undefined }) | undefined;
  private readonly path: string;
  private readonly handlers: ChatRealtimeHandlers;
  private readonly socketFactory: WebSocketFactory;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectBaseDelayMs: number;
  private readonly reconnectMaxDelayMs: number;

  private adapter: NormalizedSocketAdapter | null = null;
  private status: ChatRealtimeStatus = "idle";
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedExplicitly = false;
  private readonly subscribedChannels = new Set<string>();

  constructor(options: ChatRealtimeClientOptions) {
    this.apiOrigin = options.apiOrigin;
    this.context = options.context;
    this.path = options.path ?? "/chat/realtime";
    this.handlers = options.handlers ?? {};
    this.socketFactory = options.socketFactory ?? defaultWebSocketFactory;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
    this.reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? 1_000;
    this.reconnectMaxDelayMs = options.reconnectMaxDelayMs ?? 16_000;

    if (options.autoConnect !== false) {
      queueMicrotask(() => {
        if (!this.closedExplicitly) {
          this.connect();
        }
      });
    }
  }

  get currentStatus(): ChatRealtimeStatus {
    return this.status;
  }

  get isOpen(): boolean {
    return this.status === "open" && Boolean(this.adapter?.isOpen);
  }

  get activeSubscriptions(): string[] {
    return Array.from(this.subscribedChannels);
  }

  private setStatus(newStatus: ChatRealtimeStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.handlers.onStatusChange?.(newStatus);
    }
  }

  connect(): void {
    if (this.isOpen) return;

    this.closedExplicitly = false;
    this.clearReconnectTimer();
    this.setStatus("connecting");

    const url = buildChatWebSocketUrl({
      apiOrigin: this.apiOrigin,
      context: this.context,
      path: this.path
    });

    const headers = buildChatUpgradeHeaders(this.context);

    try {
      const rawSocket = this.socketFactory(url, undefined, { headers });
      this.adapter = new NormalizedSocketAdapter(rawSocket, {
        onClose: (code, reason) => this.handleSocketClose(code, reason),
        onError: (err) => this.handleSocketError(err),
        onMessage: (raw) => this.handleSocketMessage(raw),
        onOpen: () => this.handleSocketOpen()
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.handlers.onError?.(error);
      this.scheduleReconnect();
    }
  }

  private handleSocketOpen(): void {
    this.reconnectAttempts = 0;
    this.setStatus("open");

    // Automatically re-subscribe to all channels that were active before reconnect
    for (const channelUuid of this.subscribedChannels) {
      this.send("chat.subscribe", { channelUuid });
    }
  }

  private handleSocketMessage(raw: string): void {
    let envelope: ChatRealtimeEnvelope;
    try {
      envelope = JSON.parse(raw) as ChatRealtimeEnvelope;
    } catch {
      return;
    }

    const payload = (envelope.payload ?? {}) as Record<string, unknown>;

    switch (envelope.eventType) {
      case "message.created":
        this.handlers.onMessageCreated?.(
          payload.message as ChatMessage,
          String(payload.channelUuid ?? "")
        );
        break;

      case "message.updated":
        this.handlers.onMessageChanged?.(
          payload.message as ChatMessage,
          String(payload.channelUuid ?? "")
        );
        break;

      case "message.deleted":
        this.handlers.onMessageDeleted?.(
          String(payload.channelUuid ?? ""),
          String((payload as { uuid?: string }).uuid ?? "")
        );
        break;

      case "typing.started":
        this.handlers.onTyping?.(
          String(payload.channelUuid ?? ""),
          String(payload.userEmail ?? ""),
          true
        );
        break;

      case "typing.stopped":
        this.handlers.onTyping?.(
          String(payload.channelUuid ?? ""),
          String(payload.userEmail ?? ""),
          false
        );
        break;

      case "presence.updated":
        this.handlers.onPresence?.(
          String(payload.channelUuid ?? ""),
          Array.isArray(payload.online) ? payload.online.map(String) : []
        );
        break;

      case "sync.completed":
        this.handlers.onSyncCompleted?.(
          String(payload.channelUuid ?? ""),
          Array.isArray(payload.messages) ? (payload.messages as ChatMessage[]) : []
        );
        break;

      case "read.ack":
        this.handlers.onReadAck?.(String(payload.channelUuid ?? ""));
        break;

      case "error":
        this.handlers.onError?.(
          String(
            (payload as { message?: string }).message ??
              (payload as { code?: string }).code ??
              "Realtime error encountered."
          )
        );
        break;

      default:
        // Other events (pong, etc.)
        break;
    }
  }

  private handleSocketError(error: Error): void {
    this.handlers.onError?.(error);
  }

  private handleSocketClose(code: number, reason: string): void {
    // 4401: Unauthorized / session invalid
    if (code === 4401) {
      this.setStatus("closed");
      this.handlers.onError?.(
        new Error(`Realtime authentication rejected: ${reason || "Unauthorized (4401)"}`)
      );
      return;
    }

    // 4408: Tenant database missing / invalid
    if (code === 4408) {
      this.setStatus("closed");
      this.handlers.onError?.(
        new Error(`Realtime tenant rejection: ${reason || "Invalid tenant database (4408)"}`)
      );
      return;
    }

    if (this.closedExplicitly) {
      this.setStatus("closed");
      return;
    }

    // Unexpected closure - attempt reconnect with exponential backoff
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.closedExplicitly) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus("closed");
      this.handlers.onError?.(
        new Error(`WebSocket reconnect failed after ${this.reconnectAttempts} attempts.`)
      );
      return;
    }

    this.setStatus("reconnecting");
    const delay = Math.min(
      this.reconnectBaseDelayMs * Math.pow(2, this.reconnectAttempts),
      this.reconnectMaxDelayMs
    );
    this.reconnectAttempts += 1;

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      if (!this.closedExplicitly) {
        this.connect();
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private send(eventType: string, payload: Record<string, unknown>): void {
    if (!this.isOpen || !this.adapter) return;
    const eventId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const frame = JSON.stringify({
      eventId,
      eventType,
      payload,
      timestamp: new Date().toISOString()
    });
    this.adapter.send(frame);
  }

  // Realtime Protocol Actions
  ping(): void {
    this.send("chat.ping", {});
  }

  subscribe(channelUuid: string): void {
    this.subscribedChannels.add(channelUuid);
    this.send("chat.subscribe", { channelUuid });
  }

  unsubscribe(channelUuid: string): void {
    this.subscribedChannels.delete(channelUuid);
    this.send("chat.unsubscribe", { channelUuid });
  }

  sendTyping(channelUuid: string, typing: boolean): void {
    this.send("chat.typing", { channelUuid, typing });
  }

  sendMessage(channelUuid: string, body: string, replyToUuid?: string): void {
    this.send("chat.send", {
      body,
      channelUuid,
      ...(replyToUuid ? { replyToUuid } : {})
    });
  }

  markRead(channelUuid: string): void {
    this.send("chat.read", { channelUuid });
  }

  requestSync(channelUuid: string, after: string, limit = 100): void {
    this.send("chat.sync", { after, channelUuid, limit });
  }

  disconnect(code = 1000, reason = "Client disconnect"): void {
    this.closedExplicitly = true;
    this.clearReconnectTimer();

    if (this.adapter) {
      this.adapter.close(code, reason);
      this.adapter = null;
    }

    this.setStatus("closed");
  }

  dispose(): void {
    this.disconnect();
    this.subscribedChannels.clear();
  }
}
