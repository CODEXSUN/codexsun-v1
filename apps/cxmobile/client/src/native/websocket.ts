import { HostVerifier } from "../session/host-verifier.js";
import { NativeSessionManager } from "../session/native-session-manager.js";
import { PlatformApiError } from "../session/session-types.js";

export type WebSocketStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed";

export const WS_READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
} as const;

export interface UniversalWebSocket {
  readonly readyState: number;
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
  onopen?: ((ev: unknown) => void) | null;
  onmessage?: ((ev: { data: unknown }) => void) | null;
  onerror?: ((ev: unknown) => void) | null;
  onclose?: ((ev: { code: number; reason: string }) => void) | null;
  addEventListener?(type: string, listener: (...args: unknown[]) => void): void;
  removeEventListener?(type: string, listener: (...args: unknown[]) => void): void;
}

export type WebSocketFactory = (url: string, protocols?: string | string[]) => UniversalWebSocket;

export interface NativeWebSocketHandlers {
  onClose?: (code: number, reason: string) => void;
  onError?: (error: Error) => void;
  onMessage?: (payload: unknown) => void;
  onStatusChange?: (status: WebSocketStatus) => void;
}

export interface NativeWebSocketOptions {
  handlers?: NativeWebSocketHandlers | undefined;
  hostVerifier?: HostVerifier | undefined;
  maxReconnectAttempts?: number | undefined;
  path?: string | undefined;
  reconnectBaseDelayMs?: number | undefined;
  sessionManager: NativeSessionManager;
  webSocketFactory?: WebSocketFactory | undefined;
}

export class NativeWebSocketTransport {
  private readonly sessionManager: NativeSessionManager;
  private readonly hostVerifier: HostVerifier;
  private readonly handlers: NativeWebSocketHandlers;
  private readonly webSocketFactory?: WebSocketFactory | undefined;
  private readonly path: string;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectBaseDelayMs: number;

  private socket: UniversalWebSocket | null = null;
  private status: WebSocketStatus = "idle";
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedExplicitly = false;
  private unsubscribeSession: (() => void) | null = null;
  private readonly subscribedChannels = new Set<string>();

  constructor(options: NativeWebSocketOptions) {
    this.sessionManager = options.sessionManager;
    this.hostVerifier = options.hostVerifier ?? new HostVerifier({ allowLoopback: true });
    this.handlers = options.handlers ?? {};
    this.webSocketFactory = options.webSocketFactory;
    this.path = options.path ?? "/chat/realtime";
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
    this.reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? 1_000;

    // Listen to session state: if session is logged out or expired, close socket cleanly
    this.unsubscribeSession = this.sessionManager.subscribe((state) => {
      if (state.status === "unauthenticated" || state.status === "expired") {
        this.disconnect();
      }
    });
  }

  get currentStatus(): WebSocketStatus {
    return this.status;
  }

  get isOpen(): boolean {
    return this.status === "open" && this.socket?.readyState === WS_READY_STATE.OPEN;
  }

