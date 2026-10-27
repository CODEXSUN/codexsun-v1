import assert from "node:assert/strict";
import test from "node:test";
import {
  ChatConnectionManager,
  ChatRealtimeBus,
  ChatRealtimeGateway,
  realtimeFrame,
  type ChatRealtimeConnection
} from "./chat.realtime.js";

function connection(overrides: Partial<ChatRealtimeConnection> & { connectionId: string }): {
  connection: ChatRealtimeConnection;
  frames: string[];
} {
  const frames: string[] = [];
  const connection: ChatRealtimeConnection = {
    channels: new Set(),
    context: {
      actorEmail: "ana@example.test",
      authorize: async () => {},
      companyId: 1,
      database: undefined as never,
      tenantDatabase: "tenant_test",
      tenantId: ""
    },
    socket: {
      close: () => {},
      send: (frame) => {
        frames.push(frame);
      }
    },
    ...overrides
  };
  return { connection, frames };
}

function frameOf(raw: string): { eventType: string; payload: Record<string, unknown> } {
  return JSON.parse(raw) as { eventType: string; payload: Record<string, unknown> };
}

test("realtime bus fans out only to subscribed connections", async () => {
  const manager = new ChatConnectionManager();
  const bus = new ChatRealtimeBus(manager, async () => {});
  const first = connection({ connectionId: "one" });
  const second = connection({ connectionId: "two" });
  manager.admit(first.connection);
  manager.admit(second.connection);
  manager.subscribe("one", "channel-1");
  await bus.publish(
    first.connection.context,
    "channel-1",
    realtimeFrame("message.created", { channelUuid: "channel-1" })
  );
  assert.equal(first.frames.length, 1);
  assert.equal(second.frames.length, 0);
});

test("realtime bus skips the excluded sender", async () => {
  const manager = new ChatConnectionManager();
  const bus = new ChatRealtimeBus(manager, async () => {});
  const first = connection({ connectionId: "one" });
  manager.admit(first.connection);
  manager.subscribe("one", "channel-1");
  await bus.publish(
    first.connection.context,
    "channel-1",
    realtimeFrame("typing.started", {}),
    "ana@example.test"
  );
  assert.equal(first.frames.length, 0);
});

test("presence tracks subscribed channel members", async () => {
  const manager = new ChatConnectionManager();
  const bus = new ChatRealtimeBus(manager, async () => {});
  const first = connection({ connectionId: "one" });
  const second = connection({
    connectionId: "two",
    context: { ...first.connection.context, actorEmail: "bob@example.test" }
  });
  manager.admit(first.connection);
  manager.admit(second.connection);
  manager.subscribe("one", "channel-1");
  manager.subscribe("two", "channel-1");
  await bus.publishPresence(first.connection.context, "channel-1");
  assert.deepEqual(frameOf(first.frames[0] ?? "").payload.online, [
    "ana@example.test",
    "bob@example.test"
  ]);
  manager.remove("two");
  await bus.publishPresence(first.connection.context, "channel-1");
  assert.deepEqual(frameOf(first.frames[1] ?? "").payload.online, ["ana@example.test"]);
});

test("gateway answers ping and rejects malformed frames", async () => {
  const manager = new ChatConnectionManager();
  const bus = new ChatRealtimeBus(manager, async () => {});
  const gateway = new ChatRealtimeGateway(manager, bus);
  const peer = connection({ connectionId: "one" });
  manager.admit(peer.connection);
  await gateway.handle(
    "one",
    JSON.stringify({ eventId: "1", eventType: "chat.ping", payload: {} })
  );
  assert.equal(frameOf(peer.frames[0] ?? "").eventType, "pong");
  await gateway.handle("one", "not-json{{");
  assert.equal(frameOf(peer.frames[1] ?? "").eventType, "error");
  await gateway.handle(
    "one",
    JSON.stringify({ eventId: "2", eventType: "chat.nope", payload: {} })
  );
  assert.match(peer.frames[2] ?? "", /UNSUPPORTED_EVENT/);
});

