import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { api, connect, send, waitFrame, pool, stats } from "./hardness-support.mjs";

export async function chatSample(session, foreignSession, run, onConnected) {
  const channel = await api(session, "/chat/channels", "POST", {
    name: `CODEXSUN hardness ${run}`,
    kind: "channel",
    members: []
  });
  const clients = [],
    foreigners = [];
  const received = Array.from({ length: 100 }, () => new Map());
  const sentAt = new Map(),
    waiters = new Map(),
    counts = new Map();
  const deliveryMs = [];
  let duplicates = 0,
    leaks = 0,
    binaryFrames = 0;
  try {
    const connectionStart = performance.now();
    await Promise.all(
      Array.from({ length: 100 }, async (_, index) => {
        const start = performance.now();
        const socket = await connect(session, index);
        clients[index] = socket;
        socket.on("message", (bytes, binary) => {
          if (binary) {
            binaryFrames++;
            return;
          }
          const frame = JSON.parse(bytes.toString());
          if (
            frame.eventType !== "message.created" ||
            !frame.payload.message.body.startsWith(run + "/")
          )
            return;
          const message = frame.payload.message;
          const id = Number(message.body.split("/")[1].split(" ")[0]);
          if (received[index].has(id)) {
            duplicates++;
            return;
          }
          received[index].set(id, message.uuid);
          deliveryMs.push(performance.now() - sentAt.get(id));
          counts.set(id, (counts.get(id) ?? 0) + 1);
          if (counts.get(id) === 100) waiters.get(id)?.();
        });
        return performance.now() - start;
      })
    );
    const connectionMs = performance.now() - connectionStart;
    await Promise.all(
      clients.map(async (socket) => {
        const joined = waitFrame(
          socket,
          (frame) =>
            frame.eventType === "presence.updated" && frame.payload.channelUuid === channel.uuid
        );
        send(socket, "chat.subscribe", { channelUuid: channel.uuid });
        await joined;
      })
    );
    for (let index = 0; index < 5; index++) {
      const socket = await connect(
        foreignSession,
        index,
        "tenantId=CODEXSUN&tenantDatabase=foreign"
      );
      foreigners.push(socket);
      socket.on("message", (bytes) => {
        if (JSON.parse(bytes.toString()).eventType === "message.created") leaks++;
      });
      const denied = waitFrame(socket, (frame) => frame.eventType === "error");
      send(socket, "chat.subscribe", { channelUuid: channel.uuid });
      assert.equal((await denied).payload.code, "UNKNOWN_CHANNEL");
    }
    console.log("ChatB: 100 subscribers connected; 5 foreign-tenant subscriptions rejected.");
    const started = performance.now();
    const workerLoad = onConnected();
    await pool(100, 10, async (index) => {
      const delivered = new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`Sample message ${index} delivery timed out`)),
          20000
        );
        waiters.set(index, () => {
          clearTimeout(timer);
          resolve();
        });
      });
      sentAt.set(index, performance.now());
      send(clients[index % clients.length], "chat.send", {
        channelUuid: channel.uuid,
        body: `${run}/${index} Sample வணக்கம் 🌟`
      });
      await delivered;
    });
    const elapsedMs = performance.now() - started;
    const worker = await workerLoad;
    const messages = await api(session, `/chat/messages?channelUuid=${channel.uuid}&limit=200`);
    assert.equal(messages.length, 100);
    assert.equal(new Set(messages.map((message) => message.uuid)).size, 100);
    for (const map of received) {
      assert.equal(map.size, 100);
      for (const message of messages) {
        const index = Number(message.body.split("/")[1].split(" ")[0]);
        assert.equal(map.get(index), message.uuid);
      }
    }
    assert.equal(duplicates, 0);
    assert.equal(leaks, 0);
    assert.equal(binaryFrames, 0);
    const pingStart = performance.now();
    await Promise.all(
      clients.map(async (socket) => {
        for (let ping = 0; ping < 10; ping++) {
          const response = waitFrame(socket, (frame) => frame.eventType === "pong");
          send(socket, "chat.ping", {});
          await response;
        }
      })
    );
    const pingMs = performance.now() - pingStart;
    await badFrames(session, clients[0]);
    await pool(50, 10, async (index) => {
      const socket = await connect(session, index);
      socket.terminate();
    });
    await delay(200);
    return {
      chat: {
        connections: 100,
        isolatedForeignConnections: 5,
        messages: 100,
        deliveries: deliveryMs.length,
        persistedMessages: messages.length,
        duplicates,
        crossTenantLeaks: leaks,
        binaryFrameErrors: binaryFrames,
        connectAllMs: Math.round(connectionMs),
        elapsedMs: Math.round(elapsedMs),
        deliveryLatencyMs: stats(deliveryMs),
        pingReplies: 1000,
        pingElapsedMs: Math.round(pingMs),
        churnConnections: 50,
        malformedInputsRejected: 3
      },
      worker
    };
  } finally {
    for (const socket of [...clients, ...foreigners]) socket?.terminate();
    const messages = await api(session, `/chat/messages?channelUuid=${channel.uuid}&limit=200`);
    for (const message of messages)
      assert.ok(message.body.startsWith(run + "/"), "Refusing to remove non-sample messages");
    await pool(messages.length, 10, (index) =>
      api(session, `/chat/messages/${messages[index].uuid}`, "DELETE")
    );
    await api(session, `/chat/channels/${channel.uuid}`, "DELETE");
    console.log(
      `ChatB cleanup: removed ${messages.length} generated messages and the sample channel.`
    );
  }
}

async function badFrames(session, socket) {
  const malformed = waitFrame(socket, (frame) => frame.eventType === "error");
  socket.send("{not-json");
  assert.equal((await malformed).payload.code, "INVALID_EVENT");
  const badPayload = waitFrame(socket, (frame) => frame.eventType === "error");
  send(socket, "chat.subscribe", { channelUuid: 123 });
  assert.equal((await badPayload).payload.code, "INVALID_PAYLOAD");
  const oversized = await connect(session);
  const closed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      oversized.terminate();
      reject(new Error("Oversized frame was not rejected"));
    }, 5000);
    oversized.on("close", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
  oversized.send("x".repeat(256 * 1024 + 1));
  assert.equal(await closed, 1009);
  const alive = waitFrame(socket, (frame) => frame.eventType === "pong");
  send(socket, "chat.ping", {});
  await alive;
}
