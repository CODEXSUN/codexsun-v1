import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Ensure build output exists before importing
const distPath = resolve(process.cwd(), "dist/devkits/codeit/api");
if (!existsSync(join(distPath, "modules/run/index.js"))) {
  execSync("npx tsc -p devkits/codeit/api/tsconfig.json", { stdio: "inherit" });
}

const { ConversationModule } = await import(
  pathToFileURL(join(distPath, "modules/conversation/index.js")).href
);

const { RunModule } = await import(pathToFileURL(join(distPath, "modules/run/index.js")).href);

const { ProviderService, MockProvider } = await import(
  pathToFileURL(join(distPath, "modules/provider/index.js")).href
);

const { CodeitDatabase, runMigrations } = await import(
  pathToFileURL(join(distPath, "storage/index.js")).href
);

const { NotFoundError, InvalidStateError } = await import(
  pathToFileURL(join(distPath, "errors.js")).href
);

describe("T04: Codeit Conversations and Run Lifecycle", () => {
  const testBaseDir = join(tmpdir(), `codeit-run-lifecycle-test-${Date.now()}`);
  const dbPath = join(testBaseDir, "codeit.db");

  let dbInstance = null;
  let db = null;
  let conversationModule = null;
  let runModule = null;
  let providerService = null;
  let mockProvider = null;

  const projectUuid = "00000001";
  const now = new Date().toISOString();

  before(() => {
    mkdirSync(testBaseDir, { recursive: true });

    dbInstance = new CodeitDatabase({ dbPath });
    db = dbInstance.db;
    runMigrations(db);

    // Seed test project into codeit_projects
    db.prepare(
      `
      INSERT INTO codeit_projects (uuid, name, root_path, trust_state, policy_revision, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      projectUuid,
      "Run Lifecycle Fixture Project",
      resolve(testBaseDir, "fixture-project"),
      "trusted",
      "1.0.0",
      now,
      now
    );

    // Setup MockProvider & ProviderService
    mockProvider = new MockProvider();
    providerService = new ProviderService([mockProvider]);

    conversationModule = new ConversationModule(db);
    runModule = new RunModule(db, providerService);
  });

  after(() => {
    if (dbInstance) {
      dbInstance.close();
    }
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe("1. Conversation Management & Message Idempotency", () => {
    let createdConv = null;

    test("creates conversation with selected mode and valid 8-hex UUID", () => {
      createdConv = conversationModule.service.createConversation({
        project_uuid: projectUuid,
        title: "Test Conversation 1",
        mode: "plan"
      });

      assert.equal(createdConv.title, "Test Conversation 1");
      assert.equal(createdConv.selected_mode, "plan");
      assert.equal(createdConv.project_uuid, projectUuid);
      assert.match(createdConv.uuid, /^[0-9a-f]{8}$/);
      assert.equal(createdConv.archived, false);
    });

    test("lists conversations for a project", () => {
      const convList = conversationModule.service.listConversationsByProject(projectUuid);
      assert.ok(convList.length >= 1);
      const found = convList.find((c) => c.uuid === createdConv.uuid);
      assert.ok(found);
      assert.equal(found.title, "Test Conversation 1");
    });

    test("rejects conversation creation for non-existent project with CODEIT_NOT_FOUND", () => {
      assert.throws(
        () => {
          conversationModule.service.createConversation({
            project_uuid: "deadbeef",
            title: "Orphan Conversation"
          });
        },
        (err) => {
          assert.ok(err instanceof NotFoundError);
          assert.equal(err.code, "CODEIT_NOT_FOUND");
          return true;
        }
      );
    });

    test("appends message with request_key deduplication (idempotency)", () => {
      const requestKey = "req-unique-key-101";

      // 1. First append
      const msg1 = conversationModule.service.appendMessage(createdConv.uuid, {
        role: "user",
        content: "First attempt message",
        request_key: requestKey
      });

      assert.match(msg1.uuid, /^[0-9a-f]{8}$/);
      assert.equal(msg1.content, "First attempt message");
      assert.equal(msg1.request_key, requestKey);
      assert.equal(msg1.completion_state, "final");

      // 2. Second append with SAME request_key and SAME conversation
      const msg2 = conversationModule.service.appendMessage(createdConv.uuid, {
        role: "user",
        content: "Different content attempting collision",
        request_key: requestKey
      });

      // Must return identical existing message without duplicate row
      assert.equal(msg2.id, msg1.id);
      assert.equal(msg2.uuid, msg1.uuid);
      assert.equal(msg2.content, "First attempt message"); // Content preserved from first write

      // 3. Confirm only one message in database
      const messages = conversationModule.service.listMessages(createdConv.uuid);
      assert.equal(messages.items.length, 1);
    });

    test("appends message without request_key creates distinct messages", () => {
      const msgA = conversationModule.service.appendMessage(createdConv.uuid, {
        role: "user",
        content: "Message without idempotency key A"
      });

      const msgB = conversationModule.service.appendMessage(createdConv.uuid, {
        role: "user",
        content: "Message without idempotency key B"
      });

      assert.notEqual(msgA.uuid, msgB.uuid);
      assert.notEqual(msgA.id, msgB.id);

      const messages = conversationModule.service.listMessages(createdConv.uuid);
      assert.equal(messages.items.length, 3);
    });

    test("supports cursor-based pagination for messages", () => {
      const resultPage1 = conversationModule.service.listMessages(createdConv.uuid, { limit: 2 });
      assert.equal(resultPage1.items.length, 2);
      assert.ok(resultPage1.next_cursor);

      const resultPage2 = conversationModule.service.listMessages(createdConv.uuid, {
        limit: 2,
        cursor: resultPage1.next_cursor
      });
      assert.equal(resultPage2.items.length, 1);
      assert.equal(resultPage2.next_cursor, null);
    });
  });

  describe("2. Run State Machine Transitions & Invariants", () => {
    let conv = null;

    before(() => {
      conv = conversationModule.service.createConversation({
        project_uuid: projectUuid,
        title: "State Machine Test Conv",
        mode: "plan"
      });
    });

    test("creates run in queued state with initial run.created event (seq: 1)", () => {
      const run = runModule.service.createRun({
        conversation_uuid: conv.uuid,
        mode: "plan"
      });

      assert.match(run.uuid, /^[0-9a-f]{8}$/);
      assert.equal(run.state, "queued");
      assert.equal(run.cancellation_generation, 0);
      assert.equal(run.budget.max_duration_seconds, 600);

      // Verify initial event
      const events = runModule.service.getEventsSince(run.uuid, 0);
      assert.equal(events.length, 1);
      assert.equal(events[0].seq, 1);
      assert.equal(events[0].event_type, "run.created");
    });

    test("enforces valid transitions: queued -> planning -> running -> verifying -> succeeded", () => {
      const run = runModule.service.createRun({
        conversation_uuid: conv.uuid,
        mode: "work"
      });

      // 1. queued -> planning
      const t1 = runModule.service.transitionState(run.uuid, "planning", {
        reason: "capacity allocated"
      });
      assert.equal(t1.run.state, "planning");
      assert.equal(t1.event.seq, 2);
      assert.equal(t1.event.event_type, "state_changed");
      assert.equal(t1.event.payload.to_state, "planning");

      // 2. planning -> running
      const t2 = runModule.service.transitionState(run.uuid, "running", {
        reason: "tasks dispatched"
      });
      assert.equal(t2.run.state, "running");
      assert.equal(t2.event.seq, 3);
      assert.equal(t2.event.payload.to_state, "running");

      // 3. running -> verifying
      const t3 = runModule.service.transitionState(run.uuid, "verifying", {
        reason: "worker handoff"
      });
      assert.equal(t3.run.state, "verifying");
      assert.equal(t3.event.seq, 4);

      // 4. verifying -> succeeded
      const t4 = runModule.service.transitionState(run.uuid, "succeeded", {
        reason: "checks verified"
      });
      assert.equal(t4.run.state, "succeeded");
      assert.equal(t4.event.seq, 5);

      // Re-query from DB to verify persistence
      const freshRun = runModule.service.getRunByUuid(run.uuid);
      assert.equal(freshRun.state, "succeeded");
    });

    test("enforces pause and resume flow through queued state (Invariant 4)", () => {
      const run = runModule.service.createRun({
        conversation_uuid: conv.uuid,
        mode: "work"
      });

      // Move to running
      runModule.service.transitionState(run.uuid, "running");

      // Pause run
      const pauseRes = runModule.service.pauseRun(run.uuid, "Operator pause");
      assert.equal(pauseRes.paused, true);
      assert.equal(runModule.service.getRunByUuid(run.uuid).state, "paused");

      // Invariant: cannot jump directly from paused to running
      assert.throws(
        () => {
          runModule.service.transitionState(run.uuid, "running");
        },
        (err) => {
          assert.ok(err instanceof InvalidStateError);
          assert.equal(err.code, "CODEIT_INVALID_STATE");
          assert.equal(err.statusCode, 409);
          return true;
        }
      );

      // Must resume through queued
      const resumeRes = runModule.service.resumeRun(run.uuid);
      assert.equal(resumeRes.resumed, true);
      assert.equal(runModule.service.getRunByUuid(run.uuid).state, "queued");

      // Now it can transition to running
      const resumedRunning = runModule.service.transitionState(run.uuid, "running");
      assert.equal(resumedRunning.run.state, "running");
    });

    test("rejects invalid state transitions with 409 CODEIT_INVALID_STATE", () => {
      const run = runModule.service.createRun({
        conversation_uuid: conv.uuid,
        mode: "plan"
      });

      // Cannot jump straight from queued to succeeded
      assert.throws(
        () => {
          runModule.service.transitionState(run.uuid, "succeeded");
        },
        (err) => {
          assert.ok(err instanceof InvalidStateError);
          assert.equal(err.code, "CODEIT_INVALID_STATE");
          assert.equal(err.statusCode, 409);
          return true;
        }
      );

      // Move to planning
      runModule.service.transitionState(run.uuid, "planning");

      // Cannot jump from planning to succeeded
      assert.throws(
        () => {
          runModule.service.transitionState(run.uuid, "succeeded");
        },
        (err) => {
          assert.ok(err instanceof InvalidStateError);
          assert.equal(err.code, "CODEIT_INVALID_STATE");
          assert.equal(err.statusCode, 409);
          return true;
        }
      );
    });

    test("terminal states cannot transition to any other state (Invariant 1)", () => {
      for (const terminal of ["succeeded", "failed", "cancelled"]) {
        const run = runModule.service.createRun({
          conversation_uuid: conv.uuid,
          mode: "plan"
        });

        // Reach terminal state
        if (terminal === "succeeded") {
          runModule.service.transitionState(run.uuid, "running");
          runModule.service.transitionState(run.uuid, "succeeded");
        } else if (terminal === "failed") {
          runModule.service.transitionState(run.uuid, "failed");
        } else if (terminal === "cancelled") {
          runModule.service.cancelRun(run.uuid);
        }

        assert.equal(runModule.service.getRunByUuid(run.uuid).state, terminal);

        // Attempting to transition out of terminal state must fail with 409
        for (const target of ["queued", "planning", "running", "succeeded"]) {
          if (target === terminal) continue;
          assert.throws(
            () => {
              runModule.service.transitionState(run.uuid, target);
            },
            (err) => {
              assert.ok(err instanceof InvalidStateError);
              assert.equal(err.code, "CODEIT_INVALID_STATE");
              assert.equal(err.statusCode, 409);
              return true;
            }
          );
        }
      }
    });
  });

  describe("3. Cancellation & Generation Fencing", () => {
    let conv = null;

    before(() => {
      conv = conversationModule.service.createConversation({
        project_uuid: projectUuid,
        title: "Cancellation Test Conv",
        mode: "work"
      });
    });

    test("increments cancellation_generation and transitions to cancelled", () => {
      const run = runModule.service.createRun({
        conversation_uuid: conv.uuid,
        mode: "work"
      });

      assert.equal(run.cancellation_generation, 0);

      const cancelRes = runModule.service.cancelRun(run.uuid, "Manual cancel test");
      assert.equal(cancelRes.cancelled, true);
      assert.equal(cancelRes.generation, 1);

      const cancelledRun = runModule.service.getRunByUuid(run.uuid);
      assert.equal(cancelledRun.state, "cancelled");
      assert.equal(cancelledRun.cancellation_generation, 1);

      // Verify run.cancelled event emitted
      const events = runModule.service.getEventsSince(run.uuid, 0);
      const cancelEvent = events.find((e) => e.event_type === "run.cancelled");
      assert.ok(cancelEvent);
      assert.equal(cancelEvent.payload.cancellation_generation, 1);
    });

    test("fences future events using cancellation generation", () => {
      const run = runModule.service.createRun({
        conversation_uuid: conv.uuid,
        mode: "work"
      });

      runModule.service.transitionState(run.uuid, "running");

      // Stale worker was leased at generation 0
      const leasedGen = 0;

      // Cancel run -> moves to generation 1
      runModule.service.cancelRun(run.uuid);

      // Stale worker tries to emit an event using generation 0
      assert.throws(
        () => {
          runModule.service.recordEvent(
            run.uuid,
            "text_delta",
            { delta: "Stale data after cancel" },
            { generation: leasedGen }
          );
        },
        (err) => {
          assert.ok(err instanceof InvalidStateError);
          assert.equal(err.code, "CODEIT_INVALID_STATE");
          assert.equal(err.statusCode, 409);
          assert.match(err.message, /generation fence/);
          return true;
        }
      );
    });

    test("cannot cancel run already in terminal state", () => {
      const run = runModule.service.createRun({
        conversation_uuid: conv.uuid,
        mode: "plan"
      });

      runModule.service.transitionState(run.uuid, "failed");

      assert.throws(
        () => {
          runModule.service.cancelRun(run.uuid);
        },
        (err) => {
          assert.ok(err instanceof InvalidStateError);
          assert.equal(err.code, "CODEIT_INVALID_STATE");
          return true;
        }
      );
    });
  });

  describe("4. SSE Streaming & Cursor Replay without Duplication", () => {
    let conv = null;

    before(() => {
      conv = conversationModule.service.createConversation({
        project_uuid: projectUuid,
        title: "SSE Replay Test Conv",
        mode: "ask"
      });
    });

    test("replays events monotonically from sequence cursor without side effect duplication", () => {
      const run = runModule.service.createRun({
        conversation_uuid: conv.uuid,
        mode: "ask"
      });

      // Record several sequential events
      runModule.service.recordEvent(run.uuid, "step.one", { step: 1 });
      runModule.service.recordEvent(run.uuid, "step.two", { step: 2 });
      runModule.service.recordEvent(run.uuid, "step.three", { step: 3 });
      runModule.service.recordEvent(run.uuid, "step.four", { step: 4 });

      // All events: seq 1 (run.created), seq 2 (step.one), seq 3 (step.two), seq 4 (step.three), seq 5 (step.four)
      const allEvents = runModule.service.getEventsSince(run.uuid, 0);
      assert.equal(allEvents.length, 5);
      assert.deepEqual(
        allEvents.map((e) => e.seq),
        [1, 2, 3, 4, 5]
      );

      // Cursor replay from seq 3 (e.g. client Last-Event-ID: 3)
      const replayed = runModule.service.getEventsSince(run.uuid, 3);
      assert.equal(replayed.length, 2);
      assert.equal(replayed[0].seq, 4);
      assert.equal(replayed[0].event_type, "step.three");
      assert.equal(replayed[1].seq, 5);
      assert.equal(replayed[1].event_type, "step.four");

      // Verify no duplicate records created during cursor reads
      const recheckEvents = runModule.service.getEventsSince(run.uuid, 0);
      assert.equal(recheckEvents.length, 5);
    });

    test("delivers live events to subscribers in real-time", async () => {
      const run = runModule.service.createRun({
        conversation_uuid: conv.uuid,
        mode: "ask"
      });

      const received = [];
      const unsubscribe = runModule.service.subscribeToRunEvents(run.uuid, (event) => {
        received.push(event);
      });

      runModule.service.recordEvent(run.uuid, "live.alpha", { message: "hello alpha" });
      runModule.service.recordEvent(run.uuid, "live.beta", { message: "hello beta" });

      unsubscribe();

      // Events after unsubscribe must not be received
      runModule.service.recordEvent(run.uuid, "live.gamma", { message: "hello gamma" });

      assert.equal(received.length, 2);
      assert.equal(received[0].event_type, "live.alpha");
      assert.equal(received[1].event_type, "live.beta");
    });
  });

  describe("5. Provider Integration & Streamed Execution", () => {
    let conv = null;

    before(() => {
      conv = conversationModule.service.createConversation({
        project_uuid: projectUuid,
        title: "Provider Execution Conv",
        mode: "ask"
      });

      conversationModule.service.appendMessage(conv.uuid, {
        role: "user",
        content: "What is Codeit?"
      });
    });

    test("streams assistant text, records RunEvents, and saves final assistant message", async () => {
      const run = runModule.service.createRun({
        conversation_uuid: conv.uuid,
        mode: "ask"
      });

      const finishedRun = await runModule.service.executeRun(run.uuid, { providerService });
      assert.equal(finishedRun.state, "succeeded");

      // 1. Check RunEvents for text deltas and completion
      const events = runModule.service.getEventsSince(run.uuid, 0);
      const textDeltas = events.filter((e) => e.event_type === "text_delta");
      assert.ok(textDeltas.length >= 1, "Expected text_delta events");

      const messageCompleted = events.find((e) => e.event_type === "message_completed");
      assert.ok(messageCompleted, "Expected message_completed event");

      // 2. Check that assistant message was appended to conversation
      const convMsgs = conversationModule.service.listMessages(conv.uuid);
      const assistantMsg = convMsgs.items.find((m) => m.role === "assistant");
      assert.ok(assistantMsg, "Expected assistant message to be persisted in conversation");
      assert.equal(assistantMsg.completion_state, "final");
      assert.ok(assistantMsg.content.length > 0);
    });
  });

  describe("6. Data Persistence Across DB Reopen & Reload", () => {
    let convUuid = "";
    let runUuid = "";

    before(() => {
      const conv = conversationModule.service.createConversation({
        project_uuid: projectUuid,
        title: "Persistence Verification Conv",
        mode: "work"
      });
      convUuid = conv.uuid;

      conversationModule.service.appendMessage(convUuid, {
        role: "user",
        content: "Persistent user message",
        request_key: "persist-key-999"
      });

      const run = runModule.service.createRun({
        conversation_uuid: convUuid,
        mode: "work"
      });
      runUuid = run.uuid;

      runModule.service.transitionState(runUuid, "planning");
      runModule.service.recordEvent(runUuid, "checkpoint", { step: 10 });
    });

    test("retains all conversations, messages, runs, and events across database reload", () => {
      // 1. Close active database
      dbInstance.close();

      // 2. Re-open database from file
      const reopenedDbInstance = new CodeitDatabase({ dbPath });
      const reopenedDb = reopenedDbInstance.db;

      // 3. Re-run migrations idempotently
      runMigrations(reopenedDb);

      const reloadedConvModule = new ConversationModule(reopenedDb);
      const reloadedRunModule = new RunModule(reopenedDb, providerService);

      // 4. Verify conversation preserved
      const conv = reloadedConvModule.service.getConversationByUuid(convUuid);
      assert.equal(conv.uuid, convUuid);
      assert.equal(conv.title, "Persistence Verification Conv");

      // 5. Verify message preserved
      const msgs = reloadedConvModule.service.listMessages(convUuid);
      assert.equal(msgs.items.length, 1);
      assert.equal(msgs.items[0].content, "Persistent user message");
      assert.equal(msgs.items[0].request_key, "persist-key-999");

      // 6. Verify run state and events preserved
      const run = reloadedRunModule.service.getRunByUuid(runUuid);
      assert.equal(run.uuid, runUuid);
      assert.equal(run.state, "planning");

      const events = reloadedRunModule.service.getEventsSince(runUuid, 0);
      assert.equal(events.length, 3); // run.created, state_changed, checkpoint
      assert.equal(events[2].event_type, "checkpoint");
      assert.deepEqual(events[2].payload, { step: 10 });

      reopenedDbInstance.close();

      // Re-establish original db connection for subsequent tests
      dbInstance = new CodeitDatabase({ dbPath });
      db = dbInstance.db;
      conversationModule = new ConversationModule(db);
      runModule = new RunModule(db, providerService);
    });
  });

  describe("7. HTTP Route Handlers & Server Integration", () => {
    let testServer = null;
    let serverPort = 18090;
    let convUuid = "";
    let runUuid = "";

    before(async () => {
      const conv = conversationModule.service.createConversation({
        project_uuid: projectUuid,
        title: "HTTP Route Handlers Conv",
        mode: "ask"
      });
      convUuid = conv.uuid;

      // Combine routes into a local HTTP test server
      const allRoutes = [...conversationModule.routes, ...runModule.routes];

      testServer = createServer(async (req, res) => {
        const url = new URL(req.url, `http://127.0.0.1:${serverPort}`);
        const pathname = url.pathname;
        const method = req.method;

        // Match route
        for (const route of allRoutes) {
          if (route.method.toUpperCase() !== method.toUpperCase()) continue;

          const rParts = route.path.split("/").filter(Boolean);
          const qParts = pathname.split("/").filter(Boolean);
          if (rParts.length !== qParts.length) continue;

          const params = {};
          let matched = true;
          for (let i = 0; i < rParts.length; i++) {
            if (rParts[i].startsWith(":")) {
              params[rParts[i].slice(1)] = qParts[i];
            } else if (rParts[i] !== qParts[i]) {
              matched = false;
              break;
            }
          }

          if (matched) {
            // Read JSON body if applicable
            let body = null;
            if (["POST", "PUT"].includes(method)) {
              const chunks = [];
              for await (const chunk of req) chunks.push(chunk);
              const raw = Buffer.concat(chunks).toString("utf8");
              if (raw) {
                try {
                  body = JSON.parse(raw);
                } catch {
                  body = {};
                }
              }
            }

            try {
              const result = await route.handler(req, res, {
                params,
                query: url.searchParams,
                body,
                correlationId: "c0de17-test-run"
              });

              if (res.writableEnded) return;

              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  success: true,
                  data: result,
                  error: null,
                  correlation_id: "c0de17-test-run"
                })
              );
              return;
            } catch (err) {
              const statusCode = err.statusCode || 500;
              res.statusCode = statusCode;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  success: false,
                  data: null,
                  error: {
                    code: err.code || "INTERNAL_ERROR",
                    message: err.message
                  },
                  correlation_id: "c0de17-test-run"
                })
              );
              return;
            }
          }
        }

        res.statusCode = 404;
        res.end(JSON.stringify({ success: false, error: { code: "CODEIT_NOT_FOUND" } }));
      });

      await new Promise((resolve) => {
        testServer.listen(0, "127.0.0.1", () => {
          serverPort = testServer.address().port;
          resolve();
        });
      });
    });

    after(async () => {
      if (testServer) {
        await new Promise((resolve) => testServer.close(resolve));
      }
    });

    test("GET /api/codeit/conversations lists conversations", async () => {
      const res = await fetch(
        `http://127.0.0.1:${serverPort}/api/codeit/conversations?project_uuid=${projectUuid}`
      );
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.items.length >= 1);
    });

    test("POST /api/codeit/conversations/:uuid/messages appends message", async () => {
      const res = await fetch(
        `http://127.0.0.1:${serverPort}/api/codeit/conversations/${convUuid}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "user",
            content: "HTTP appended message",
            request_key: "http-req-001"
          })
        }
      );

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.content, "HTTP appended message");
      assert.equal(json.data.request_key, "http-req-001");
    });

    test("POST /api/codeit/runs creates and triggers a run", async () => {
      const res = await fetch(`http://127.0.0.1:${serverPort}/api/codeit/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_uuid: convUuid,
          mode: "ask",
          auto_execute: false
        })
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.match(json.data.uuid, /^[0-9a-f]{8}$/);
      assert.equal(json.data.state, "queued");
      runUuid = json.data.uuid;
    });

    test("GET /api/codeit/runs/:uuid retrieves run state", async () => {
      const res = await fetch(`http://127.0.0.1:${serverPort}/api/codeit/runs/${runUuid}`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.uuid, runUuid);
      assert.equal(json.data.mode, "ask");
    });

    test("POST /api/codeit/runs/:uuid/cancel cancels run", async () => {
      const res = await fetch(`http://127.0.0.1:${serverPort}/api/codeit/runs/${runUuid}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "HTTP Cancel Test" })
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.cancelled, true);

      // Verify state is cancelled
      const getRes = await fetch(`http://127.0.0.1:${serverPort}/api/codeit/runs/${runUuid}`);
      const getJson = await getRes.json();
      assert.equal(getJson.data.state, "cancelled");
      assert.equal(getJson.data.cancellation_generation, 1);
    });

    test("GET /api/codeit/runs/:uuid/events streams SSE events with Last-Event-ID replay", async () => {
      // Replay events from Last-Event-ID: 1
      const res = await fetch(`http://127.0.0.1:${serverPort}/api/codeit/runs/${runUuid}/events`, {
        headers: { "Last-Event-ID": "1" }
      });

      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type"), /text\/event-stream/);

      const text = await res.text();
      assert.match(text, /id: \d+/);
      assert.match(text, /event: run\.cancelled/);
    });
  });
});