test("gateway rejects oversized frames before parsing", async () => {
  const manager = new ChatConnectionManager();
  const bus = new ChatRealtimeBus(manager, async () => {});
  const gateway = new ChatRealtimeGateway(manager, bus);
  const peer = connection({ connectionId: "one" });
  manager.admit(peer.connection);
  await gateway.handle(
    "one",
    `{"eventId":"1","eventType":"chat.send","payload":{},"pad":"${"x".repeat(300 * 1024)}"}`
  );
  assert.match(peer.frames[0] ?? "", /PAYLOAD_TOO_LARGE/);
});

test("gateway typing fans out to other subscribers only", async () => {
  const manager = new ChatConnectionManager();
  const bus = new ChatRealtimeBus(manager, async () => {});
  const gateway = new ChatRealtimeGateway(manager, bus);
  const typer = connection({ connectionId: "typer" });
  const watcher = connection({
    connectionId: "watcher",
    context: { ...typer.connection.context, actorEmail: "bob@example.test" }
  });
  manager.admit(typer.connection);
  manager.admit(watcher.connection);
  manager.subscribe("typer", "channel-9");
  manager.subscribe("watcher", "channel-9");
  await gateway.handle(
    "typer",
    JSON.stringify({
      eventId: "1",
      eventType: "chat.typing",
      payload: { channelUuid: "channel-9", typing: true }
    })
  );
  assert.equal(typer.frames.length, 0);
  assert.equal(frameOf(watcher.frames[0] ?? "").eventType, "typing.started");
  await gateway.handle(
    "typer",
    JSON.stringify({
      eventId: "2",
      eventType: "chat.typing",
      payload: { channelUuid: "channel-9", typing: false }
    })
  );
  assert.equal(frameOf(watcher.frames[1] ?? "").eventType, "typing.stopped");
});

test("gateway reports unknown channels on subscribe without a database", async () => {
  const manager = new ChatConnectionManager();
  const bus = new ChatRealtimeBus(manager, async () => {});
  const gateway = new ChatRealtimeGateway(manager, bus);
  const peer = connection({ connectionId: "one" });
  manager.admit(peer.connection);
  await gateway.handle(
    "one",
    JSON.stringify({
      eventId: "1",
      eventType: "chat.subscribe",
      payload: { channelUuid: "missing" }
    })
  );
  assert.match(peer.frames[0] ?? "", /UNKNOWN_CHANNEL/);
  assert.equal(manager.get("one")?.channels.size ?? -1, 0);
});

test("message and presence delivery isolate colliding channel UUIDs by tenant and company", async () => {
  const manager = new ChatConnectionManager();
  const bus = new ChatRealtimeBus(manager, async () => {});
  const owner = connection({ connectionId: "owner" });
  const otherTenant = connection({
    connectionId: "tenant",
    context: { ...owner.connection.context, tenantId: "other", tenantDatabase: "other_db" }
  });
  const otherCompany = connection({
    connectionId: "company",
    context: { ...owner.connection.context, companyId: 2 }
  });
  for (const peer of [owner, otherTenant, otherCompany]) {
    manager.admit(peer.connection);
    manager.subscribe(peer.connection.connectionId, "collision");
  }
  await bus.publish(owner.connection.context, "collision", realtimeFrame("message.created", {}));
  await bus.publishPresence(owner.connection.context, "collision");
  assert.equal(owner.frames.length, 2);
  assert.deepEqual(frameOf(owner.frames[1] ?? "").payload.online, ["ana@example.test"]);
  assert.equal(otherTenant.frames.length, 0);
  assert.equal(otherCompany.frames.length, 0);
});

test("delivery removes subscribers whose membership or live permission was revoked", async () => {
  const manager = new ChatConnectionManager();
  const owner = connection({ connectionId: "owner" });
  const removed = connection({ connectionId: "removed" });
  const revoked = connection({
    connectionId: "revoked",
    context: {
      ...owner.connection.context,
      authorize: async () => {
        throw new Error("revoked");
      }
    }
  });
  removed.connection.context = {
    ...removed.connection.context,
    actorEmail: "removed@example.test"
  };
  const bus = new ChatRealtimeBus(manager, async (context) => {
    if (context.actorEmail === "removed@example.test") throw new Error("membership removed");
  });
  for (const peer of [owner, removed, revoked]) {
    manager.admit(peer.connection);
    manager.subscribe(peer.connection.connectionId, "channel");
  }
  await bus.publish(owner.connection.context, "channel", realtimeFrame("message.created", {}));
  await bus.publishPresence(owner.connection.context, "channel");
  assert.equal(owner.frames.length, 2);
  assert.equal(removed.frames.length, 0);
  assert.equal(revoked.frames.length, 0);
  assert.equal(removed.connection.channels.size, 0);
  assert.equal(revoked.connection.channels.size, 0);
});

