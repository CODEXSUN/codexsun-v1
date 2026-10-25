import { createServer, type Server } from "node:http";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { WebSocketServer, WebSocket as NodeWebSocket, type WebSocket as WsSocket } from "ws";
import { HostVerifier } from "../src/session/host-verifier.js";
import { NativeSessionManager } from "../src/session/native-session-manager.js";
import { NativeHttpTransport } from "../src/native/http.js";
import {
  ChatCursorTracker,
  ChatRealtimeClient,
  ChatService,
  FORBIDDEN_QUERY_KEYS,
  MAX_CHAT_ATTACHMENTS,
  buildChatUpgradeHeaders,
  buildChatWebSocketUrl,
  calculateUnreadCount,
  createReadCursor,
  isMessageUnread,
  mergeMessages,
  type ChatChannel,
  type ChatMember,
  type ChatMessage,
  type ChatReadCursor,
  type ChatTelegramAccount,
  type ChatTelegramDialog,
  type ChatUserOption
} from "../src/domains/chat/index.js";

describe("Chat Mobile Parity - M0 Workflow Verification Suite", () => {
  let server: Server;
  let wss: WebSocketServer;
  let serverPort: number;
  let apiOrigin: string;

  // In-Memory Test Stores
  const users: ChatUserOption[] = [
    { email: "alice@initech.invalid", name: "Alice Smith" },
    { email: "bob@initech.invalid", name: "Bob Jones" },
    { email: "charlie@initech.invalid", name: "Charlie Brown" }
  ];

  const channels = new Map<string, ChatChannel>();
  const channelMembers = new Map<string, Map<string, ChatMember>>();
  const channelReads = new Map<string, Map<string, ChatReadCursor>>();
  const messages = new Map<string, ChatMessage>();

  let telegramAccount: ChatTelegramAccount | null = {
    accountLabel: "Initech Telegram Dispatch",
    apiId: 123456,
    authState: "authorized",
    lastError: null,
    lastSyncedAt: new Date().toISOString(),
    phoneLabel: "+15551234567",
    uuid: "tg-acc-01"
  };

  const telegramDialogs: ChatTelegramDialog[] = [
    { channelUuid: null, title: "Support Inquiries", uuid: "tg-dlg-01" },
    { channelUuid: null, title: "Vendor Field Group", uuid: "tg-dlg-02" }
  ];

  let channelCounter = 1;
  let memberCounter = 1;
  let messageCounter = 1;

  let lastUpgradeUrl = "";
  let lastUpgradeHeaders: Record<string, string | string[] | undefined> = {};
  let currentServerMode: "normal" | "reject_auth" | "foreign_tenant" = "normal";

  before(async () => {
    server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      let rawBody = "";

      req.on("data", (chunk) => {
        rawBody += chunk;
      });

      req.on("end", () => {
        let body: Record<string, unknown> = {};
        if (rawBody) {
          try {
            body = JSON.parse(rawBody) as Record<string, unknown>;
          } catch {
            // raw body
          }
        }

        const sendJson = (status: number, data: unknown) => {
          res.writeHead(status, { "Content-Type": "application/json" });
          if (status >= 400) {
            const errObj =
              data && typeof data === "object" && "error" in data
                ? (data as { error: { message?: string } }).error
                : { message: String(data) };
            res.end(JSON.stringify({ error: errObj, success: false }));
          } else {
            res.end(JSON.stringify({ data, success: true }));
          }
        };

        const tenantHeader = req.headers["x-tenant-id"] as string | undefined;
        const tenantDb = req.headers["x-tenant-db"] as string | undefined;

        // Foreign Tenant Check
        if (tenantHeader === "foreign-tenant-uuid" || tenantDb === "tenant_foreign") {
          sendJson(403, { error: { message: "Cross-tenant access forbidden." } });
          return;
        }

        const authHeader = req.headers["authorization"] as string | undefined;
        const slotHeader = req.headers["x-codexsun-session-slot"] as string | undefined;
        let actorEmail = "alice@initech.invalid";
        if (authHeader?.includes("bob") || slotHeader?.includes("bob")) {
          actorEmail = "bob@initech.invalid";
        } else if (authHeader?.includes("charlie") || slotHeader?.includes("charlie")) {
          actorEmail = "charlie@initech.invalid";
        }

        const path = url.pathname;

        // 1. Users
        if (req.method === "GET" && path === "/chat/users") {
          const search = url.searchParams.get("search")?.toLowerCase();
          const filtered = search
            ? users.filter((u) => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search))
            : users;
          sendJson(200, filtered);
          return;
        }

        // 2. Channels
        if (req.method === "GET" && path === "/chat/channels") {
          const search = url.searchParams.get("search")?.toLowerCase();
          const list = Array.from(channels.values()).filter((c) => {
            if (!search) return true;
            return c.name.toLowerCase().includes(search);
          });
          sendJson(200, list);
          return;
        }

        if (req.method === "POST" && path === "/chat/channels") {
          const id = channelCounter++;
          const uuid = `chan-uuid-${id}`;
          const newChan: ChatChannel = {
            createdAt: new Date().toISOString(),
            id,
            kind: (body.kind as ChatChannel["kind"]) ?? "channel",
            lastMessageAt: null,
            lastMessagePreview: null,
            messageCount: 0,
            name: String(body.name ?? `channel-${id}`),
            status: "active",
            unreadCount: 0,
            updatedAt: new Date().toISOString(),
            uuid
          };
          channels.set(uuid, newChan);

          // Add creator as initial admin member
          const memberMap = new Map<string, ChatMember>();
          const creatorMember: ChatMember = {
            createdAt: new Date().toISOString(),
            id: memberCounter++,
            role: "admin",
            status: "active",
            userEmail: actorEmail,
            uuid: `mem-${memberCounter}`
          };
          memberMap.set(creatorMember.uuid, creatorMember);

          // Initial invited members
          if (Array.isArray(body.members)) {
            for (const email of body.members as string[]) {
              if (email.toLowerCase() !== actorEmail.toLowerCase()) {
                const mem: ChatMember = {
                  createdAt: new Date().toISOString(),
                  id: memberCounter++,
                  role: "member",
                  status: "active",
                  userEmail: email,
                  uuid: `mem-${memberCounter}`
                };
                memberMap.set(mem.uuid, mem);
              }
            }
          }

          channelMembers.set(uuid, memberMap);
          sendJson(200, newChan);
          return;
        }

        // Channel details: /chat/channels/:id
        const chanDetailMatch = path.match(/^\/chat\/channels\/([^/]+)$/);
        if (chanDetailMatch && chanDetailMatch[1]) {
          const chanUuid = decodeURIComponent(chanDetailMatch[1]);
          const chan = channels.get(chanUuid);
          if (!chan) {
            sendJson(404, { error: { message: "Channel not found." } });
            return;
          }

          if (req.method === "GET") {
            const members = Array.from(channelMembers.get(chanUuid)?.values() ?? []);
            const msgs = Array.from(messages.values()).filter((m) => m.channelUuid === chanUuid);
            sendJson(200, {
              channel: chan,
              members,
              messages: msgs
            });
            return;
          }

          if (req.method === "PUT") {
            chan.name = String(body.name ?? chan.name);
            chan.updatedAt = new Date().toISOString();
            channels.set(chanUuid, chan);
            sendJson(200, chan);
            return;
          }

          if (req.method === "DELETE") {
            channels.delete(chanUuid);
            channelMembers.delete(chanUuid);
            sendJson(200, { uuid: chanUuid });
            return;
          }
        }

        // Suspend / Restore
        const suspendMatch = path.match(/^\/chat\/channels\/([^/]+)\/suspend$/);
        if (req.method === "POST" && suspendMatch && suspendMatch[1]) {
          const chan = channels.get(decodeURIComponent(suspendMatch[1]));
          if (chan) {
            chan.status = "inactive";
            sendJson(200, chan);
            return;
          }
        }

        const restoreMatch = path.match(/^\/chat\/channels\/([^/]+)\/restore$/);
        if (req.method === "POST" && restoreMatch && restoreMatch[1]) {
          const chan = channels.get(decodeURIComponent(restoreMatch[1]));
          if (chan) {
            chan.status = "active";
            sendJson(200, chan);
            return;
          }
        }

        // Channel Read
        const readMatch = path.match(/^\/chat\/channels\/([^/]+)\/read$/);
        if (req.method === "POST" && readMatch && readMatch[1]) {
          const chanUuid = decodeURIComponent(readMatch[1]);
          const chan = channels.get(chanUuid);
          if (chan) {
            chan.unreadCount = 0;
            let reads = channelReads.get(chanUuid);
            if (!reads) {
              reads = new Map();
              channelReads.set(chanUuid, reads);
            }
            reads.set(actorEmail, {
              channelUuid: chanUuid,
              lastMessageId: (body.messageId as number | undefined),
              lastReadAt: new Date().toISOString()
            });
            sendJson(200, { uuid: chanUuid });
            return;
          }
        }

        // Channel Members: /chat/channels/:id/members
        const membersListMatch = path.match(/^\/chat\/channels\/([^/]+)\/members$/);
        if (membersListMatch && membersListMatch[1]) {
          const chanUuid = decodeURIComponent(membersListMatch[1]);
          const memberMap = channelMembers.get(chanUuid);

          if (req.method === "GET") {
            sendJson(200, Array.from(memberMap?.values() ?? []));
            return;
          }

          if (req.method === "POST") {
            const newMem: ChatMember = {
              createdAt: new Date().toISOString(),
              id: memberCounter++,
              role: (body.role as ChatMember["role"]) ?? "member",
              status: "active",
              userEmail: String(body.userEmail ?? ""),
              uuid: `mem-${memberCounter}`
            };
            memberMap?.set(newMem.uuid, newMem);
            sendJson(200, newMem);
            return;
          }
        }

        // Remove Member: /chat/channels/:id/members/:memberUuid
        const removeMemberMatch = path.match(/^\/chat\/channels\/([^/]+)\/members\/([^/]+)$/);
        if (req.method === "DELETE" && removeMemberMatch && removeMemberMatch[1] && removeMemberMatch[2]) {
          const chanUuid = decodeURIComponent(removeMemberMatch[1]);
          const memberUuid = decodeURIComponent(removeMemberMatch[2]);
          const memberMap = channelMembers.get(chanUuid);

          // Non-admin denial check
          const callingMember = Array.from(memberMap?.values() ?? []).find(
            (m) => m.userEmail.toLowerCase() === actorEmail.toLowerCase()
          );
          if (!callingMember || callingMember.role !== "admin") {
            sendJson(403, { error: { message: "Only channel admins can perform this action." } });
            return;
          }

          const targetMember = memberMap?.get(memberUuid);
          if (!targetMember) {
            sendJson(404, { error: { message: "Channel member was not found." } });
            return;
          }

          // Sole admin removal denial check
          if (targetMember.role === "admin") {
            const adminCount = Array.from(memberMap?.values() ?? []).filter((m) => m.role === "admin").length;
            if (adminCount <= 1) {
              sendJson(409, {
                error: { message: "A channel needs at least one admin. Promote another member first." }
              });
              return;
            }
          }

          memberMap?.delete(memberUuid);
          sendJson(200, { uuid: memberUuid });
          return;
        }

        // 3. Messages
        if (req.method === "GET" && path === "/chat/messages") {
          const chanUuid = url.searchParams.get("channelUuid");
          const msgs = Array.from(messages.values()).filter((m) => m.channelUuid === chanUuid);
          sendJson(200, msgs);
          return;
        }

        if (req.method === "POST" && path === "/chat/messages") {
          const id = messageCounter++;
          const uuid = `msg-uuid-${id}`;
          const chanUuid = String(body.channelUuid);

          const rawAttachments = Array.isArray(body.attachments) ? body.attachments : [];
          const atts = rawAttachments.map((a: Record<string, unknown>, idx: number) => ({
            contentBase64: String(a.base64 ?? ""),
            fileName: String(a.fileName ?? `file-${idx}`),
            id: idx + 1,
            mimeType: String(a.mimeType ?? "application/octet-stream"),
            sizeBytes: 1024,
            uuid: `att-uuid-${id}-${idx}`
          }));

          const newMsg: ChatMessage = {
            attachments: atts,
            body: String(body.body ?? ""),
            channelUuid: chanUuid,
            createdAt: new Date().toISOString(),
            editedAt: null,
            id,
            reactions: [],
            reply: body.replyToUuid
              ? { body: "Quoted message body", senderEmail: "bob@initech.invalid", uuid: String(body.replyToUuid) }
              : null,
            senderEmail: actorEmail,
            status: "active",
            updatedAt: new Date().toISOString(),
            uuid
          };

          messages.set(uuid, newMsg);

          const chan = channels.get(chanUuid);
          if (chan) {
            chan.lastMessageAt = newMsg.createdAt;
            chan.lastMessagePreview = newMsg.body.slice(0, 50);
            chan.messageCount += 1;
            chan.unreadCount += 1;
          }

          sendJson(200, newMsg);
          return;
        }

        const msgDetailMatch = path.match(/^\/chat\/messages\/([^/]+)$/);
        if (msgDetailMatch && msgDetailMatch[1]) {
          const msgUuid = decodeURIComponent(msgDetailMatch[1]);
          const msg = messages.get(msgUuid);

          if (req.method === "GET") {
            if (!msg) {
              sendJson(404, { error: { message: "Message not found." } });
              return;
            }
            sendJson(200, msg);
            return;
          }

          if (req.method === "PUT") {
            if (!msg) {
              sendJson(404, { error: { message: "Message not found." } });
              return;
            }
            msg.body = String(body.body ?? msg.body);
            msg.editedAt = new Date().toISOString();
            sendJson(200, msg);
            return;
          }

          if (req.method === "DELETE") {
            messages.delete(msgUuid);
            sendJson(200, { uuid: msgUuid });
            return;
          }
        }

        // Reactions: /chat/messages/:id/reactions
        const reactionMatch = path.match(/^\/chat\/messages\/([^/]+)\/reactions$/);
        if (req.method === "POST" && reactionMatch && reactionMatch[1]) {
          const msg = messages.get(decodeURIComponent(reactionMatch[1]));
          if (msg) {
            const emoji = String(body.emoji ?? "👍");
            const existingRx = msg.reactions.find((r) => r.emoji === emoji);
            if (existingRx) {
              if (existingRx.own) {
                existingRx.count -= 1;
                existingRx.own = false;
              } else {
                existingRx.count += 1;
                existingRx.own = true;
              }
            } else {
              msg.reactions.push({ count: 1, emoji, own: true });
            }
            sendJson(200, msg);
            return;
          }
        }

        // Suspend/Restore message
        const suspendMsgMatch = path.match(/^\/chat\/messages\/([^/]+)\/suspend$/);
        if (req.method === "POST" && suspendMsgMatch && suspendMsgMatch[1]) {
          const msg = messages.get(decodeURIComponent(suspendMsgMatch[1]));
          if (msg) {
            msg.status = "inactive";
            sendJson(200, msg);
            return;
          }
        }

        const restoreMsgMatch = path.match(/^\/chat\/messages\/([^/]+)\/restore$/);
        if (req.method === "POST" && restoreMsgMatch && restoreMsgMatch[1]) {
          const msg = messages.get(decodeURIComponent(restoreMsgMatch[1]));
          if (msg) {
            msg.status = "active";
            sendJson(200, msg);
            return;
          }
        }

        // 4. Telegram Integration
        if (req.method === "GET" && path === "/chat/telegram/account") {
          sendJson(200, telegramAccount);
          return;
        }

        if (req.method === "POST" && path === "/chat/telegram/account/send-code") {
          sendJson(200, telegramAccount);
          return;
        }

        if (req.method === "POST" && path === "/chat/telegram/account/verify-code") {
          sendJson(200, telegramAccount);
          return;
        }

        if (req.method === "POST" && path === "/chat/telegram/account/verify-password") {
          sendJson(200, telegramAccount);
          return;
        }

        if (req.method === "POST" && path === "/chat/telegram/account/disconnect") {
          telegramAccount = null;
          sendJson(200, null);
          return;
        }

        if (req.method === "POST" && path === "/chat/telegram/dialogs/refresh") {
          sendJson(200, telegramAccount);
          return;
        }

        if (req.method === "GET" && path === "/chat/telegram/dialogs") {
          sendJson(200, telegramDialogs);
          return;
        }

        const linkMatch = path.match(/^\/chat\/telegram\/dialogs\/([^/]+)\/link$/);
        if (req.method === "PUT" && linkMatch && linkMatch[1]) {
          const dlgId = decodeURIComponent(linkMatch[1]);
          const dlg = telegramDialogs.find((d) => d.uuid === dlgId);
          if (dlg) {
            dlg.channelUuid = (body.channelUuid as string | null) ?? null;
          }
          sendJson(200, { linked: true });
          return;
        }

        if (req.method === "GET" && path === "/chat/telegram/conversations") {
          sendJson(200, [
            { channelName: "Field Dispatch", channelUuid: "chan-uuid-1" }
          ]);
          return;
        }

        sendJson(404, { error: { message: "Route not found" } });
      });
    });

    // WebSocket Realtime Server
    wss = new WebSocketServer({ noServer: true });

    const wsClients = new Map<WsSocket, { actorEmail: string; channels: Set<string> }>();

    server.on("upgrade", (request, socket, head) => {
      lastUpgradeUrl = request.url ?? "";
      lastUpgradeHeaders = request.headers;

      if (currentServerMode === "reject_auth") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          ws.close(4401, "Chat realtime requires authentication.");
        });
        return;
      }

      if (currentServerMode === "foreign_tenant") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          ws.close(4408, "Foreign tenant database rejected.");
        });
        return;
      }

      // Check auth: session slot or authorization header or cookie
      const hasAuth =
        request.headers["x-codexsun-session-slot"] ||
        request.headers["authorization"] ||
        (typeof request.headers["cookie"] === "string" && request.headers["cookie"].includes("codexsun_session"));

      if (!hasAuth) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          ws.close(4401, "Chat realtime requires authentication.");
        });
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    });

    wss.on("connection", (ws: WsSocket, request) => {
      const email = (request.headers["x-actor-email"] as string | undefined) ?? "alice@initech.invalid";
      const clientInfo = { actorEmail: email, channels: new Set<string>() };
      wsClients.set(ws, clientInfo);

      ws.on("message", (data) => {
        try {
          const text = data.toString();
          const frame = JSON.parse(text) as { eventId: string; eventType: string; payload: Record<string, unknown> };

          if (frame.eventType === "chat.ping") {
            ws.send(JSON.stringify({ eventType: "pong", payload: {} }));
            return;
          }

          if (frame.eventType === "chat.subscribe") {
            const chanUuid = String(frame.payload.channelUuid);
            clientInfo.channels.add(chanUuid);

            // Broadcast presence
            const online = Array.from(wsClients.values())
              .filter((c) => c.channels.has(chanUuid))
              .map((c) => c.actorEmail);

            for (const [client, info] of wsClients.entries()) {
              if (info.channels.has(chanUuid) && client.readyState === NodeWebSocket.OPEN) {
                client.send(
                  JSON.stringify({
                    eventType: "presence.updated",
                    payload: { channelUuid: chanUuid, online }
                  })
                );
              }
            }
            return;
          }

          if (frame.eventType === "chat.unsubscribe") {
            const chanUuid = String(frame.payload.channelUuid);
            clientInfo.channels.delete(chanUuid);
            return;
          }

          if (frame.eventType === "chat.typing") {
            const chanUuid = String(frame.payload.channelUuid);
            const typing = Boolean(frame.payload.typing);

            for (const [client, info] of wsClients.entries()) {
              if (
                client !== ws &&
                info.channels.has(chanUuid) &&
                client.readyState === NodeWebSocket.OPEN
              ) {
                client.send(
                  JSON.stringify({
                    eventType: typing ? "typing.started" : "typing.stopped",
                    payload: { channelUuid: chanUuid, userEmail: clientInfo.actorEmail }
                  })
                );
              }
            }
            return;
          }

          if (frame.eventType === "chat.read") {
            const chanUuid = String(frame.payload.channelUuid);
            ws.send(JSON.stringify({ eventType: "read.ack", payload: { channelUuid: chanUuid } }));
            return;
          }

          if (frame.eventType === "chat.sync") {
            const chanUuid = String(frame.payload.channelUuid);
            const after = String(frame.payload.after);
            const matchedMsgs = Array.from(messages.values())
              .filter((m) => m.channelUuid === chanUuid && m.createdAt >= after);

            ws.send(
              JSON.stringify({
                eventType: "sync.completed",
                payload: { channelUuid: chanUuid, messages: matchedMsgs }
              })
            );
            return;
          }
        } catch {
          // ignore malformed
        }
      });

      ws.on("close", () => {
        wsClients.delete(ws);
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
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
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // Helpers to initialize native transport
  function createTestTransport(actor = "alice", tenantId = "tenant-initech-uuid") {
    const verifier = new HostVerifier({ allowLoopback: true });
    const sessionManager = new NativeSessionManager({
      apiOrigin,
      hostVerifier: verifier
    });

    const email = `${actor}@initech.invalid`;
    const sessionRecord = {
      activeCompanyId: 10,
      activeFinancialYearId: 2026,
      apiOrigin,
      authenticated: true,
      desk: "tenant" as const,
      email,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      loginHost: `127.0.0.1:${serverPort}`,
      sessionGeneration: 1,
      sessionSlot: `test-session-slot-${actor}`,
      tenantCode: "INITECH",
      tenantDbName: "tenant_initech",
      tenantId,
      token: `secret-${actor}-bearer-token`,
      userType: "tenant"
    };

    (sessionManager as unknown as { _activeSession: typeof sessionRecord; _status: string })._activeSession = sessionRecord;
    (sessionManager as unknown as { _status: string })._status = "authenticated";

    const transport = new NativeHttpTransport({
      hostVerifier: verifier,
      sessionManager
    });

    return { sessionManager, transport, verifier };
  }

  // ==========================================
  // Suite 1: Channel Types & CRUD Lifecycle
  // ==========================================

  describe("1. Channel Kinds & CRUD Lifecycle", () => {
    it("creates DM, group, topic, and broadcast channels with initial members", async () => {
      const { transport } = createTestTransport();
      const service = new ChatService(transport);

      // Topic channel
      const topicChan = await service.createChannel({
        kind: "channel",
        members: ["bob@initech.invalid"],
        name: "general-engineering"
      });
      assert.equal(topicChan.name, "general-engineering");
      assert.equal(topicChan.kind, "channel");
      assert.equal(topicChan.status, "active");

      // Direct message channel
      const dmChan = await service.createChannel({
        kind: "dm",
        members: ["bob@initech.invalid"],
        name: "dm-alice-bob"
      });
      assert.equal(dmChan.kind, "dm");

      // Group channel
      const groupChan = await service.createChannel({
        kind: "group",
        members: ["bob@initech.invalid", "charlie@initech.invalid"],
        name: "project-alpha-squad"
      });
      assert.equal(groupChan.kind, "group");

      // Broadcast channel
      const broadcastChan = await service.createChannel({
        kind: "broadcast",
        name: "all-hands-announcements"
      });
      assert.equal(broadcastChan.kind, "broadcast");

      // List all channels
      const all = await service.listChannels();
      assert.ok(all.length >= 4);

      // Search channels
      const searchRes = await service.listChannels({ search: "engineering" });
      assert.equal(searchRes.length, 1);
      assert.equal(searchRes[0]?.name, "general-engineering");
    });

    it("fetches, renames, suspends, restores, and deletes channels", async () => {
      const { transport } = createTestTransport();
      const service = new ChatService(transport);

      const chan = await service.createChannel({
        kind: "channel",
        name: "temporary-field-chat"
      });

      // Get channel detail
      const detail = await service.getChannel(chan.uuid);
      assert.equal(detail.channel.uuid, chan.uuid);
      assert.ok(detail.members.length >= 1);

      // Rename
      const renamed = await service.renameChannel(chan.uuid, "permanent-field-chat");
      assert.equal(renamed.name, "permanent-field-chat");

      // Suspend
      const suspended = await service.suspendChannel(chan.uuid);
      assert.equal(suspended.status, "inactive");

      // Restore
      const restored = await service.restoreChannel(chan.uuid);
      assert.equal(restored.status, "active");

      // Force delete
      const deleted = await service.forceDeleteChannel(chan.uuid);
      assert.equal(deleted.uuid, chan.uuid);

      // Verify deletion
      await assert.rejects(async () => {
        await service.getChannel(chan.uuid);
      });
    });

    it("lists chat users for membership pickers", async () => {
      const { transport } = createTestTransport();
      const service = new ChatService(transport);

      const userList = await service.listUsers();
      assert.equal(userList.length, 3);

      const searchList = await service.listUsers("Alice");
      assert.equal(searchList.length, 1);
      assert.equal(searchList[0]?.name, "Alice Smith");
    });
  });

  // ==========================================
  // Suite 2: Channel Membership Administration & Denial Rules
  // ==========================================

  describe("2. Channel Membership Administration & Denial Rules", () => {
    it("adds members, lists members, and allows member removal by channel admin", async () => {
      const { transport } = createTestTransport("alice");
      const service = new ChatService(transport);

      const chan = await service.createChannel({
        kind: "channel",
        name: "ops-coordination"
      });

      // Add regular member
      const member1 = await service.addMember(chan.uuid, {
        role: "member",
        userEmail: "bob@initech.invalid"
      });
      assert.equal(member1.userEmail, "bob@initech.invalid");
      assert.equal(member1.role, "member");

      // Add admin member
      const member2 = await service.addMember(chan.uuid, {
        role: "admin",
        userEmail: "charlie@initech.invalid"
      });
      assert.equal(member2.role, "admin");

      // List members
      const members = await service.listMembers(chan.uuid);
      assert.equal(members.length, 3); // Creator + bob + charlie

      // Admin removes regular member
      const removed = await service.removeMember(chan.uuid, member1.uuid);
      assert.equal(removed.uuid, member1.uuid);

      const remaining = await service.listMembers(chan.uuid);
      assert.equal(remaining.length, 2);
    });

    it("DENIES membership removal when requested by a non-admin", async () => {
      // Create channel as admin (alice) and add bob as regular member
      const { transport: aliceTransport } = createTestTransport("alice");
      const aliceService = new ChatService(aliceTransport);

      const chan = await aliceService.createChannel({
        kind: "channel",
        name: "admin-only-removal"
      });

      const memberBob = await aliceService.addMember(chan.uuid, {
        role: "member",
        userEmail: "bob@initech.invalid"
      });

      // Non-admin transport (bob)
      const { transport: bobTransport } = createTestTransport("bob");
      const bobService = new ChatService(bobTransport);

      // Attempt to delete member as non-admin bob
      await assert.rejects(
        async () => {
          await bobService.removeMember(chan.uuid, memberBob.uuid);
        },
        (err: Error) => {
          return err.message.includes("403") || err.message.includes("admins");
        }
      );
    });

    it("DENIES removing the sole admin of a channel", async () => {
      const { transport } = createTestTransport("alice");
      const service = new ChatService(transport);

      const chan = await service.createChannel({
        kind: "group",
        name: "sole-admin-group"
      });

      const members = await service.listMembers(chan.uuid);
      const creatorAdmin = members.find((m) => m.role === "admin");
      assert.ok(creatorAdmin);

      // Attempt to remove the sole admin
      await assert.rejects(
        async () => {
          await service.removeMember(chan.uuid, creatorAdmin.uuid);
        },
        (err: Error) => {
          return (
            err.message.includes("409") ||
            err.message.includes("at least one admin")
          );
        }
      );
    });
  });

  // ==========================================
  // Suite 3: Message Lifecycle, Reactions & Multipart Attachments
  // ==========================================

  describe("3. Message Lifecycle, Reactions & Multipart Attachments", () => {
    it("sends text message, edits body, and toggles reactions", async () => {
      const { transport } = createTestTransport();
      const service = new ChatService(transport);

      const chan = await service.createChannel({
        kind: "channel",
        name: "field-inspections"
      });

      // Send text message
      const msg = await service.sendMessage({
        body: "First inspection complete at Sector 7.",
        channelUuid: chan.uuid
      });
      assert.equal(msg.body, "First inspection complete at Sector 7.");
      assert.equal(msg.status, "active");

      // Edit message
      const edited = await service.updateMessage(msg.uuid, "Updated inspection report: Sector 7 clear.");
      assert.equal(edited.body, "Updated inspection report: Sector 7 clear.");
      assert.ok(edited.editedAt !== null);

      // Toggle reaction: add 👍
      const rx1 = await service.toggleReaction(msg.uuid, "👍");
      const thumbsUp = rx1.reactions.find((r) => r.emoji === "👍");
      assert.ok(thumbsUp);
      assert.equal(thumbsUp.count, 1);
      assert.equal(thumbsUp.own, true);

      // Toggle reaction again: remove 👍
      const rx2 = await service.toggleReaction(msg.uuid, "👍");
      const thumbsUpRemoved = rx2.reactions.find((r) => r.emoji === "👍");
      assert.equal(thumbsUpRemoved?.count, 0);

      // Suspend message
      const suspended = await service.suspendMessage(msg.uuid);
      assert.equal(suspended.status, "inactive");

      // Restore message
      const restored = await service.restoreMessage(msg.uuid);
      assert.equal(restored.status, "active");

      // Delete message
      const deleted = await service.forceDeleteMessage(msg.uuid);
      assert.equal(deleted.uuid, msg.uuid);
    });

    it("sends message with multipart file and image attachments", async () => {
      const { transport } = createTestTransport();
      const service = new ChatService(transport);

      const chan = await service.createChannel({
        kind: "channel",
        name: "blueprint-sharing"
      });

      const pdfAttachment = {
        base64: "JVBERi0xLjQKJcTl8uXrCjEgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iag==",
        fileName: "blueprint-schematic.pdf",
        mimeType: "application/pdf"
      };

      const imgAttachment = {
        base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        fileName: "inspection-photo.png",
        mimeType: "image/png"
      };

      const msgWithFiles = await service.sendMessage({
        attachments: [pdfAttachment, imgAttachment],
        body: "Attached the schematic PDF and live site photo.",
        channelUuid: chan.uuid
      });

      assert.equal(msgWithFiles.attachments.length, 2);
      assert.equal(msgWithFiles.attachments[0]?.fileName, "blueprint-schematic.pdf");
      assert.equal(msgWithFiles.attachments[1]?.mimeType, "image/png");
    });

    it("rejects message when attachment count exceeds MAX_CHAT_ATTACHMENTS limit", async () => {
      const { transport } = createTestTransport();
      const service = new ChatService(transport);

      const excessiveAttachments = Array.from({ length: MAX_CHAT_ATTACHMENTS + 1 }, (_, i) => ({
        base64: "dGVzdA==",
        fileName: `file-${i}.txt`,
        mimeType: "text/plain"
      }));

      await assert.rejects(
        async () => {
          await service.sendMessage({
            attachments: excessiveAttachments,
            body: "Too many files",
            channelUuid: "chan-uuid-1"
          });
        },
        (err: Error) => err.message.includes(`Maximum of ${MAX_CHAT_ATTACHMENTS}`)
      );
    });
  });

  // ==========================================
  // Suite 4: Read Cursor Synchronization, Same-Second Disambiguation & Deduplication
  // ==========================================

  describe("4. Read Cursor Synchronization, Same-Second Disambiguation & Deduplication", () => {
    it("handles same-second cursor tracking with identical timestamp disambiguation", () => {
      const sameSecondTimestamp = "2026-10-25T12:00:00.000Z";

      const msg1: ChatMessage = {
        attachments: [],
        body: "Message 1",
        channelUuid: "chan-1",
        createdAt: sameSecondTimestamp,
        editedAt: null,
        id: 101,
        reactions: [],
        reply: null,
        senderEmail: "bob@initech.invalid",
        status: "active",
        updatedAt: sameSecondTimestamp,
        uuid: "msg-same-1"
      };

      const msg2: ChatMessage = {
        attachments: [],
        body: "Message 2 in same second",
        channelUuid: "chan-1",
        createdAt: sameSecondTimestamp,
        editedAt: null,
        id: 102,
        reactions: [],
        reply: null,
        senderEmail: "bob@initech.invalid",
        status: "active",
        updatedAt: sameSecondTimestamp,
        uuid: "msg-same-2"
      };

      const msg3: ChatMessage = {
        attachments: [],
        body: "Message 3 in next second",
        channelUuid: "chan-1",
        createdAt: "2026-10-25T12:00:01.000Z",
        editedAt: null,
        id: 103,
        reactions: [],
        reply: null,
        senderEmail: "bob@initech.invalid",
        status: "active",
        updatedAt: "2026-10-25T12:00:01.000Z",
        uuid: "msg-next-3"
      };

      // Cursor is at msg1 (id 101)
      const cursorAtMsg1 = createReadCursor("chan-1", msg1);
      assert.equal(cursorAtMsg1.lastReadAt, sameSecondTimestamp);
      assert.equal(cursorAtMsg1.lastMessageId, 101);

      // msg1 should be READ
      assert.equal(isMessageUnread(msg1, cursorAtMsg1), false);

      // msg2 (id 102) in the SAME SECOND should be UNREAD!
      assert.equal(isMessageUnread(msg2, cursorAtMsg1), true);

      // msg3 in next second should be UNREAD
      assert.equal(isMessageUnread(msg3, cursorAtMsg1), true);

      // Advance cursor to msg2
      const cursorAtMsg2 = createReadCursor("chan-1", msg2);
      assert.equal(isMessageUnread(msg1, cursorAtMsg2), false);
      assert.equal(isMessageUnread(msg2, cursorAtMsg2), false);
      assert.equal(isMessageUnread(msg3, cursorAtMsg2), true);
    });

    it("calculates accurate unread count and resets on markChannelRead", async () => {
      const { transport } = createTestTransport();
      const service = new ChatService(transport);
      const tracker = new ChatCursorTracker("alice@initech.invalid");

      const chan = await service.createChannel({
        kind: "channel",
        name: "cursor-test-chan"
      });

      const msgs: ChatMessage[] = [
        {
          attachments: [],
          body: "Hello from Bob",
          channelUuid: chan.uuid,
          createdAt: "2026-10-25T10:00:00.000Z",
          editedAt: null,
          id: 1,
          reactions: [],
          reply: null,
          senderEmail: "bob@initech.invalid",
          status: "active",
          updatedAt: "2026-10-25T10:00:00.000Z",
          uuid: "m-1"
        },
        {
          attachments: [],
          body: "My own message should not increment unread",
          channelUuid: chan.uuid,
          createdAt: "2026-10-25T10:00:01.000Z",
          editedAt: null,
          id: 2,
          reactions: [],
          reply: null,
          senderEmail: "alice@initech.invalid",
          status: "active",
          updatedAt: "2026-10-25T10:00:01.000Z",
          uuid: "m-2"
        },
        {
          attachments: [],
          body: "Second message from Bob",
          channelUuid: chan.uuid,
          createdAt: "2026-10-25T10:00:02.000Z",
          editedAt: null,
          id: 3,
          reactions: [],
          reply: null,
          senderEmail: "bob@initech.invalid",
          status: "active",
          updatedAt: "2026-10-25T10:00:02.000Z",
          uuid: "m-3"
        }
      ];

      tracker.ingest(chan.uuid, msgs);

      // Initially with no cursor, Bob's 2 messages are unread (Alice's own message is excluded)
      assert.equal(tracker.getUnreadCount(chan.uuid), 2);

      // Advance cursor to m-1
      tracker.markRead(chan.uuid, msgs[0]);
      // Now only m-3 is unread
      assert.equal(tracker.getUnreadCount(chan.uuid), 1);

      // Mark channel read over HTTP
      await service.markChannelRead(chan.uuid);
      tracker.markRead(chan.uuid);
      // All read
      assert.equal(tracker.getUnreadCount(chan.uuid), 0);
    });

    it("deduplicates message batches without duplicate UUIDs", () => {
      const original: ChatMessage[] = [
        {
          attachments: [],
          body: "Original text",
          channelUuid: "c1",
          createdAt: "2026-10-25T09:00:00.000Z",
          editedAt: null,
          id: 1,
          reactions: [],
          reply: null,
          senderEmail: "bob@initech.invalid",
          status: "active",
          updatedAt: "2026-10-25T09:00:00.000Z",
          uuid: "msg-dedup-1"
        }
      ];

      const incomingFromSync: ChatMessage[] = [
        {
          attachments: [],
          body: "Original text with reaction updated",
          channelUuid: "c1",
          createdAt: "2026-10-25T09:00:00.000Z",
          editedAt: null,
          id: 1,
          reactions: [{ count: 1, emoji: "❤️", own: true }],
          reply: null,
          senderEmail: "bob@initech.invalid",
          status: "active",
          updatedAt: "2026-10-25T09:05:00.000Z",
          uuid: "msg-dedup-1"
        },
        {
          attachments: [],
          body: "Newer message",
          channelUuid: "c1",
          createdAt: "2026-10-25T09:01:00.000Z",
          editedAt: null,
          id: 2,
          reactions: [],
          reply: null,
          senderEmail: "alice@initech.invalid",
          status: "active",
          updatedAt: "2026-10-25T09:01:00.000Z",
          uuid: "msg-dedup-2"
        }
      ];

      const merged = mergeMessages(original, incomingFromSync);

      // Length must be exactly 2 (msg-dedup-1 not duplicated!)
      assert.equal(merged.length, 2);
      assert.equal(merged[0]?.uuid, "msg-dedup-1");
      assert.equal(merged[0]?.reactions.length, 1);
      assert.equal(merged[1]?.uuid, "msg-dedup-2");
    });
  });

  // ==========================================
  // Suite 5: Realtime WebSocket Lifecycle & F-W01-01 Seam Verification
  // ==========================================

  describe("5. Realtime WebSocket Lifecycle & F-W01-01 Seam Verification", () => {
    it("connects via pluggable seam, transmits ping, presence, and typing frames", async () => {
      currentServerMode = "normal";

      let statusChanges: string[] = [];
      let presenceReceived: string[] = [];
      let typingReceived = false;

      const client = new ChatRealtimeClient({
        apiOrigin,
        autoConnect: false,
        context: {
          activeCompanyId: 10,
          sessionSlot: "slot-alice",
          tenantDbName: "tenant_initech",
          tenantId: "tenant-initech-uuid",
          token: "secret-bearer-token"
        },
        handlers: {
          onPresence: (_channelUuid, online) => {
            presenceReceived = online;
          },
          onStatusChange: (status) => {
            statusChanges.push(status);
          },
          onTyping: (_chan, user, typing) => {
            if (typing && user === "bob@initech.invalid") {
              typingReceived = true;
            }
          }
        },
        socketFactory: (url, protocols, options) => {
          return new NodeWebSocket(url, protocols, {
            headers: options?.headers
          }) as unknown as ReturnType<typeof import("../src/domains/chat/chat-transport.js").defaultWebSocketFactory>;
        }
      });

      client.connect();

      // Wait for open status
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (client.isOpen) {
            clearInterval(interval);
            resolve();
          }
        }, 15);
      });

      assert.equal(client.isOpen, true);
      assert.ok(statusChanges.includes("connecting"));
      assert.ok(statusChanges.includes("open"));

      // Subscribe to channel
      client.subscribe("chan-realtime-1");
      assert.ok(client.activeSubscriptions.includes("chan-realtime-1"));

      // Send ping
      client.ping();

      // Send typing
      client.sendTyping("chan-realtime-1", true);

      // Clean disconnect
      client.disconnect();
      assert.equal(client.isOpen, false);
      assert.equal(client.currentStatus, "closed");
    });

    it("verifies F-W01-01: zero token leakage in WebSocket URL query params", () => {
      const url = buildChatWebSocketUrl({
        apiOrigin: "https://api.initech.example.com:8443",
        context: {
          activeCompanyId: 99,
          sessionSlot: "safe-session-slot-01",
          tenantDbName: "tenant_db_123",
          tenantId: "tenant-uuid-456"
        }
      });

      // Assert protocol mapped to wss:
      assert.ok(url.startsWith("wss://api.initech.example.com:8443/chat/realtime"));

      // Assert safe context query parameters exist
      assert.ok(url.includes("companyId=99"));
      assert.ok(url.includes("tenantId=tenant-uuid-456"));
      assert.ok(url.includes("tenantDatabase=tenant_db_123"));
      assert.ok(url.includes("sessionSlot=safe-session-slot-01"));

      // Check strictly against all forbidden secret keys
      const parsed = new URL(url);
      for (const forbidden of FORBIDDEN_QUERY_KEYS) {
        assert.equal(parsed.searchParams.has(forbidden), false, `Forbidden key ${forbidden} leaked in query!`);
      }

      // Verify that upgrade headers contain secret token for native upgrade seam
      const headers = buildChatUpgradeHeaders({
        activeCompanyId: 99,
        sessionSlot: "safe-session-slot-01",
        tenantDbName: "tenant_db_123",
        tenantId: "tenant-uuid-456",
        token: "very-sensitive-bearer-token"
      });

      assert.equal(headers["Authorization"], "Bearer very-sensitive-bearer-token");
      assert.equal(headers["x-codexsun-session-slot"], "safe-session-slot-01");
      assert.ok(headers["Cookie"]?.includes("codexsun_session_safe-session-slot-01"));
    });

    it("handles unexpected disconnect with exponential backoff and subscription restoration", async () => {
      let reconnectStatusObserved = false;

      const client = new ChatRealtimeClient({
        apiOrigin,
        autoConnect: false,
        context: {
          activeCompanyId: 10,
          sessionSlot: "slot-alice",
          tenantDbName: "tenant_initech",
          tenantId: "tenant-initech-uuid",
          token: "secret-token"
        },
        handlers: {
          onStatusChange: (status) => {
            if (status === "reconnecting") {
              reconnectStatusObserved = true;
            }
          }
        },
        maxReconnectAttempts: 3,
        reconnectBaseDelayMs: 20, // fast delay for test
        socketFactory: (url, protocols, options) => {
          return new NodeWebSocket(url, protocols, {
            headers: options?.headers
          }) as unknown as ReturnType<typeof import("../src/domains/chat/chat-transport.js").defaultWebSocketFactory>;
        }
      });

      client.connect();

      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (client.isOpen) {
            clearInterval(interval);
            resolve();
          }
        }, 10);
      });

      client.subscribe("chan-resilient-1");

      // Simulate unexpected server drop
      for (const c of wss.clients) {
        c.terminate();
      }

      // Wait for reconnect attempt
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (reconnectStatusObserved && client.isOpen) {
            clearInterval(interval);
            resolve();
          }
        }, 15);
      });

      // Verified reconnected and subscriptions restored
      assert.equal(client.isOpen, true);
      assert.ok(client.activeSubscriptions.includes("chan-resilient-1"));

      client.disconnect();
    });

    it("cleanly disconnects on logout without reconnecting", async () => {
      let reconnectAttempts = 0;

      const client = new ChatRealtimeClient({
        apiOrigin,
        autoConnect: false,
        context: {
          activeCompanyId: 10,
          sessionSlot: "slot-alice",
          tenantDbName: "tenant_initech",
          tenantId: "tenant-initech-uuid",
          token: "secret-token"
        },
        handlers: {
          onStatusChange: (status) => {
            if (status === "reconnecting") {
              reconnectAttempts += 1;
            }
          }
        },
        socketFactory: (url, protocols, options) => {
          return new NodeWebSocket(url, protocols, {
            headers: options?.headers
          }) as unknown as ReturnType<typeof import("../src/domains/chat/chat-transport.js").defaultWebSocketFactory>;
        }
      });

      client.connect();

      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (client.isOpen) {
            clearInterval(interval);
            resolve();
          }
        }, 10);
      });

      // Explicit logout disconnect
      client.disconnect(1000, "User logged out");

      assert.equal(client.isOpen, false);
      assert.equal(client.currentStatus, "closed");

      // Wait 100ms to ensure no reconnection triggers
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      assert.equal(reconnectAttempts, 0);
      assert.equal(client.currentStatus, "closed");
    });
  });

  // ==========================================
  // Suite 6: Optional Telegram Dialogs & Settings Integration
  // ==========================================

  describe("6. Optional Telegram Dialogs & Settings Integration", () => {
    it("fetches account, sends code, verifies code/password, links dialogs, and lists conversations", async () => {
      const { transport } = createTestTransport();
      const service = new ChatService(transport);

      // Account status
      const account = await service.getTelegramAccount();
      assert.ok(account);
      assert.equal(account.phoneLabel, "+15551234567");

      // Request auth code
      const sent = await service.requestTelegramCode({
        apiHash: "0123456789abcdef0123456789abcdef",
        apiId: 123456,
        phone: "+15551234567"
      });
      assert.ok(sent);

      // Verify code
      const verified = await service.verifyTelegramCode("12345");
      assert.ok(verified);

      // Verify password
      const pwVerified = await service.verifyTelegramPassword("telegram-2fa-pwd");
      assert.ok(pwVerified);

      // Refresh dialogs
      await service.refreshTelegramDialogs();

      // List dialogs
      const dialogs = await service.listTelegramDialogs();
      assert.equal(dialogs.length, 2);

      // Link dialog to channel
      const linkRes = await service.linkTelegramDialog("tg-dlg-01", "chan-uuid-1");
      assert.equal(linkRes.linked, true);

      // List mapped conversations
      const convos = await service.listTelegramConversations();
      assert.equal(convos.length, 1);
      assert.equal(convos[0]?.channelName, "Field Dispatch");

      // Disconnect account
      const disconnected = await service.disconnectTelegram();
      assert.equal(disconnected, null);
    });
  });

  // ==========================================
  // Suite 7: Negative Security & Tenant Isolation Tests
  // ==========================================

  describe("7. Negative Security & Multi-Tenant Denial Tests", () => {
    it("REJECTS unauthenticated socket upgrades with code 4401 without reconnect loop", async () => {
      currentServerMode = "reject_auth";

      const errors: string[] = [];
      let statusWasReconnecting = false;

      const client = new ChatRealtimeClient({
        apiOrigin,
        autoConnect: false,
        context: {
          activeCompanyId: 10,
          sessionSlot: "unauth-slot",
          tenantDbName: "tenant_initech",
          tenantId: "tenant-initech-uuid"
          // Missing token / unauthenticated
        },
        handlers: {
          onError: (err) => {
            errors.push(typeof err === "string" ? err : err.message);
          },
          onStatusChange: (status) => {
            if (status === "reconnecting") {
              statusWasReconnecting = true;
            }
          }
        },
        socketFactory: (url, protocols, options) => {
          return new NodeWebSocket(url, protocols, {
            headers: options?.headers
          }) as unknown as ReturnType<typeof import("../src/domains/chat/chat-transport.js").defaultWebSocketFactory>;
        }
      });

      client.connect();

      // Wait for rejection close event
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (client.currentStatus === "closed") {
            clearInterval(interval);
            resolve();
          }
        }, 15);
      });

      currentServerMode = "normal";

      assert.equal(client.currentStatus, "closed");
      assert.ok(
        errors.some((e) => e.includes("4401") || e.includes("Unauthorized") || e.includes("rejected")),
        `Expected 4401 error, got: ${JSON.stringify(errors)}`
      );
      assert.equal(statusWasReconnecting, false, "Must not attempt reconnect on 4401 unauthorized!");
    });

    it("REJECTS foreign tenant HTTP requests with 403 Forbidden", async () => {
      // Connect as foreign tenant
      const { transport } = createTestTransport("alice", "foreign-tenant-uuid");
      const service = new ChatService(transport);

      await assert.rejects(
        async () => {
          await service.listChannels();
        },
        (err: Error) => err.message.includes("403") || err.message.includes("Cross-tenant")
      );
    });

    it("REJECTS foreign tenant WebSocket connections with 4408", async () => {
      currentServerMode = "foreign_tenant";

      const errors: string[] = [];

      const client = new ChatRealtimeClient({
        apiOrigin,
        autoConnect: false,
        context: {
          activeCompanyId: 10,
          sessionSlot: "foreign-slot",
          tenantDbName: "tenant_foreign",
          tenantId: "foreign-tenant-uuid",
          token: "foreign-token"
        },
        handlers: {
          onError: (err) => {
            errors.push(typeof err === "string" ? err : err.message);
          }
        },
        socketFactory: (url, protocols, options) => {
          return new NodeWebSocket(url, protocols, {
            headers: options?.headers
          }) as unknown as ReturnType<typeof import("../src/domains/chat/chat-transport.js").defaultWebSocketFactory>;
        }
      });

      client.connect();

      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (client.currentStatus === "closed") {
            clearInterval(interval);
            resolve();
          }
        }, 15);
      });

      currentServerMode = "normal";

      assert.equal(client.currentStatus, "closed");
      assert.ok(
        errors.some((e) => e.includes("4408") || e.includes("tenant")),
        `Expected 4408 error, got: ${JSON.stringify(errors)}`
      );
    });
  });
});
