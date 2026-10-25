/**
 * Chat Realtime Pluggable WebSocket Transport Seam
 * Addresses F-W01-01:
 * - Operates uniformly across standard browser, Capacitor/WebView, and native Node harnesses.
 * - Enforces zero token / credential leakage in URL queries.
 * - Normalizes W3C WebSocket (browser) and EventEmitter-style (node ws) socket interfaces.
 */

export const FORBIDDEN_QUERY_KEYS = Object.freeze([
  "token",
  "password",
  "secret",
  "jwt",
  "bearer",
  "key",
  "auth",
  "credential",
  "signature",
  "access_token"
]);

export interface ChatTransportContext {
  activeCompanyId?: number | string | undefined;
  sessionSlot?: string | undefined;
  tenantDbName?: string | undefined;
  tenantId?: string | undefined;
}

export interface BuildUrlOptions {
  apiOrigin: string;
  context?: ChatTransportContext | undefined;
  path?: string | undefined;
}

/**
 * Builds WebSocket URL strictly free of secrets, access tokens, or sensitive credentials.
 * Only non-sensitive routing context (companyId, tenantId, tenantDatabase, sessionSlot)
 * may be encoded in the query parameters.
 */
export function buildChatWebSocketUrl(options: BuildUrlOptions): string {
  const { apiOrigin, context, path = "/chat/realtime" } = options;

  if (!apiOrigin) {
    throw new Error("Cannot construct WebSocket URL without an apiOrigin.");
  }

  const parsedOrigin = new URL(apiOrigin);
  const protocol = parsedOrigin.protocol === "https:" ? "wss:" : "ws:";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  const query = new URLSearchParams();

  if (context) {
    if (context.activeCompanyId !== undefined && context.activeCompanyId !== null) {
      query.set("companyId", String(context.activeCompanyId));
    }
    if (context.tenantId) {
      query.set("tenantId", context.tenantId);
    }
    if (context.tenantDbName) {
      query.set("tenantDatabase", context.tenantDbName);
    }
    if (context.sessionSlot) {
      query.set("sessionSlot", context.sessionSlot);
    }
  }

  // Enforce zero token leakage in query string (F-W01-01)
  for (const forbidden of FORBIDDEN_QUERY_KEYS) {
    if (query.has(forbidden)) {
      query.delete(forbidden);
    }
  }

  const queryString = query.toString() ? `?${query.toString()}` : "";
  return `${protocol}//${parsedOrigin.host}${cleanPath}${queryString}`;
}

/**
 * Builds safe upgrade headers for native/Node harnesses where custom headers
 * during WebSocket HTTP upgrade are supported.
 */
export function buildChatUpgradeHeaders(
  context?: ChatTransportContext & { token?: string | undefined }
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!context) return headers;

  if (context.sessionSlot) {
    headers["x-codexsun-session-slot"] = context.sessionSlot;
    // Cookie header for HttpOnly cookie emulation on native upgrade seam
    headers["Cookie"] = `codexsun_session_${context.sessionSlot}=${context.token ?? "native_session"}`;
  }
  if (context.tenantId) {
    headers["x-tenant-id"] = context.tenantId;
  }
  if (context.tenantDbName) {
    headers["x-tenant-db"] = context.tenantDbName;
  }
  if (context.activeCompanyId !== undefined) {
    headers["x-company-id"] = String(context.activeCompanyId);
  }
  if (context.token) {
    headers["Authorization"] = `Bearer ${context.token}`;
  }

  return headers;
}

/**
 * Common shape for WebSocket instances in browser, WebView, or Node ws environments.
 */
export interface PluggableSocket {
  readonly readyState: number;
  close(code?: number, reason?: string): void;
  send(data: string | ArrayBufferView | ArrayBufferLike): void;

  onclose?: ((event: { code: number; reason: string }) => void) | null;
  onerror?: ((event: unknown) => void) | null;
  onmessage?: ((event: { data: unknown }) => void) | null;
  onopen?: ((event: unknown) => void) | null;