test("typing rejects a non-member before publication", async () => {
  const manager = new ChatConnectionManager();
  const bus = new ChatRealtimeBus(manager, async () => {
    throw new Error("not a member");
  });
  const gateway = new ChatRealtimeGateway(manager, bus);
  const outsider = connection({ connectionId: "outsider" });
  const watcher = connection({ connectionId: "watcher" });
  manager.admit(outsider.connection);
  manager.admit(watcher.connection);
  manager.subscribe("watcher", "private-channel");
  await gateway.handle(
    "outsider",
    JSON.stringify({
      eventId: "1",
      eventType: "chat.typing",
      payload: { channelUuid: "private-channel", typing: true }
    })
  );
  assert.match(outsider.frames[0] ?? "", /UNKNOWN_CHANNEL/);
  assert.equal(watcher.frames.length, 0);
});

test("gateway closes revoked users before processing even a heartbeat", async () => {
  const manager = new ChatConnectionManager();
  const bus = new ChatRealtimeBus(manager, async () => {});
  const gateway = new ChatRealtimeGateway(manager, bus);
  const peer = connection({ connectionId: "revoked" });
  let closeCode = 0;
  peer.connection.context.authorize = async () => {
    throw new Error("revoked");
  };
  peer.connection.socket.close = (code) => {
    closeCode = code ?? 0;
  };
  manager.admit(peer.connection);
  await gateway.handle(
    "revoked",
    JSON.stringify({ eventId: "1", eventType: "chat.ping", payload: {} })
  );
  assert.equal(closeCode, 4403);
  assert.equal(peer.frames.length, 0);
  assert.equal(manager.get("revoked"), undefined);
});

test("a subscription removed during an access check receives no frame", async () => {
  const manager = new ChatConnectionManager();
  const peer = connection({ connectionId: "peer" });
  manager.admit(peer.connection);
  manager.subscribe("peer", "channel");
  const bus = new ChatRealtimeBus(manager, async () => {
    manager.unsubscribe("peer", "channel");
  });
  await bus.publish(peer.connection.context, "channel", realtimeFrame("message.created", {}));
  assert.equal(peer.frames.length, 0);
});

for (const publication of ["message", "presence"] as const) {
  for (const change of ["unsubscribe", "replace"] as const) {
    test(`${publication} excludes a peer ${change}d while another peer awaits authorization`, async () => {
      const manager = new ChatConnectionManager();
      const first = connection({ connectionId: "first" });
      const second = connection({
        connectionId: "second",
        context: { ...first.connection.context, actorEmail: "second@example.test" }
      });
      for (const peer of [first, second]) {
        manager.admit(peer.connection);
        manager.subscribe(peer.connection.connectionId, "channel");
      }
      let releaseCheck: () => void = () => {};
      let enteredCheck: () => void = () => {};
      const checkingSecond = new Promise<void>((resolve) => {
        enteredCheck = resolve;
      });
      const pendingCheck = new Promise<void>((resolve) => {
        releaseCheck = resolve;
      });
      const bus = new ChatRealtimeBus(manager, async (context) => {
        if (context.actorEmail === "second@example.test") {
          enteredCheck();
          await pendingCheck;
        }
      });
      const pending =
        publication === "message"
          ? bus.publish(first.connection.context, "channel", realtimeFrame("message.created", {}))
          : bus.publishPresence(first.connection.context, "channel");
      await checkingSecond;
      const replacement = connection({ connectionId: "first" });
      if (change === "unsubscribe") manager.unsubscribe("first", "channel");
      else {
        manager.admit(replacement.connection);
        manager.subscribe("first", "channel");
      }
      releaseCheck();
      await pending;
      assert.equal(first.frames.length, 0);
      assert.equal(replacement.frames.length, 0);
      assert.equal(second.frames.length, 1);
      if (publication === "presence") {
        assert.deepEqual(frameOf(second.frames[0] ?? "").payload.online, ["second@example.test"]);
      }
    });
  }
}