  private setStatus(newStatus: WebSocketStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.handlers.onStatusChange?.(newStatus);
    }
  }

  buildWebSocketUrl(): string {
    const apiOrigin = this.sessionManager.apiOrigin;
    if (!apiOrigin) {
      throw new PlatformApiError("Cannot connect WebSocket without active API origin.", 400);
    }

    this.hostVerifier.assertHostAllowed(apiOrigin);
    const parsed = new URL(apiOrigin);
    const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    const host = parsed.host;

    const session = this.sessionManager.activeSession;
    const query = new URLSearchParams();

    // Attach only non-secret context selectors
    if (session) {
      if (session.activeCompanyId !== undefined) {
        query.set("companyId", String(session.activeCompanyId));
      }
      if (session.tenantId || session.tenantUuid) {
        query.set("tenantId", session.tenantId ?? session.tenantUuid!);
      }
      if (session.tenantDbName) {
        query.set("tenantDatabase", session.tenantDbName);
      }
      if (session.sessionSlot) {
        query.set("sessionSlot", session.sessionSlot);
      }
    }

    // STRICT CHECK: Ensure NO secrets or credentials appear in the query string
    const forbiddenQueryKeys = ["token", "password", "secret", "jwt", "bearer", "key"];
    for (const key of forbiddenQueryKeys) {
      if (query.has(key)) {
        query.delete(key);
      }
    }

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const cleanPath = this.path.startsWith("/") ? this.path : `/${this.path}`;
    return `${wsProtocol}//${host}${cleanPath}${queryString}`;
  }

  connect(): void {
    if (this.isOpen) return;

    this.closedExplicitly = false;
    this.clearReconnectTimer();

    const url = this.buildWebSocketUrl();
    this.setStatus("connecting");

    try {
      const socket = this.webSocketFactory
        ? this.webSocketFactory(url)
        : typeof globalThis.WebSocket !== "undefined"
          ? (new globalThis.WebSocket(url) as unknown as UniversalWebSocket)
          : null;

      if (!socket) {
        throw new Error("No WebSocket implementation available in this environment.");
      }

      this.socket = socket;

      socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus("open");

        // Automatically restore channel subscriptions on open/reconnect
        for (const channelUuid of this.subscribedChannels) {
          try {
            socket.send(JSON.stringify({ type: "subscribe", channelUuid }));
          } catch {
            // Ignore send error during open
          }
        }
      };

      socket.onmessage = (event: { data: unknown }) => {
        const raw = event.data;
        try {
          const text = typeof raw === "string" ? raw : String(raw);
          const parsed = JSON.parse(text) as unknown;
          this.handlers.onMessage?.(parsed);
        } catch {
          this.handlers.onMessage?.(raw);
        }
      };

      socket.onerror = (err: unknown) => {
        const error = err instanceof Error ? err : new Error("WebSocket error occurred.");
        this.handlers.onError?.(error);
      };

      socket.onclose = (event: { code: number; reason: string }) => {
        const code = event?.code ?? 1000;
        const reason = event?.reason ? String(event.reason) : "";
        this.handlers.onClose?.(code, reason);

        // 4401: Unauthorized / Session expired close code
        if (code === 4401) {
          this.setStatus("closed");
          this.sessionManager.handleServerRevocation("WebSocket session expired (code 4401).");
          return;
        }

        if (this.closedExplicitly) {
          this.setStatus("closed");
          return;
        }

        // Unexpected disconnect - attempt reconnect with backoff
        this.scheduleReconnect();
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.handlers.onError?.(error);
      this.scheduleReconnect();
    }
  }

  subscribeChannel(channelUuid: string): void {
    if (!channelUuid) return;
    this.subscribedChannels.add(channelUuid);
    if (this.isOpen && this.socket) {
      this.socket.send(JSON.stringify({ type: "subscribe", channelUuid }));
    }
  }

  unsubscribeChannel(channelUuid: string): void {
    if (!channelUuid) return;
    this.subscribedChannels.delete(channelUuid);
    if (this.isOpen && this.socket) {
      this.socket.send(JSON.stringify({ type: "unsubscribe", channelUuid }));
    }
  }

  getSubscribedChannels(): string[] {
    return Array.from(this.subscribedChannels);
  }

  private scheduleReconnect(): void {
    if (this.closedExplicitly) return;
    if (this.sessionManager.status === "unauthenticated" || this.sessionManager.status === "expired") {
      this.setStatus("closed");
      return;
    }

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
      16_000
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  send(data: unknown): void {
    if (!this.isOpen || !this.socket) {
      throw new Error("Cannot send frame: WebSocket is not open.");
    }
    const message = typeof data === "string" ? data : JSON.stringify(data);
    this.socket.send(message);
  }

  disconnect(code = 1000, reason = "Client disconnect"): void {
    this.closedExplicitly = true;
    this.clearReconnectTimer();

    if (this.socket) {
      try {
        this.socket.close(code, reason);
      } catch {
        // Socket already closed
      }
      this.socket = null;
    }

    this.setStatus("closed");
  }

  dispose(): void {
    this.disconnect();
    this.subscribedChannels.clear();
    if (this.unsubscribeSession) {
      this.unsubscribeSession();
      this.unsubscribeSession = null;
    }
  }
}

export interface SessionChatSocketCoordinatorOptions {
  autoConnect?: boolean | undefined;
  path?: string | undefined;
  sessionManager: NativeSessionManager;
  webSocketFactory?: WebSocketFactory | undefined;
}

/**
 * Session-Scoped Chat WebSocket Coordinator:
 * Retains a single active WebSocket connection across channel navigations,
 * preventing connection churn and redundant handshakes.
 */
export class SessionChatSocketCoordinator {
  private readonly sessionManager: NativeSessionManager;
  private readonly transport: NativeWebSocketTransport;
  private activeChannelUuid: string | null = null;
  private readonly messageHandlers = new Set<(message: unknown) => void>();
  private readonly statusHandlers = new Set<(status: WebSocketStatus) => void>();

  constructor(options: SessionChatSocketCoordinatorOptions) {
    this.sessionManager = options.sessionManager;
    this.transport = new NativeWebSocketTransport({
      handlers: {
        onMessage: (data) => {
          for (const handler of this.messageHandlers) {
            handler(data);
          }
        },
        onStatusChange: (status) => {
          for (const handler of this.statusHandlers) {
            handler(status);
          }
        }
      },
      path: options.path ?? "/chat/realtime",
      sessionManager: this.sessionManager,
      webSocketFactory: options.webSocketFactory
    });

    if (options.autoConnect !== false && this.sessionManager.status === "authenticated") {
      this.connect();
    }
  }

  get currentStatus(): WebSocketStatus {
    return this.transport.currentStatus;
  }

  get isOpen(): boolean {
    return this.transport.isOpen;
  }

  get currentChannel(): string | null {
    return this.activeChannelUuid;
  }

  get underlyingTransport(): NativeWebSocketTransport {
    return this.transport;
  }

  connect(): void {
    this.transport.connect();
  }

  disconnect(): void {
    this.transport.disconnect();
  }

  /**
   * Channel navigation without recreating the WebSocket connection:
   * Scopes socket connection to session rather than recreating on every channel navigation.
   */
  setActiveChannel(channelUuid: string | null): void {
    if (this.activeChannelUuid === channelUuid) return;

    if (this.activeChannelUuid) {
      this.transport.unsubscribeChannel(this.activeChannelUuid);
    }

    this.activeChannelUuid = channelUuid;

    if (channelUuid) {
      this.transport.subscribeChannel(channelUuid);
    }
  }

  sendMessage(channelUuid: string, payload: Record<string, unknown>): void {
    this.transport.send({
      channelUuid,
      type: "message",
      ...payload
    });
  }

  sendTyping(channelUuid: string, typing: boolean): void {
    this.transport.send({
      channelUuid,
      type: "typing",
      typing
    });
  }

  onMessage(handler: (message: unknown) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatusChange(handler: (status: WebSocketStatus) => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  dispose(): void {
    this.transport.dispose();
    this.messageHandlers.clear();
    this.statusHandlers.clear();
  }
}
