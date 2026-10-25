import { createServer, type Server } from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { WebSocketServer, WebSocket as WsSocket } from "ws";
import { HostVerifier } from "../src/session/host-verifier.js";
import { NativeSessionManager } from "../src/session/native-session-manager.js";
import { NativeWebSocketTransport, type UniversalWebSocket } from "../src/native/websocket.js";

function createTestWebSocketAdapter(url: string): UniversalWebSocket {
  const ws = new WsSocket(url);
  const adapter: UniversalWebSocket = {
    get readyState() {
      return ws.readyState;
    },
    send: (d) => ws.send(d as string),
    close: (c, r) => ws.close(c, r),
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null
  };
  ws.on("open", () => adapter.onopen?.({}));
  ws.on("message", (data: unknown) => adapter.onmessage?.({ data: String(data) }));
  ws.on("error", (err: unknown) => adapter.onerror?.(err));
  ws.on("close", (code: number, reason: Buffer) => adapter.onclose?.({ code, reason: reason.toString() }));
  return adapter;
}

describe("Native WebSocket Transport", () => {
  let httpServer: Server;
  let wss: WebSocketServer;
  let serverPort: number;
  let apiOrigin: string;

  let lastUpgradeHeaders: Record<string, string | string[] | undefined> = {};
  let lastUpgradeUrl = "";
  let currentServerMode: "normal" | "reject_auth" | "drop_immediately" = "normal";

  before(async () => {
    httpServer = createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: { ok: true }, success: true }));
    });
    wss = new WebSocketServer({ noServer: true });

    httpServer.on("upgrade", (request, socket, head) => {
      lastUpgradeHeaders = request.headers;
      lastUpgradeUrl = request.url ?? "";

      if (currentServerMode === "reject_auth") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          ws.close(4401, "Chat realtime requires authentication.");
        });
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    });

    wss.on("connection", (ws: WsSocket) => {
      if (currentServerMode === "drop_immediately") {
        ws.terminate();
        return;
      }

      ws.on("message", (data) => {
        const text = data.toString();
        try {
          const parsed = JSON.parse(text) as { eventType: string; payload: unknown };
          ws.send(JSON.stringify({ eventType: `echo.${parsed.eventType}`, payload: parsed.payload }));
        } catch {
          ws.send(data);
        }
      });
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => {
        const address = httpServer.address();
        if (address && typeof address === "object") {
          serverPort = address.port;
          apiOrigin = `http://127.0.0.1:${serverPort}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    wss.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("upgrades socket with native parameters without secret query parameters", async () => {
    currentServerMode = "normal";
    const verifier = new HostVerifier({ allowLoopback: true });
    const sessionManager = new NativeSessionManager({
      apiOrigin,
      hostVerifier: verifier
    });

    const mockSession = {
      activeCompanyId: 88,
      activeFinancialYearId: 2026,
      apiOrigin,
      authenticated: true,
      desk: "tenant" as const,
      email: "staff@chatcorp.com",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      loginHost: `127.0.0.1:${serverPort}`,
      sessionGeneration: 1,
      sessionSlot: "aabbccddeeff00112233445566778899",
      tenantCode: "CHATCORP",
      tenantDbName: "tenant_chatcorp",
      tenantId: "tenant-chat-uuid",
      token: "secret-super-sensitive-token",
      userType: "tenant"
    };

    sessionManager["_activeSession"] = mockSession;
    sessionManager["_status"] = "authenticated";

    let messageReceived: unknown = null;
    const transport = new NativeWebSocketTransport({
      handlers: {
        onMessage: (msg) => {
          messageReceived = msg;
        }
      },
      hostVerifier: verifier,
      path: "/chat/realtime",
      sessionManager,
      webSocketFactory: createTestWebSocketAdapter
    });

    transport.connect();

    // Wait for connection to open
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (transport.isOpen) {
          clearInterval(check);
          resolve();
        }
      }, 10);
    });

    assert.equal(transport.isOpen, true);

    // 1. Verify URL Query: NO SECRETS IN QUERY PARAMS
    const upgradeUrl = new URL(lastUpgradeUrl, apiOrigin);
    assert.equal(upgradeUrl.searchParams.has("token"), false);
    assert.equal(upgradeUrl.searchParams.has("secret"), false);
    assert.equal(upgradeUrl.searchParams.has("password"), false);
    assert.equal(upgradeUrl.searchParams.has("jwt"), false);
    assert.equal(upgradeUrl.searchParams.get("sessionSlot"), "aabbccddeeff00112233445566778899");
    assert.equal(upgradeUrl.searchParams.get("companyId"), "88");
    assert.equal(upgradeUrl.searchParams.get("tenantId"), "tenant-chat-uuid");

    // 2. Frame transmission
    transport.send({ eventType: "message.send", payload: { text: "Hello Realtime" } });

    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (messageReceived) {
          clearInterval(check);
          resolve();
        }
      }, 10);
    });

    assert.deepEqual(messageReceived, {
      eventType: "echo.message.send",
      payload: { text: "Hello Realtime" }
    });

    transport.disconnect();
    assert.equal(transport.currentStatus, "closed");
  });

  it("handles automatic reconnect on unexpected connection loss", async () => {
    currentServerMode = "normal";
    const verifier = new HostVerifier({ allowLoopback: true });
    const sessionManager = new NativeSessionManager({
      apiOrigin,
      hostVerifier: verifier
    });

    sessionManager["_activeSession"] = {
      apiOrigin,
      authenticated: true,
      desk: "tenant",
      email: "staff@chatcorp.com",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      loginHost: `127.0.0.1:${serverPort}`,
      sessionGeneration: 1,
      sessionSlot: "aabbccddeeff00112233445566778899",
      userType: "tenant"
    };
    sessionManager["_status"] = "authenticated";

    const statusChanges: string[] = [];
    const transport = new NativeWebSocketTransport({
      handlers: {
        onStatusChange: (status) => statusChanges.push(status)
      },
      hostVerifier: verifier,
      reconnectBaseDelayMs: 50,
      sessionManager,
      webSocketFactory: createTestWebSocketAdapter
    });

    transport.connect();

    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (transport.isOpen) {
          clearInterval(check);
          resolve();
        }
      }, 10);
    });

    assert.equal(transport.isOpen, true);

    // Force disconnect from server side with 1006 (abnormal close)
    for (const client of wss.clients) {
      client.terminate();
    }

    // Client should transition to reconnecting and then open again
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (statusChanges.includes("reconnecting") && transport.isOpen) {
          clearInterval(check);
          resolve();
        }
      }, 20);
    });

    assert.ok(statusChanges.includes("reconnecting"));
    assert.equal(transport.isOpen, true);

    transport.disconnect();
  });

  it("stops reconnecting and revokes session on server expiry (close code 4401)", async () => {
    currentServerMode = "reject_auth";
    const verifier = new HostVerifier({ allowLoopback: true });
    const sessionManager = new NativeSessionManager({
      apiOrigin,
      hostVerifier: verifier
    });

    sessionManager["_activeSession"] = {
      apiOrigin,
      authenticated: true,
      desk: "tenant",
      email: "staff@chatcorp.com",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      loginHost: `127.0.0.1:${serverPort}`,
      sessionGeneration: 1,
      sessionSlot: "aabbccddeeff00112233445566778899",
      userType: "tenant"
    };
    sessionManager["_status"] = "authenticated";

    const statusChanges: string[] = [];
    const transport = new NativeWebSocketTransport({
      handlers: {
        onStatusChange: (status) => statusChanges.push(status)
      },
      hostVerifier: verifier,
      reconnectBaseDelayMs: 50,
      sessionManager,
      webSocketFactory: createTestWebSocketAdapter
    });

    transport.connect();

    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (transport.currentStatus === "closed") {
          clearInterval(check);
          resolve();
        }
      }, 20);
    });

    assert.equal(transport.currentStatus, "closed");
    // Ensure manager session status transitioned to expired
    assert.equal(sessionManager.status, "expired");
    // Ensure no reconnecting attempt occurred
    assert.equal(statusChanges.includes("reconnecting"), false);

    transport.dispose();
  });

  it("cleanly disconnects on logout without reconnecting", async () => {
    currentServerMode = "normal";
    const verifier = new HostVerifier({ allowLoopback: true });
    const sessionManager = new NativeSessionManager({
      apiOrigin,
      hostVerifier: verifier
    });

    sessionManager["_activeSession"] = {
      apiOrigin,
      authenticated: true,
      desk: "tenant",
      email: "staff@chatcorp.com",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      loginHost: `127.0.0.1:${serverPort}`,
      sessionGeneration: 1,
      sessionSlot: "aabbccddeeff00112233445566778899",
      userType: "tenant"
    };
    sessionManager["_status"] = "authenticated";

    const transport = new NativeWebSocketTransport({
      hostVerifier: verifier,
      sessionManager,
      webSocketFactory: createTestWebSocketAdapter
    });

    transport.connect();

    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (transport.isOpen) {
          clearInterval(check);
          resolve();
        }
      }, 10);
    });

    assert.equal(transport.isOpen, true);

    // Logging out the session manager automatically closes the WebSocket transport
    await sessionManager.logout();

    assert.equal(transport.isOpen, false);
    assert.equal(transport.currentStatus, "closed");

    transport.dispose();
  });
});
