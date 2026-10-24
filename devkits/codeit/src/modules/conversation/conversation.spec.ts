/**
 * Codeit Conversation Module Unit & Contract Tests
 * Covers E24, E04, E06, and E22 UI portions.
 * Retains mock fixtures ONLY in unit tests (finding A2).
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  ComposerInputSchema,
  ConversationSchema,
  CreateConversationSchema,
  HexUuidSchema,
  MessageSchema,
  RunSchema,
  ToolInvocationSchema,
  ArtifactSchema,
  ApprovalSchema,
  RunEventSchema
} from "./conversation.schema";
import {
  formatByteSize,
  formatCodeitDate,
  formatCodeitDateTime,
  type Conversation,
  type Message,
  type Run,
  type Artifact,
  type Approval,
  type RunEvent
} from "./conversation.types";
import { ConversationService } from "./conversation.services";

// -------------------------------------------------------------
// Mock Fixtures Retained STRICTLY for Unit Testing
// -------------------------------------------------------------
const FIXTURE_PROJECT_UUID = "c0de1700";

const FIXTURE_CONVERSATIONS: Conversation[] = [
  {
    id: 1,
    uuid: "c0de0001",
    project_uuid: FIXTURE_PROJECT_UUID,
    title: "T01 Work Shell & Chat UI",
    selected_mode: "work",
    archived: false,
    created_at: "2026-10-24T05:00:00.000Z",
    updated_at: "2026-10-24T05:15:00.000Z"
  },
  {
    id: 2,
    uuid: "c0de0002",
    project_uuid: FIXTURE_PROJECT_UUID,
    title: "Architecture & Policy Review",
    selected_mode: "review",
    archived: false,
    created_at: "2026-10-24T04:30:00.000Z",
    updated_at: "2026-10-24T04:45:00.000Z"
  },
  {
    id: 3,
    uuid: "c0de0003",
    project_uuid: FIXTURE_PROJECT_UUID,
    title: "Database Migration Plan",
    selected_mode: "plan",
    archived: false,
    created_at: "2026-10-24T03:00:00.000Z",
    updated_at: "2026-10-24T03:20:00.000Z"
  }
];

const FIXTURE_ARTIFACTS: Record<string, Artifact> = {
  a0000001: {
    id: 1,
    uuid: "a0000001",
    run_uuid: "f0000001",
    artifact_type: "plan",
    content_hash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    relative_storage_key: "artifacts/T01-execution-plan.md",
    byte_size: 1420,
    media_type: "text/markdown",
    provenance: {
      creator: "codeit-supervisor",
      task_id: "T01",
      revision: "1.0.0-frozen",
      summary: "Work shell and chat UI implementation plan"
    },
    content: "# T01 Work Shell & Chat UI Plan\n\nVerified plan content.",
    created_at: "2026-10-24T05:05:00.000Z",
    updated_at: "2026-10-24T05:05:00.000Z"
  }
};

const FIXTURE_MESSAGES: Record<string, Message[]> = {
  c0de0001: [
    {
      id: 1,
      uuid: "b0000001",
      conversation_uuid: "c0de0001",
      role: "user",
      content: "Implement T01: Work shell and chat UI per tasks/T01-WORK-SHELL.md.",
      request_key: "req_init_001",
      completion_state: "final",
      context_references: [
        {
          path: "devkits/codeit/agent/tasks/T01-WORK-SHELL.md",
          type: "file"
        }
      ],
      created_at: "2026-10-24T05:01:00.000Z",
      updated_at: "2026-10-24T05:01:00.000Z"
    },
    {
      id: 2,
      uuid: "b0000002",
      conversation_uuid: "c0de0001",
      role: "assistant",
      content: "I have reviewed T01 specifications and am preparing the execution plan.",
      request_key: "req_init_001",
      completion_state: "final",
      artifacts: [FIXTURE_ARTIFACTS.a0000001!],
      created_at: "2026-10-24T05:03:00.000Z",
      updated_at: "2026-10-24T05:05:00.000Z"
    }
  ]
};

let fixtureActiveRun: Run = {
  id: 1,
  uuid: "f0000001",
  project_uuid: FIXTURE_PROJECT_UUID,
  conversation_uuid: "c0de0001",
  mode: "work",
  state: "running",
  cancellation_generation: 0,
  budget: {
    max_duration_seconds: 300,
    max_output_bytes: 5242880,
    max_tool_invocations: 50,
    max_repair_attempts: 3,
    consumed_duration_seconds: 45,
    consumed_output_bytes: 184320,
    consumed_tool_invocations: 4
  },
  created_at: "2026-10-24T05:01:30.000Z",
  updated_at: "2026-10-24T05:15:00.000Z"
};

describe("T01: Codeit Conversation Unit & Contract Tests", () => {
  describe("1. Contract Schemas & Invariants (CONTRACTS.md frozen)", () => {
    test("validates 8-character lowercase hex UUIDs", () => {
      assert.equal(HexUuidSchema.parse("c0de1700"), "c0de1700");
      assert.equal(HexUuidSchema.parse("1234abcd"), "1234abcd");
      assert.throws(() => HexUuidSchema.parse("UPPER123"));
      assert.throws(() => HexUuidSchema.parse("short"));
      assert.throws(() => HexUuidSchema.parse("toolong12345"));
      assert.throws(() => HexUuidSchema.parse("not-hex!"));
    });

    test("validates Conversation record schema", () => {
      const now = new Date().toISOString();
      const valid = {
        uuid: "c0de0001",
        project_uuid: "c0de1700",
        title: "T01 Work Shell",
        selected_mode: "work" as const,
        archived: false,
        created_at: now,
        updated_at: now
      };
      assert.deepEqual(ConversationSchema.parse(valid), valid);
    });

    test("rejects conversation with invalid mode", () => {
      const now = new Date().toISOString();
      assert.throws(() =>
        ConversationSchema.parse({
          uuid: "c0de0001",
          project_uuid: "c0de1700",
          title: "Invalid mode",
          selected_mode: "destroy",
          archived: false,
          created_at: now,
          updated_at: now
        })
      );
    });

    test("validates Message schema with tool invocations and artifacts", () => {
      const now = new Date().toISOString();
      const valid = {
        uuid: "b0000001",
        conversation_uuid: "c0de0001",
        role: "assistant" as const,
        content: "Execution verified",
        request_key: "req_test_01",
        completion_state: "final" as const,
        tool_invocations: [
          {
            uuid: "d0000001",
            run_uuid: "f0000001",
            tool_name: "test_runner",
            tool_version: "1.0.0",
            arguments_hash: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            arguments_payload: { cmd: "npm test" },
            state: "completed" as const,
            execution_time_ms: 120,
            created_at: now,
            updated_at: now
          }
        ],
        artifacts: [
          {
            uuid: "a0000001",
            run_uuid: "f0000001",
            artifact_type: "plan" as const,
            content_hash: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            relative_storage_key: "artifacts/plan.md",
            byte_size: 512,
            media_type: "text/markdown",
            provenance: { creator: "planner", task_id: "T01" },
            content: "# Plan",
            created_at: now,
            updated_at: now
          }
        ],
        created_at: now,
        updated_at: now
      };

      assert.deepEqual(MessageSchema.parse(valid), valid);
    });

    test("validates Run state machine states", () => {
      const now = new Date().toISOString();
      const validRun = {
        uuid: "f0000001",
        project_uuid: "c0de1700",
        conversation_uuid: "c0de0001",
        mode: "work" as const,
        state: "running" as const,
        cancellation_generation: 0,
        budget: {
          max_duration_seconds: 300,
          max_output_bytes: 1048576,
          max_tool_invocations: 20,
          max_repair_attempts: 2
        },
        created_at: now,
        updated_at: now
      };
      assert.deepEqual(RunSchema.parse(validRun), validRun);
    });

    test("validates ToolInvocation schema and rejects invalid hash", () => {
      const now = new Date().toISOString();
      assert.throws(() =>
        ToolInvocationSchema.parse({
          uuid: "d0000001",
          run_uuid: "f0000001",
          tool_name: "patcher",
          tool_version: "1.0",
          arguments_hash: "invalid-short-hash",
          arguments_payload: {},
          state: "running",
          created_at: now,
          updated_at: now
        })
      );
    });

    test("validates Artifact schema", () => {
      const now = new Date().toISOString();
      const valid = {
        uuid: "a0000001",
        run_uuid: "f0000001",
        artifact_type: "diff" as const,
        content_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        relative_storage_key: "diffs/patch.diff",
        byte_size: 1024,
        media_type: "text/x-diff",
        provenance: { summary: "Unit diff" },
        created_at: now,
        updated_at: now
      };
      assert.deepEqual(ArtifactSchema.parse(valid), valid);
    });

    test("validates Approval schema", () => {
      const now = new Date().toISOString();
      const valid = {
        uuid: "e0000001",
        action_digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        project_uuid: "c0de1700",
        run_uuid: "f0000001",
        expiry: now,
        actor: "developer",
        decision: "approved" as const,
        constraints: { scope: "read" },
        created_at: now,
        updated_at: now
      };
      assert.deepEqual(ApprovalSchema.parse(valid), valid);
    });

    test("validates RunEvent schema", () => {
      const now = new Date().toISOString();
      const validEvent = {
        run_uuid: "f0000001",
        seq: 1,
        event_type: "text_delta",
        payload: { delta: "Hello world" },
        correlation_id: "c0de17-123",
        created_at: now
      };
      assert.deepEqual(RunEventSchema.parse(validEvent), validEvent);
    });
  });

  describe("2. Composer Input Validation & Strictness", () => {
    test("validates valid composer input with context references", () => {
      const input = {
        content: "Please inspect the contracts file",
        mode: "ask" as const,
        contextReferences: [
          {
            path: "devkits/codeit/agent/CONTRACTS.md",
            type: "file" as const
          }
        ]
      };
      assert.deepEqual(ComposerInputSchema.parse(input), input);
    });

    test("rejects empty or whitespace-only composer content", () => {
      assert.throws(() =>
        ComposerInputSchema.parse({
          content: "   ",
          mode: "ask",
          contextReferences: []
        })
      );
    });

    test("rejects unrelated properties on create conversation", () => {
      assert.throws(() =>
        CreateConversationSchema.parse({
          project_uuid: "c0de1700",
          title: "New chat",
          mode: "work",
          extra_unallowed_field: true
        })
      );
    });
  });

  describe("3. Date & Byte Formatting per UI-WORKFLOWS.md", () => {
    test("formats date strictly as DD-MM-YYYY", () => {
      const date = new Date(2026, 9, 24, 15, 30); // 24 Oct 2026
      assert.equal(formatCodeitDate(date), "24-10-2026");
    });

    test("formats date-time strictly as DD-MM-YYYY HH:mm", () => {
      const date = new Date(2026, 9, 24, 9, 5); // 24 Oct 2026 09:05
      assert.equal(formatCodeitDateTime(date), "24-10-2026 09:05");
    });

    test("formats byte sizes properly", () => {
      assert.equal(formatByteSize(500), "500 B");
      assert.equal(formatByteSize(2048), "2.0 KB");
      assert.equal(formatByteSize(5242880), "5.0 MB");
    });
  });

  describe("4. Conversation Service Backend HTTP & SSE Operations (Real Wire)", () => {
    const originalFetch = globalThis.fetch;
    const service = new ConversationService();

    before(() => {
      // Setup mocked fetch implementing real API envelope contracts
      globalThis.fetch = async (
        input: RequestInfo | URL,
        init?: RequestInit
      ): Promise<Response> => {
        const urlStr =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method?.toUpperCase() ?? "GET";

        // Simulated error test route
        if (urlStr.includes("force-unauthorized")) {
          return new Response(
            JSON.stringify({
              success: false,
              data: null,
              error: {
                code: "CODEIT_UNAUTHORIZED",
                message: "Authentication session expired or pairing required",
                retryable: false
              },
              correlation_id: "c0de17-test-err"
            }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }

        // List or filter conversations
        if (
          urlStr.includes("/api/codeit/conversations") &&
          !urlStr.includes("/messages") &&
          method === "GET"
        ) {
          return new Response(
            JSON.stringify({
              success: true,
              data: { items: FIXTURE_CONVERSATIONS },
              error: null,
              correlation_id: "c0de17-test-01"
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // Create conversation
        if (urlStr.endsWith("/api/codeit/conversations") && method === "POST") {
          const body = JSON.parse((init?.body as string) || "{}");
          const created: Conversation = {
            id: 10,
            uuid: "c0de9999",
            project_uuid: body.project_uuid,
            title: body.title,
            selected_mode: body.mode,
            archived: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          return new Response(
            JSON.stringify({
              success: true,
              data: created,
              error: null,
              correlation_id: "c0de17-test-02"
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // List messages
        if (urlStr.includes("/messages") && method === "GET") {
          return new Response(
            JSON.stringify({
              success: true,
              data: { items: FIXTURE_MESSAGES.c0de0001 },
              error: null,
              correlation_id: "c0de17-test-03"
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // Append message
        if (urlStr.includes("/messages") && method === "POST") {
          const body = JSON.parse((init?.body as string) || "{}");
          const newMsg: Message = {
            id: 99,
            uuid: "b0000099",
            conversation_uuid: "c0de0001",
            role: body.role,
            content: body.content,
            request_key: body.request_key,
            completion_state: "final",
            context_references: body.context_references,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          return new Response(
            JSON.stringify({
              success: true,
              data: newMsg,
              error: null,
              correlation_id: "c0de17-test-04"
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // Create run
        if (urlStr.endsWith("/api/codeit/runs") && method === "POST") {
          const body = JSON.parse((init?.body as string) || "{}");
          const createdRun: Run = {
            id: 2,
            uuid: "f0000002",
            project_uuid: body.project_uuid ?? FIXTURE_PROJECT_UUID,
            conversation_uuid: body.conversation_uuid,
            mode: body.mode ?? "work",
            state: "queued",
            cancellation_generation: 0,
            budget: {
              max_duration_seconds: 300,
              max_output_bytes: 5242880,
              max_tool_invocations: 50,
              max_repair_attempts: 3
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          return new Response(
            JSON.stringify({
              success: true,
              data: createdRun,
              error: null,
              correlation_id: "c0de17-test-05"
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // Get run
        if (
          urlStr.includes("/api/codeit/runs/") &&
          !urlStr.includes("/cancel") &&
          !urlStr.includes("/events") &&
          method === "GET"
        ) {
          return new Response(
            JSON.stringify({
              success: true,
              data: fixtureActiveRun,
              error: null,
              correlation_id: "c0de17-test-06"
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // Cancel run
        if (urlStr.includes("/cancel") && method === "POST") {
          fixtureActiveRun = {
            ...fixtureActiveRun,
            state: "cancelled",
            cancellation_generation: fixtureActiveRun.cancellation_generation + 1
          };
          return new Response(
            JSON.stringify({
              success: true,
              data: { cancelled: true, generation: fixtureActiveRun.cancellation_generation },
              error: null,
              correlation_id: "c0de17-test-07"
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // Submit approval
        if (urlStr.endsWith("/api/codeit/tools/approve") && method === "POST") {
          const body = JSON.parse((init?.body as string) || "{}");
          const approval: Approval = {
            id: 99,
            uuid: body.approval_uuid,
            action_digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            project_uuid: FIXTURE_PROJECT_UUID,
            run_uuid: "f0000001",
            expiry: new Date(Date.now() + 3600000).toISOString(),
            actor: "test-operator",
            decision: body.decision,
            constraints: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          return new Response(
            JSON.stringify({
              success: true,
              data: approval,
              error: null,
              correlation_id: "c0de17-test-08"
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // Artifact download
        if (urlStr.includes("/api/codeit/artifacts/") && method === "GET") {
          const art = FIXTURE_ARTIFACTS.a0000001!;
          return new Response(art.content, {
            status: 200,
            headers: {
              "Content-Type": art.media_type,
              "Content-Length": String(art.byte_size),
              "X-Content-Hash": art.content_hash
            }
          });
        }

        // SSE Run Events stream
        if (urlStr.includes("/events") && method === "GET") {
          const sseBody = [
            `id: 1\nevent: run.started\ndata: ${JSON.stringify({ from_state: "queued", to_state: "running" })}\n\n`,
            `id: 2\nevent: text_delta\ndata: ${JSON.stringify({ delta: "Hello from LLM " })}\n\n`,
            `id: 3\nevent: text_delta\ndata: ${JSON.stringify({ delta: "provider stream!" })}\n\n`,
            `id: 4\nevent: run.completed\ndata: ${JSON.stringify({ to_state: "succeeded" })}\n\n`
          ].join("");

          return new Response(sseBody, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" }
          });
        }

        return new Response("Not Found", { status: 404 });
      };
    });

    after(() => {
      globalThis.fetch = originalFetch;
    });

    test("lists conversations over real wire", async () => {
      const convs = await service.listConversations({ project_uuid: FIXTURE_PROJECT_UUID });
      assert.ok(convs.length >= 3);
      assert.equal(convs[0]?.project_uuid, FIXTURE_PROJECT_UUID);
    });

    test("creates conversation on backend", async () => {
      const conv = await service.createConversation({
        project_uuid: FIXTURE_PROJECT_UUID,
        title: "Test New Conversation",
        mode: "ask"
      });
      assert.equal(conv.uuid, "c0de9999");
      assert.equal(conv.title, "Test New Conversation");
    });

    test("retrieves messages for conversation", async () => {
      const msgs = await service.listMessages("c0de0001");
      assert.ok(msgs.length >= 2);
      const userMsg = msgs[0];
      assert.equal(userMsg?.role, "user");
      assert.ok(userMsg?.context_references && userMsg.context_references.length > 0);
    });

    test("appends message to conversation", async () => {
      const newMsg = await service.sendMessage("c0de0001", {
        role: "user",
        content: "Test message from unit test"
      });
      assert.equal(newMsg.content, "Test message from unit test");
      assert.match(newMsg.uuid, /^[0-9a-f]{8}$/);
    });

    test("creates run on backend", async () => {
      const run = await service.createRun({
        conversation_uuid: "c0de0001",
        mode: "work"
      });
      assert.equal(run.uuid, "f0000002");
      assert.equal(run.state, "queued");
    });

    test("submits tool approval and returns updated decision", async () => {
      const approval = await service.submitApproval({
        approval_uuid: "e0000001",
        decision: "approved"
      });
      assert.equal(approval.decision, "approved");
      assert.equal(approval.uuid, "e0000001");
    });

    test("cancels active run cleanly", async () => {
      const result = await service.cancelRun("f0000001");
      assert.equal(result.cancelled, true);
      const run = await service.getRun("f0000001");
      assert.equal(run.state, "cancelled");
    });

    test("retrieves artifact with raw body and parsed metadata", async () => {
      const art = await service.getArtifact("a0000001");
      assert.equal(art.uuid, "a0000001");
      assert.equal(art.media_type, "text/markdown");
      assert.equal(art.artifact_type, "plan");
      assert.ok(art.content?.includes("Verified plan content"));
    });

    test("subscribes to real SSE run event stream and dispatches events", async () => {
      const events: RunEvent[] = [];
      let completed = false;

      await new Promise<void>((resolve) => {
        service.subscribeRunEvents(
          "f0000001",
          (ev) => {
            events.push(ev);
          },
          undefined,
          () => {
            completed = true;
            resolve();
          }
        );
      });

      assert.equal(completed, true);
      assert.equal(events.length, 4);
      assert.equal(events[0]?.event_type, "run.started");
      assert.equal(events[1]?.event_type, "text_delta");
      assert.equal(events[1]?.payload.delta, "Hello from LLM ");
      assert.equal(events[2]?.event_type, "text_delta");
      assert.equal(events[3]?.event_type, "run.completed");
    });

    test("surfaces real backend error and never disguises failure as success", async () => {
      await assert.rejects(
        async () => {
          await service.listConversations({ search: "force-unauthorized" });
        },
        {
          message: "Authentication session expired or pairing required"
        }
      );
    });
  });
});