  addEventListener?(type: string, listener: (...args: unknown[]) => void): void;
  on?(event: string, listener: (...args: unknown[]) => void): unknown;
  removeEventListener?(type: string, listener: (...args: unknown[]) => void): void;
}

export type WebSocketFactory = (
  url: string,
  protocols?: string | string[],
  options?: { headers?: Record<string, string> }
) => PluggableSocket;

/**
 * Default WebSocket factory seam.
 * Detects globalThis.WebSocket in browser/WebView or falls back to injected factory.
 */
export const defaultWebSocketFactory: WebSocketFactory = (url, protocols, _options) => {
  const GlobalSocket = globalThis.WebSocket;
  if (typeof GlobalSocket !== "undefined") {
    // Standard browser/WebView WebSocket ignores custom headers
    return new GlobalSocket(url, protocols) as unknown as PluggableSocket;
  }
  throw new Error(
    "No global WebSocket implementation found. Provide a custom socketFactory for this environment."
  );
};

export interface NormalizedSocketCallbacks {
  onClose: (code: number, reason: string) => void;
  onError: (error: Error) => void;
  onMessage: (raw: string) => void;
  onOpen: () => void;
}

/**
 * Normalized Socket Adapter:
 * Bridges either W3C WebSocket standard (browser/WebView) or Node EventEmitter (ws package)
 * to a consistent callback interface.
 */
export class NormalizedSocketAdapter {
  private socket: PluggableSocket | null = null;
  private readonly callbacks: NormalizedSocketCallbacks;
  private cleanedUp = false;

  constructor(socket: PluggableSocket, callbacks: NormalizedSocketCallbacks) {
    this.socket = socket;
    this.callbacks = callbacks;
    this.bindEvents(socket);
  }

  get readyState(): number {
    return this.socket?.readyState ?? 3; // 3 = CLOSED
  }

  get isOpen(): boolean {
    return this.readyState === 1; // 1 = OPEN
  }

  send(message: string): void {
    if (!this.socket || !this.isOpen) {
      throw new Error("Cannot send frame: WebSocket is not open.");
    }
    this.socket.send(message);
  }

  close(code = 1000, reason = "Normal Closure"): void {
    if (this.socket) {
      try {
        this.socket.close(code, reason);
      } catch {
        // Ignored if socket is already closed
      }
    }
  }

  private bindEvents(socket: PluggableSocket): void {
    // Check if EventEmitter pattern (Node ws)
    if (typeof socket.on === "function") {
      socket.on("open", () => {
        if (!this.cleanedUp) this.callbacks.onOpen();
      });

      socket.on("message", (data: unknown) => {
        if (this.cleanedUp) return;
        const text = typeof data === "string" ? data : String(data);
        this.callbacks.onMessage(text);
      });

      socket.on("error", (err: unknown) => {
        if (this.cleanedUp) return;
        const error = err instanceof Error ? err : new Error(String(err));
        this.callbacks.onError(error);
      });

      socket.on("close", (...args: unknown[]) => {
        if (this.cleanedUp) return;
        const code = typeof args[0] === "number" ? args[0] : 1000;
        const reason = typeof args[1] === "string" ? args[1] : args[1] ? String(args[1]) : "";
        this.callbacks.onClose(code, reason);
        this.cleanup();
      });
      return;
    }

    // Otherwise standard W3C WebSocket properties/handlers
    socket.onopen = () => {
      if (!this.cleanedUp) this.callbacks.onOpen();
    };

    socket.onmessage = (event: { data: unknown }) => {
      if (this.cleanedUp) return;
      const text = typeof event.data === "string" ? event.data : String(event.data);
      this.callbacks.onMessage(text);
    };

    socket.onerror = (event: unknown) => {
      if (this.cleanedUp) return;
      const error = event instanceof Error ? event : new Error("WebSocket error occurred.");
      this.callbacks.onError(error);
    };

    socket.onclose = (event: { code: number; reason: string }) => {
      if (this.cleanedUp) return;
      this.callbacks.onClose(event.code ?? 1000, event.reason ?? "");
      this.cleanup();
    };
  }

  private cleanup(): void {
    this.cleanedUp = true;
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
    }
  }
}
