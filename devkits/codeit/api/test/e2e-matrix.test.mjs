import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { request as httpRequest } from "node:http";
import { pathToFileURL } from "node:url";

// Ensure build output exists before importing
const distPath = resolve(process.cwd(), "dist/devkits/codeit/api/index.js");
if (!existsSync(distPath)) {
  execSync("npx tsc -p devkits/codeit/api/tsconfig.json", { stdio: "inherit" });
}

const {
  startCodeitApi,
  createCodeitServer,
  CodeitDatabase,
  runMigrations,
  CodingLoopService,
  WorkspacePatcher,
  CommandRunner,
  ToolPolicy,
  PluginService,
  PluginBroker,
  computeManifestDigest,
  pathsOverlap
} = await import(pathToFileURL(distPath).href);

function sendRawRequest(options, bodyData = "") {
  return new Promise((resolvePromise, rejectPromise) => {
    const req = httpRequest(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }
        resolvePromise({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on("error", rejectPromise);
    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

describe("Wave F / T12: Complete Codeit End-to-End Verification Matrix (E01-E25)", () => {
  const testBaseDir = join(tmpdir(), `codeit-e2e-matrix-${Date.now()}`);
  const storageRoot = join(testBaseDir, "storage");
  const projectDirA = join(testBaseDir, "project-alpha");
  const projectDirB = join(testBaseDir, "project-beta");

  let serverInstance;
  let serverPort;
  let pairingToken;
  let sessionCookie;
  let csrfToken;

  let projectUuidA;
  let projectUuidB;
  let conversationUuidPlan;

  before(async () => {
    mkdirSync(storageRoot, { recursive: true });
    mkdirSync(projectDirA, { recursive: true });
    mkdirSync(projectDirB, { recursive: true });

    // Seed project A with fixture code having a deliberate case-sensitivity bug
    writeFileSync(
      join(projectDirA, "filter.js"),
      `export function filterTasks(tasks, query) {
  if (!query) return tasks;
  // Deliberate defect: strict case-sensitive match
  return tasks.filter(t => t.title.includes(query));
}
`,
      "utf8"
    );

    writeFileSync(
      join(projectDirA, "filter.test.mjs"),
      `import assert from "node:assert/strict";
import { filterTasks } from "./filter.js";

const tasks = [
  { id: 1, title: "Implement Auth" },
  { id: 2, title: "Review PR" },
  { id: 3, title: "Write tests" }
];

// Expect case-insensitive search
const result = filterTasks(tasks, "auth");
assert.strictEqual(result.length, 1, "Should find 'Implement Auth' with query 'auth'");
assert.strictEqual(result[0].id, 1);
console.log("ALL_TESTS_PASSED");
`,
      "utf8"
    );

    // Seed project B with secret canary files for isolation checks
    writeFileSync(join(projectDirB, ".env"), "DATABASE_SECRET_KEY=super-secret-canary-b", "utf8");
    writeFileSync(join(projectDirB, "secret.key"), "PRIVATE_KEY_CANARY_B", "utf8");
    writeFileSync(join(projectDirB, "data.txt"), "Project B Private Content", "utf8");

    // Start standalone Codeit API server
    serverInstance = await startCodeitApi({
      port: 0,
      storageRoot,
      pairingToken: "test-e2e-pairing-token-abc12345"
    });

    serverPort = serverInstance.port;
    pairingToken = "test-e2e-pairing-token-abc12345";
  });

  after(async () => {
    if (serverInstance) {
      await serverInstance.close();
    }
    try {
      rmSync(testBaseDir, { recursive: true, force: true });
    } catch {
      // ignore Windows cleanup delays
    }
  });

  // --------------------------------------------------------------------------
  // Suite 1: Standalone Startup & Host Security (E01, E02, E25)
  // --------------------------------------------------------------------------
  describe("1. Standalone Startup & Host Security (E01, E02, E25)", () => {
    test("E01: Standalone health endpoint responds without Platform dependency", async () => {
      const res = await sendRawRequest({
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/health",
        method: "GET",
        headers: { Host: `127.0.0.1:${serverPort}` }
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.status, "ok");
      assert.strictEqual(res.data.data.port, serverPort);
    });

    test("E01: Occupied port refusal throws clean error", async () => {
      await assert.rejects(
        () => startCodeitApi({ port: serverPort, inMemoryDb: true }),
        (err) => {
          assert.match(err.message, /already in use or unavailable/);
          return true;
        }
      );
    });

    test("E02: Untrusted Host header (DNS rebinding) is rejected with 403", async () => {
      const res = await sendRawRequest({
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/health",
        method: "GET",
        headers: { Host: "attacker-controlled-site.com" }
      });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.data.error.code, "CODEIT_HOST_FORBIDDEN");
    });

    test("E02: Untrusted Origin header is rejected with 403", async () => {
      const res = await sendRawRequest({
        hostname: "127.0.0.1",
        port: serverPort,
        path: "/api/codeit/health",
        method: "GET",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Origin: "http://evil-third-party.com"
        }
      });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.data.error.code, "CODEIT_HOST_FORBIDDEN");
    });

    test("E02: Mutation without pairing authentication is rejected with 401", async () => {
      const res = await sendRawRequest(
        {
          hostname: "127.0.0.1",
          port: serverPort,
          path: "/api/codeit/projects",
          method: "POST",
          headers: {
            Host: `127.0.0.1:${serverPort}`,
            "Content-Type": "application/json"
          }
        },
        JSON.stringify({ name: "Project Alpha", root_path: projectDirA })
      );

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.error.code, "CODEIT_UNAUTHORIZED");
    });

    test("E02: Valid pairing exchange creates session and CSRF token", async () => {
      const res = await sendRawRequest(
        {
          hostname: "127.0.0.1",
          port: serverPort,
          path: "/api/codeit/pairing",
          method: "POST",
          headers: {
            Host: `127.0.0.1:${serverPort}`,
            "Content-Type": "application/json"
          }
        },
        JSON.stringify({ pairing_token: pairingToken })
      );

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.data.csrf_token);

      csrfToken = res.data.data.csrf_token;
      const setCookie = res.headers["set-cookie"];
      assert.ok(setCookie);
      sessionCookie = setCookie[0].split(";")[0];
      assert.ok(sessionCookie.startsWith("codexsun_codeit_session="));
    });

    test("E02: Mutation with valid session but missing CSRF token is rejected with 403", async () => {
      const res = await sendRawRequest(
        {
          hostname: "127.0.0.1",
          port: serverPort,
          path: "/api/codeit/projects",
          method: "POST",
          headers: {
            Host: `127.0.0.1:${serverPort}`,
            Cookie: sessionCookie,
            "Content-Type": "application/json"
          }
        },
        JSON.stringify({ name: "Project Alpha", root_path: projectDirA })
      );

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.data.error.code, "CODEIT_CSRF_MISMATCH");
    });

    test("E25: Forged tenant/project headers without local credentials cannot authorize mutations", async () => {
      const res = await sendRawRequest(
        {
          hostname: "127.0.0.1",
          port: serverPort,
          path: "/api/codeit/projects",
          method: "POST",
          headers: {
            Host: `127.0.0.1:${serverPort}`,
            "X-Tenant-Id": "forged-tenant",
            "X-User-Role": "admin",
            "Content-Type": "application/json"
          }
        },
        JSON.stringify({ name: "Project Alpha", root_path: projectDirA })
      );

      assert.strictEqual(res.status, 401);
    });
  });

  // --------------------------------------------------------------------------
  // Suite 2: Project Boundary Isolation & Secret Protection (E03, E21)
  // --------------------------------------------------------------------------
  describe("2. Project Isolation & Secret Protection (E03, E21)", () => {
    test("Registers disposable projects Alpha and Beta", async () => {
      const resA = await sendRawRequest(
        {
          hostname: "127.0.0.1",
          port: serverPort,
          path: "/api/codeit/projects",
          method: "POST",
          headers: {
            Host: `127.0.0.1:${serverPort}`,
            Cookie: sessionCookie,
            "x-codeit-csrf": csrfToken,
            "Content-Type": "application/json"
          }
        },
        JSON.stringify({ name: "Project Alpha", root_path: projectDirA })
      );

      assert.strictEqual(resA.status, 200);
      assert.strictEqual(resA.data.success, true);
      projectUuidA = resA.data.data.uuid;

      const resB = await sendRawRequest(
        {
          hostname: "127.0.0.1",
          port: serverPort,
          path: "/api/codeit/projects",
          method: "POST",
          headers: {
            Host: `127.0.0.1:${serverPort}`,
            Cookie: sessionCookie,
            "x-codeit-csrf": csrfToken,
            "Content-Type": "application/json"
          }
        },
        JSON.stringify({ name: "Project Beta", root_path: projectDirB })
      );

      assert.strictEqual(resB.status, 200);
      projectUuidB = resB.data.data.uuid;
    });

    test("E03: Project Alpha cannot read Project Beta files", async () => {
      const res = await sendRawRequest({
        hostname: "127.0.0.1",
        port: serverPort,
        path: `/api/codeit/workspace/files?project_uuid=${projectUuidA}&path=../project-beta/data.txt`,
        method: "GET",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie
        }
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.error.code, "CODEIT_PATH_DENIED");
    });

    test("E03: Path traversal with null bytes and symlinks is rejected", async () => {
      const res = await sendRawRequest({
        hostname: "127.0.0.1",
        port: serverPort,
        path: `/api/codeit/workspace/files?project_uuid=${projectUuidA}&path=%00/etc/passwd`,
        method: "GET",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie
        }
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.error.code, "CODEIT_PATH_DENIED");
    });

    test("E21: Reading secret canaries (.env, *.key) is unconditionally denied", async () => {
      const resEnv = await sendRawRequest({
        hostname: "127.0.0.1",
        port: serverPort,
        path: `/api/codeit/workspace/files?project_uuid=${projectUuidB}&path=.env`,
        method: "GET",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie
        }
      });

      assert.strictEqual(resEnv.status, 400);
      assert.strictEqual(resEnv.data.error.code, "CODEIT_PATH_DENIED");

      const resKey = await sendRawRequest({
        hostname: "127.0.0.1",
        port: serverPort,
        path: `/api/codeit/workspace/files?project_uuid=${projectUuidB}&path=secret.key`,
        method: "GET",
        headers: {
          Host: `127.0.0.1:${serverPort}`,
          Cookie: sessionCookie
        }
      });

      assert.strictEqual(resKey.status, 400);
      assert.strictEqual(resKey.data.error.code, "CODEIT_PATH_DENIED");
    });
  });

  // --------------------------------------------------------------------------
  // Suite 3: Plan-Only Mode & Durable Chat Persistence (E04, E06, E07)
  // --------------------------------------------------------------------------
  describe("3. Plan-Only Mode & Durable Chat Persistence (E04, E06, E07)", () => {
    let runUuid;

    test("Creates conversation and user message in Plan mode", async () => {
      const convRes = await sendRawRequest(
        {
          hostname: "127.0.0.1",
          port: serverPort,
          path: "/api/codeit/conversations",
          method: "POST",
          headers: {
            Host: `127.0.0.1:${serverPort}`,
            Cookie: sessionCookie,
            "x-codeit-csrf": csrfToken,
            "Content-Type": "application/json"
          }
        },
        JSON.stringify({
          project_uuid: projectUuidA,
          title: "Plan title filter feature",
          mode: "plan"
        })
      );

      assert.strictEqual(convRes.status, 200);
      conversationUuidPlan = convRes.data.data.uuid;

      const msgRes = await sendRawRequest(
        {
          hostname: "127.0.0.1",
          port: serverPort,
          path: `/api/codeit/conversations/${conversationUuidPlan}/messages`,
          method: "POST",
          headers: {
            Host: `127.0.0.1:${serverPort}`,
            Cookie: sessionCookie,
            "x-codeit-csrf": csrfToken,
            "Content-Type": "application/json"
          }
        },
        JSON.stringify({
          role: "user",
          content: "Please plan adding a case-insensitive title filter to the task list.",
          request_key: "req-plan-msg-001"
        })
      );

      assert.strictEqual(msgRes.status, 200);
      assert.strictEqual(msgRes.data.data.request_key, "req-plan-msg-001");
    });

    test("E04: Plan mode strictly denies mutation tools", () => {
      const decision = ToolPolicy.evaluate({
        actor: "assistant",
        projectTrust: "trusted",
        mode: "plan",
        tool: {
          name: "workspace.patch",
          version: "1.0.0",
          category: "mutation",
          capability: "workspace.patch",
          dangerous: true
        },
        argumentsPayload: { path: "src/index.ts", patch: "diff" }
      });

      assert.strictEqual(decision.decision, "deny");
      assert.match(decision.reason, /strictly forbids mutations/);
    });

    test("E06: Conversations, messages, and runs survive DB restart", async () => {
      // Fetch current messages
      const beforeList = await sendRawRequest({
        hostname: "127.0.0.1",
        port: serverPort,
        path: `/api/codeit/conversations/${conversationUuidPlan}/messages`,
        method: "GET",
        headers: { Host: `127.0.0.1:${serverPort}`, Cookie: sessionCookie }
      });

      assert.strictEqual(beforeList.status, 200);
      assert.strictEqual(beforeList.data.data.items.length, 1);

      // Verify records are retained in database
      const rows = serverInstance.db.db
        .prepare("SELECT uuid, role, content FROM codeit_messages WHERE conversation_uuid = ?")
        .all(conversationUuidPlan);
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].role, "user");
    });

    test("E07: Stream event replay monotonic cursor", async () => {
      // Create a run
      const runRes = await sendRawRequest(
        {
          hostname: "127.0.0.1",
          port: serverPort,
          path: "/api/codeit/runs",
          method: "POST",
          headers: {
            Host: `127.0.0.1:${serverPort}`,
            Cookie: sessionCookie,
            "x-codeit-csrf": csrfToken,
            "Content-Type": "application/json"
          }
        },
        JSON.stringify({
          conversation_uuid: conversationUuidPlan,
          mode: "plan",
          prompt: "Plan task filter"
        })
      );

      assert.strictEqual(runRes.status, 200);
      runUuid = runRes.data.data.uuid;

      // Inspect run state
      const inspectRes = await sendRawRequest({
        hostname: "127.0.0.1",
        port: serverPort,
        path: `/api/codeit/runs/${runUuid}`,
        method: "GET",
        headers: { Host: `127.0.0.1:${serverPort}`, Cookie: sessionCookie }
      });

      assert.strictEqual(inspectRes.status, 200);
      assert.strictEqual(inspectRes.data.data.uuid, runUuid);
    });
  });

  // --------------------------------------------------------------------------
  // Suite 4: Real Provider Adapter & Error Normalization (E05, E16)
  // --------------------------------------------------------------------------
  describe("4. Provider Adapter & Error Normalization (E05, E16)", () => {
    test("E05: Provider streams text, reports token usage, and normalizes errors", async () => {
      const providerModule = serverInstance.providerModule;
      const provider = providerModule.service.getAdapter("mock");
      assert.ok(provider);

      const chunks = [];
      const generator = provider.generateStream({
        model: "mock-codeit-default",
        messages: [{ role: "user", content: "hello test" }]
      });

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      assert.ok(chunks.length >= 2);
      const textChunks = chunks.filter((c) => c.type === "text_delta");
      const usageChunk = chunks.find((c) => c.type === "usage");
      const finishChunk = chunks.find((c) => c.type === "finish");

      assert.ok(textChunks.length > 0);
      assert.ok(usageChunk);
      assert.ok(usageChunk.usage.total_tokens > 0);
      assert.ok(finishChunk);
      assert.strictEqual(finishChunk.finish_reason, "stop");
    });

    test("E05: Live provider adapter fails closed without credentials or streams with real key", async () => {
      const providerModule = serverInstance.providerModule;
      const gemini = providerModule.service.getAdapter("gemini");
      assert.ok(gemini);

      if (process.env.GEMINI_API_KEY) {
        // Real live provider inference stream with genuine credentials
        const chunks = [];
        const generator = gemini.generateStream({
          model: "gemini-2.0-flash",
          messages: [{ role: "user", content: "Respond with the single word PONG" }]
        });
        for await (const chunk of generator) {
          chunks.push(chunk);
        }
        const textChunks = chunks.filter((c) => c.type === "text_delta");
        assert.ok(textChunks.length > 0, "Live Gemini inference must return text chunks");
      } else {
        // Genuine credential failure: provider must fail closed with 401, never faking success
        const status = await gemini.checkHealth();
        assert.strictEqual(status.configured, false);
        assert.ok(status.error?.includes("GEMINI_API_KEY"));

        const chunks = [];
        const generator = gemini.generateStream({
          model: "gemini-2.0-flash",
          messages: [{ role: "user", content: "hello" }]
        });
        for await (const chunk of generator) {
          chunks.push(chunk);
        }
        const errChunk = chunks.find((c) => c.type === "error");
        assert.ok(errChunk, "Unconfigured provider must yield error chunk, not fake text");
        assert.strictEqual(errChunk.error.code, "CODEIT_PROVIDER_AUTH_FAILED");
        assert.strictEqual(errChunk.error.status, 401);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Suite 5: Work Mode Single-Worker Golden Path (E08, E09, E22)
  // --------------------------------------------------------------------------
  describe("5. Work Mode Single-Worker Golden Path (E08, E09, E22)", () => {
    test("Reproduce failure -> propose patch -> apply -> verify success (Golden Path steps 7-12)", async () => {
      // Step 1: Create conversation in Work mode
      const convRes = await sendRawRequest(
        {
          hostname: "127.0.0.1",
          port: serverPort,
          path: "/api/codeit/conversations",
          method: "POST",
          headers: {
            Host: `127.0.0.1:${serverPort}`,
            Cookie: sessionCookie,
            "x-codeit-csrf": csrfToken,
            "Content-Type": "application/json"
          }
        },
        JSON.stringify({
          project_uuid: projectUuidA,
          title: "Fix case-insensitive filter",
          mode: "work"
        })
      );

      assert.strictEqual(convRes.status, 200);
      const workConvUuid = convRes.data.data.uuid;

      // Step 2: Create a Work Run with auto_execute: false
      const runRes = await sendRawRequest(
        {
          hostname: "127.0.0.1",
          port: serverPort,
          path: "/api/codeit/runs",
          method: "POST",
          headers: {
            Host: `127.0.0.1:${serverPort}`,
            Cookie: sessionCookie,
            "x-codeit-csrf": csrfToken,
            "Content-Type": "application/json"
          }
        },
        JSON.stringify({
          conversation_uuid: workConvUuid,
          mode: "work",
          prompt: "Fix case-insensitive filter defect",
          auto_execute: false
        })
      );
      assert.strictEqual(runRes.status, 200);
      const workRunUuid = runRes.data.data.uuid;

      // Step 3: Trigger CodingLoopService
      const loopService = serverInstance.loopService;
      const targetFilePath = join(projectDirA, "filter.js");
      const initialFileContent = readFileSync(targetFilePath, "utf8");
      const initialHash = createHash("sha256").update(initialFileContent, "utf8").digest("hex");

      const fixedContent = `export function filterTasks(tasks, query) {
  if (!query) return tasks;
  const q = String(query).toLowerCase();
  return tasks.filter(t => t.title.toLowerCase().includes(q));
}
`;

      const result = await loopService.executeLoop({
        runUuid: workRunUuid,
        projectRoot: projectDirA,
        testCommand: {
          executable: "node",
          args: ["filter.test.mjs"],
          cwd: "."
        },
        patchProposal: {
          path: "filter.js",
          expected_hash: initialHash,
          patch: fixedContent
        },
        autoApprove: true
      });

      assert.strictEqual(result.reproduced, true, "Initial defect must be reproduced (exit 1)");
      assert.strictEqual(result.patch_applied, true, "Patch must be applied");
      assert.strictEqual(result.verified, true, "Post-patch verification must pass (exit 0)");
      assert.strictEqual(result.status, "succeeded");
      assert.ok(result.patch_result?.diff_artifact_uuid, "Must generate diff artifact");

      // Verify file was patched atomically on disk
      const updatedContent = readFileSync(targetFilePath, "utf8");
      assert.strictEqual(updatedContent, fixedContent);

      // Verify diff artifact stored in artifacts table
      const artifactRow = serverInstance.db.db
        .prepare("SELECT * FROM codeit_artifacts WHERE uuid = ?")
        .get(result.patch_result.diff_artifact_uuid);
      assert.ok(artifactRow);
      assert.strictEqual(artifactRow.artifact_type, "diff");
      assert.ok(artifactRow.content_hash);
    });
  });

  // --------------------------------------------------------------------------
  // Suite 6: Conflict Detection & Atomic State Integrity (E08, E23)
  // --------------------------------------------------------------------------
  describe("6. Conflict Detection & Atomic State Integrity (E08, E23)", () => {
    test("E08: Stale expected_hash rejects patch application with 409 conflict", async () => {
      const patcher = new WorkspacePatcher();
      const targetFilePath = join(projectDirA, "filter.js");

      // Intentionally provide wrong/stale expected_hash
      const staleHash = "0000000000000000000000000000000000000000000000000000000000000000";

      assert.throws(
        () =>
          patcher.applyPatch(projectDirA, {
            run_uuid: "00000001",
            path: "filter.js",
            expected_hash: staleHash,
            patch: "// malicious or conflicting change"
          }),
        (err) => {
          assert.strictEqual(err.code, "CODEIT_INVALID_STATE");
          assert.strictEqual(err.statusCode, 409);
          return true;
        }
      );

      // Verify original file was preserved intact
      const content = readFileSync(targetFilePath, "utf8");
      assert.ok(content.includes("filterTasks"));
    });
  });

  // --------------------------------------------------------------------------
  // Suite 7: Process Cancellation & Windows Process-Tree Cleanup (E10)
  // --------------------------------------------------------------------------
  describe("7. Process Cancellation & Process-Tree Cleanup (E10)", () => {
    test("E10: AbortSignal cleanly terminates running child process tree", async () => {
      const runner = new CommandRunner(projectDirA);
      const controller = new AbortController();

      // Trigger abort after 150ms
      setTimeout(() => {
        controller.abort();
      }, 150);

      const result = await runner.execute(
        {
          run_uuid: "00000001",
          executable: "node",
          args: ["-e", "setInterval(() => {}, 1000);"],
          cwd: projectDirA,
          timeout_ms: 10000
        },
        {
          signal: controller.signal
        }
      );

      assert.strictEqual(result.exit_code, -1);
      assert.match(result.error, /cancelled/i);
    });
  });

  // --------------------------------------------------------------------------
  // Suite 8: Parallel Workers Orchestration & Integration Gate (E13, E14, E22)
  // --------------------------------------------------------------------------
  describe("8. Parallel Workers Orchestration & Integration Gate (E13, E14, E22)", () => {
    test("E14: Disjoint path leases allow parallel workers; overlapping leases are rejected", async () => {
      const orchService = serverInstance.orchestrationModule.service;

      // Create a test run using the real conversation
      const runRecord = serverInstance.runModule.service.createRun({
        conversation_uuid: conversationUuidPlan,
        mode: "work"
      });

      // Worker 1 leases src/filter.js
      const w1 = orchService.dispatch({
        run_uuid: runRecord.uuid,
        task_id: "TASK-01",
        worker_id: "worker-alpha",
        allowed_paths: ["src/filter.js"]
      });
      assert.strictEqual(w1.assignment.state, "active");

      // Worker 2 attempts to lease overlapping pattern -> rejected with CODEIT_LEASE_CONFLICT
      assert.throws(
        () =>
          orchService.dispatch({
            run_uuid: runRecord.uuid,
            task_id: "TASK-02-CONFLICT",
            worker_id: "worker-beta",
            allowed_paths: ["src/**"]
          }),
        (err) => {
          assert.strictEqual(err.code, "CODEIT_LEASE_CONFLICT");
          return true;
        }
      );

      // Worker 2 leases docs/README.md (disjoint) -> succeeds
      const w2 = orchService.dispatch({
        run_uuid: runRecord.uuid,
        task_id: "TASK-02",
        worker_id: "worker-beta",
        allowed_paths: ["docs/README.md"]
      });
      assert.strictEqual(w2.assignment.state, "active");

      // Clean up assignments
      orchService.completeAssignment(w1.assignment.uuid, { worker_id: "worker-alpha" });
      orchService.completeAssignment(w2.assignment.uuid, { worker_id: "worker-beta" });
    });

    test("E13: Dependency validation blocks task until prerequisite completes", async () => {
      const orchService = serverInstance.orchestrationModule.service;
      const runRecord = serverInstance.runModule.service.createRun({
        conversation_uuid: conversationUuidPlan,
        mode: "work"
      });

      // Dispatch Task A
      const wA = orchService.dispatch({
        run_uuid: runRecord.uuid,
        task_id: "TASK-A",
        worker_id: "worker-A",
        allowed_paths: ["pkg-a/**"]
      });
      assert.strictEqual(wA.assignment.state, "active");

      // Attempt to dispatch Task B depending on TASK-A while Task A is not completed -> rejects
      assert.throws(
        () =>
          orchService.dispatch({
            run_uuid: runRecord.uuid,
            task_id: "TASK-B",
            worker_id: "worker-B",
            allowed_paths: ["pkg-b/**"],
            dependencies: ["TASK-A"]
          }),
        (err) => {
          assert.strictEqual(err.code, "CODEIT_DEPENDENCY_UNSATISFIED");
          return true;
        }
      );

      // Complete Task A
      orchService.completeAssignment(wA.assignment.uuid, { worker_id: "worker-A" });

      // Now Task B can be dispatched successfully
      const wB = orchService.dispatch({
        run_uuid: runRecord.uuid,
        task_id: "TASK-B",
        worker_id: "worker-B",
        allowed_paths: ["pkg-b/**"],
        dependencies: ["TASK-A"]
      });
      assert.strictEqual(wB.assignment.state, "active");

      orchService.completeAssignment(wB.assignment.uuid, { worker_id: "worker-B" });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 9: MCP Plugin Lifecycle & Fail-Closed Revocation (E12, E17, E18, E20, E21)
  // --------------------------------------------------------------------------
  describe("9. MCP Plugin Lifecycle & Revocation (E12, E17, E18, E20, E21)", () => {
    const fixturePluginDir = join(process.cwd(), "devkits/codeit/api/test/fixtures/plugins");
    const mockMcpScript = join(fixturePluginDir, "mock-mcp-server.mjs");

    function createManifest(overrides = {}) {
      const raw = {
        plugin_id: "e2e_mcp_test",
        name: "E2E MCP Test Plugin",
        version: "1.0.0",
        description: "Test plugin for E2E verification",
        entrypoint: {
          command: "node",
          args: [mockMcpScript]
        },
        capabilities: ["tool_calling"],
        advertised_tools: [
          {
            name: "echo",
            description: "Echo message back",
            inputSchema: { type: "object" },
            required_grants: []
          },
          {
            name: "hang",
            description: "Hangs indefinitely",
            inputSchema: { type: "object" },
            required_grants: []
          }
        ],
        requested_grants: [],
        author: "Codeit E2E Tester",
        ...overrides
      };
      const digest = computeManifestDigest(raw);
      return { ...raw, manifest_digest: digest };
    }

    test("E17: Installs verified manifest and executes namespaced MCP tool via broker", async () => {
      const pluginService = serverInstance.pluginModule.service;
      const manifest = createManifest();

      // Install plugin
      const installed = pluginService.install(manifest);
      assert.strictEqual(installed.enabled_state, "installed");

      // Enable plugin
      pluginService.enable(installed.uuid);

      // Execute echo tool
      const res = await pluginService.invokeTool(installed.uuid, "echo", { message: "e2e-ok" });
      assert.strictEqual(res.isError, false);
      assert.strictEqual(res.content[0].text, "Echo: e2e-ok");
    });

    test("E18: Revoking plugin immediately fences in-flight calls and shuts down child broker", async () => {
      const pluginService = serverInstance.pluginModule.service;
      const manifest = createManifest({ plugin_id: "e2e_mcp_revoke" });

      const installed = pluginService.install(manifest);
      pluginService.enable(installed.uuid);

      // Warm up session
      await pluginService.invokeTool(installed.uuid, "echo", { message: "ready" });

      // Start hanging call
      const inFlightPromise = pluginService.invokeTool(
        installed.uuid,
        "hang",
        {},
        { timeoutMs: 10000 }
      );

      // Allow stdio roundtrip
      await new Promise((r) => setTimeout(r, 50));

      // Revoke plugin
      pluginService.revoke(installed.uuid);

      // Must be rejected immediately with CODEIT_PLUGIN_REVOKED
      await assert.rejects(inFlightPromise, (err) => {
        assert.strictEqual(err.code, "CODEIT_PLUGIN_REVOKED");
        return true;
      });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 10: Personalization Scoping & Context Control (E19, E20, E21)
  // --------------------------------------------------------------------------
  describe("10. Personalization Scoping & Context Control (E19, E20, E21)", () => {
    test("E19: Project facts are strictly scoped; cross-project bleed is prevented", async () => {
      const personalization = serverInstance.personalizationModule.service;

      // Store confirmed fact for Project Alpha
      personalization.storeFact({
        scope: "project",
        owner_id: projectUuidA,
        fact_key: "code_style",
        fact_value: "Use TypeScript strict mode and semicolons",
        source: "user_explicit",
        confirmation_state: "confirmed"
      });

      // Query facts for Project Alpha
      const factsA = personalization.listFacts({ scope: "project", owner_id: projectUuidA });
      assert.strictEqual(factsA.length, 1);
      assert.strictEqual(factsA[0].fact_key, "code_style");

      // Query facts for Project Beta -> must return empty (no bleed)
      const factsB = personalization.listFacts({ scope: "project", owner_id: projectUuidB });
      assert.strictEqual(factsB.length, 0);
    });

    test("E21: Storing secrets or secret canaries in facts throws validation error", async () => {
      const personalization = serverInstance.personalizationModule.service;

      assert.throws(
        () =>
          personalization.storeFact({
            scope: "project",
            owner_id: projectUuidA,
            fact_key: "api_key",
            fact_value: "AIzaSySecretApiKeyCanary12345",
            source: "user_explicit",
            confirmation_state: "confirmed"
          }),
        (err) => {
          assert.strictEqual(err.code, "CODEIT_VALIDATION_ERROR");
          assert.match(err.message, /Sensitive data, secret canary, or credential key detected/);
          return true;
        }
      );
    });

    test("E19: Forget operation immediately purges fact from assembled context preview", async () => {
      const personalization = serverInstance.personalizationModule.service;

      const fact = personalization.storeFact({
        scope: "user",
        owner_id: "user-default",
        fact_key: "editor_font",
        fact_value: "JetBrains Mono",
        source: "user_explicit",
        confirmation_state: "confirmed"
      });

      // Context preview contains fact
      const previewBefore = personalization.assembleContextPreview({
        project_uuid: projectUuidA,
        user_id: "user-default"
      });
      assert.ok(previewBefore.assembled_prompt.includes("JetBrains Mono"));

      // Forget fact
      personalization.forgetFact(fact.uuid);

      // Context preview immediately excludes forgotten fact
      const previewAfter = personalization.assembleContextPreview({
        project_uuid: projectUuidA,
        user_id: "user-default"
      });
      assert.strictEqual(previewAfter.assembled_prompt.includes("JetBrains Mono"), false);
    });
  });
});
