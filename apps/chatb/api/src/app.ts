import Fastify from "fastify";
import websocket from "@fastify/websocket";
import WebSocket from "ws";

export async function buildChatb(options: { upstreamUrl: string }) {
  const upstream = new URL(options.upstreamUrl);
  if (!["ws:", "wss:"].includes(upstream.protocol) || upstream.username || upstream.password) {
    throw new Error("Chatb requires a ws/wss upstream without URL credentials.");
  }
  const app = Fastify({
    logger: true,
    logController: new Fastify.LogController({ disableRequestLogging: true })
  });
  const connections = new Set<WebSocket>();
  await app.register(websocket, { options: { maxPayload: 256 * 1024 } });
  app.get("/health", async () => ({ status: "ok", service: "codexsun-chatb" }));
  app.get("/ready", async (_request, reply) => {
    const target = new URL("/ready", upstream);
    target.protocol = upstream.protocol === "wss:" ? "https:" : "http:";
    const available = await fetch(target, { signal: AbortSignal.timeout(2000) })
      .then((response) => response.ok)
      .catch(() => false);
    return reply.code(available ? 200 : 503).send({ status: available ? "ok" : "unavailable" });
  });
  app.get(
    "/chatb/realtime",
    {
      websocket: true,
      preValidation: async (request, reply) => {
        const query = new URL(request.url, "http://chatb.local").searchParams;
        if (query.has("token")) {
          return reply.code(400).send({ error: "Use a session cookie or Authorization header." });
        }
      }
    },
    (socket, request) => {
      const query = new URL(request.url, "http://chatb.local").searchParams;
      const target = new URL("/chat/realtime", upstream);
      for (const key of ["sessionSlot", "companyId"]) {
        const value = query.get(key);
        if (value) target.searchParams.set(key, value);
      }
      const headers: Record<string, string> = {};
      for (const key of [
        "host",
        "cookie",
        "authorization",
        "origin",
        "sec-fetch-site",
        "x-codexsun-session-slot"
      ]) {
        const value = request.headers[key];
        if (typeof value === "string") headers[key] = value;
      }
      socket.pause();
      const remote = new WebSocket(target, {
        headers,
        handshakeTimeout: 5000,
        maxPayload: 256 * 1024
      });
      connections.add(remote);
      let upstreamReady = false;
      let warmup: NodeJS.Timeout | undefined;
      let deadline: NodeJS.Timeout | undefined;
      const stopWarmup = () => {
        clearInterval(warmup);
        clearTimeout(deadline);
      };
      remote.on("open", () => {
        const ping = () => {
          if (remote.readyState === WebSocket.OPEN)
            remote.send(
              JSON.stringify({
                eventId: "codexsun-chatb-ready",
                eventType: "chat.ping",
                payload: {}
              })
            );
        };
        warmup = setInterval(ping, 100);
        deadline = setTimeout(() => {
          stopWarmup();
          socket.resume();
          socket.close(1013, "Chat owner is not ready.");
          remote.close();
        }, 5000);
        ping();
      });
      socket.on("message", (frame, binary) => {
        if (remote.readyState === WebSocket.OPEN) remote.send(frame, { binary });
      });
      remote.on("message", (frame, binary) => {
        if (!upstreamReady) {
          if (!binary) {
            try {
              if (JSON.parse(frame.toString()).eventType === "pong") {
                upstreamReady = true;
                stopWarmup();
                socket.resume();
              }
            } catch {
              /* The owner must confirm its protocol before client messages are released. */
            }
          }
          return;
        }
        if (socket.readyState === WebSocket.OPEN) socket.send(frame, { binary });
      });
      const closeRemote = () => {
        if (remote.readyState === WebSocket.CONNECTING) remote.terminate();
        else if (remote.readyState === WebSocket.OPEN) remote.close();
      };
      socket.on("close", closeRemote);
      socket.on("error", closeRemote);
      remote.on("unexpected-response", (_request, response) => {
        stopWarmup();
        response.resume();
        if (socket.readyState === WebSocket.OPEN) {
          socket.resume();
          socket.close(response.statusCode === 401 ? 4401 : 4403, "Chat session was rejected.");
        }
        remote.terminate();
      });
      remote.on("close", (code, reason) => {
        stopWarmup();
        connections.delete(remote);
        if (socket.readyState === WebSocket.OPEN) {
          socket.resume();
          socket.close(code === 1005 ? 1000 : code === 1006 ? 1011 : code, reason.toString());
        }
      });
      remote.on("error", () => {
        stopWarmup();
        if (socket.readyState === WebSocket.OPEN) {
          socket.resume();
          socket.close(1011, "Chat realtime upstream failed.");
        }
      });
    }
  );
  app.addHook("preClose", async () => {
    for (const remote of connections) remote.terminate();
  });
  return app;
}
