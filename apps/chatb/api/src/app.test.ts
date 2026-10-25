import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import WebSocket from "ws";
import { buildChatb } from "./app.js";

test(
  "Chatb preserves host, selected cookie, first text frame and binary frames without tenant overrides",
  { timeout: 10000 },
  async (t) => {
    const owner = Fastify();
    await owner.register(websocket);
    owner.get("/ready", async () => ({ status: "ok" }));
    let forwarded:
      | { host: string | undefined; tenant: string | string[] | undefined; query: string }
      | undefined;
    owner.get("/chat/realtime", { websocket: true }, (socket, request) => {
      forwarded = {
        host: request.headers.host,
        tenant: request.headers["x-tenant-id"],
        query: request.url
      };
      assert.equal(request.headers.cookie, "selected=test");
      assert.equal(request.headers.authorization, "Bearer native-client");
      assert.equal(request.headers.origin, "http://tenant.example");
      setTimeout(() => {
        socket.on("message", (frame, binary) => {
          if (!binary && frame.toString().includes('"codexsun-chatb-ready"')) {
            socket.send(JSON.stringify({ eventType: "pong", payload: {} }));
          } else socket.send(frame, { binary });
        });
      }, 20);
    });
    const ownerAddress = await owner.listen({ host: "127.0.0.1", port: 0 });
    const gateway = await buildChatb({ upstreamUrl: ownerAddress.replace("http:", "ws:") });
    const address = await gateway.listen({ host: "127.0.0.1", port: 0 });
    const client = new WebSocket(
      address.replace("http:", "ws:") +
        "/chatb/realtime?sessionSlot=selected&tenantId=forged&tenantDatabase=foreign&companyId=1",
      {
        headers: {
          authorization: "Bearer native-client",
          host: "tenant.example",
          origin: "http://tenant.example",
          cookie: "selected=test",
          "x-tenant-id": "forged"
        }
      }
    );
    t.after(async () => {
      client.terminate();
      await gateway.close();
      await owner.close();
    });
    const first = once(client, "message");
    await once(client, "open");
    client.send("first text");
    const [text, binary] = await first;
    assert.equal(text.toString(), "first text");
    assert.equal(binary, false);
    assert.equal(forwarded?.host, "tenant.example");
    assert.equal(forwarded?.tenant, undefined);
    assert.equal(forwarded?.query, "/chat/realtime?sessionSlot=selected&companyId=1");
    const next = once(client, "message");
    client.send(Buffer.from([1, 2, 3]));
    const [bytes, isBinary] = await next;
    assert.deepEqual(bytes, Buffer.from([1, 2, 3]));
    assert.equal(isBinary, true);
  }
);

test(
  "Chatb returns upstream authentication rejection and reports dependency readiness",
  { timeout: 10000 },
  async (t) => {
    const owner = Fastify();
    await owner.register(websocket);
    owner.get("/ready", async (_request, reply) => reply.code(503).send({ status: "unavailable" }));
    owner.get(
      "/chat/realtime",
      {
        websocket: true,
        preValidation: async (_request, reply) => {
          await reply.code(401).send({ error: "Denied" });
        }
      },
      () => {}
    );
    const ownerAddress = await owner.listen({ host: "127.0.0.1", port: 0 });
    const gateway = await buildChatb({ upstreamUrl: ownerAddress.replace("http:", "ws:") });
    const address = await gateway.listen({ host: "127.0.0.1", port: 0 });
    const client = new WebSocket(address.replace("http:", "ws:") + "/chatb/realtime");
    t.after(async () => {
      client.terminate();
      await gateway.close();
      await owner.close();
    });
    const [code] = await once(client, "close");
    assert.equal(code, 4401);
    assert.equal((await gateway.inject("/ready")).statusCode, 503);
    assert.equal((await gateway.inject("/health")).statusCode, 200);
    assert.equal((await gateway.inject("/chatb/realtime?token=never-forward-me")).statusCode, 400);
  }
);

test(
  "Chatb handles abrupt upstream closure without an invalid close frame or process crash",
  { timeout: 10000 },
  async (t) => {
    const owner = Fastify();
    await owner.register(websocket);
    owner.get("/chat/realtime", { websocket: true }, (socket) => socket.terminate());
    const ownerAddress = await owner.listen({ host: "127.0.0.1", port: 0 });
    const gateway = await buildChatb({ upstreamUrl: ownerAddress.replace("http:", "ws:") });
    const address = await gateway.listen({ host: "127.0.0.1", port: 0 });
    const client = new WebSocket(address.replace("http:", "ws:") + "/chatb/realtime");
    t.after(async () => {
      client.terminate();
      await gateway.close();
      await owner.close();
    });
    const [code] = await once(client, "close");
    assert.equal(code, 1011);
    assert.equal((await gateway.inject("/health")).statusCode, 200);
  }
);
