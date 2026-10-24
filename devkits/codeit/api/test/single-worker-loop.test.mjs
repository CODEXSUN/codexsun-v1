import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const distPath = resolve(process.cwd(), "dist/devkits/codeit/api");
if (!existsSync(join(distPath, "modules/run/coding-loop.service.js"))) {
  execSync("npx tsc -p devkits/codeit/api/tsconfig.json", { stdio: "inherit" });
}

const { CodingLoopService, RunModule, RunService, RunRepository } = await import(
  pathToFileURL(join(distPath, "modules/run/index.js")).href
);

const { WorkspaceModule, WorkspacePatcher, CommandRunner } = await import(
  pathToFileURL(join(distPath, "modules/workspace/index.js")).href
);

const { ConversationModule, ConversationRepository, ConversationService } = await import(
  pathToFileURL(join(distPath, "modules/conversation/index.js")).href
);

const { ProjectModule } = await import(
  pathToFileURL(join(distPath, "modules/project/index.js")).href
);

const { CodeitDatabase, runMigrations } = await import(
  pathToFileURL(join(distPath, "storage/index.js")).href
);

const { InvalidStateError } = await import(pathToFileURL(join(distPath, "errors.js")).href);

describe("T08: Single-Worker Coding Loop and Golden Path Verification", () => {
  const testBaseDir = join(tmpdir(), `codeit-loop-test-${Date.now()}`);
  const fixtureProjectDir = join(testBaseDir, "fixture-project");

  let db;
  let codeitDb;
  let projectModule;
  let conversationModule;
  let runModule;
  let runService;
  let workspaceModule;
  let patcher;
  let runner;
  let loopService;
  let projectUuid;
  let conversationUuid;

  before(async () => {
    mkdirSync(fixtureProjectDir, { recursive: true });

    codeitDb = new CodeitDatabase({ inMemory: true });
    db = codeitDb.db;
    runMigrations(db);

    projectModule = new ProjectModule(db);
    conversationModule = new ConversationModule(db);
    workspaceModule = new WorkspaceModule(db);
    patcher = workspaceModule.patcher;
    runner = workspaceModule.runner;

    runModule = new RunModule(db);
    runService = runModule.service;

    loopService = new CodingLoopService(runService, patcher, runner, db);

    // Register test project
    const project = projectModule.service.registerProject({
      name: "Loop Fixture Project",
      root_path: fixtureProjectDir,
      trust_state: "trusted"
    });
    projectUuid = project.uuid;

    // Create test conversation
    const conversation = conversationModule.service.createConversation({
      project_uuid: projectUuid,
      title: "Golden Path Coding Loop",
      selected_mode: "work"
    });
    conversationUuid = conversation.uuid;
  });

  after(() => {
    try {
      codeitDb.close();
    } catch {
      // Ignored
    }
    if (existsSync(testBaseDir)) {
      try {
        rmSync(testBaseDir, { recursive: true, force: true });
      } catch {
        // Ignored
      }
    }
  });

  describe("1. Golden Path: Reproduce -> Patch -> Verify -> Succeeded (E08, E09, E22)", () => {
    test("reproduces failing test, applies approved patch atomically, and verifies success", async () => {
      // Step A: Set up broken code and failing test in fixture
      const srcFile = "calculator.js";
      const testFile = "calculator.test.mjs";

      // Intentional bug: add(a, b) returns a - b
      const brokenSrc = "export function add(a, b) { return a - b; }\n";
      writeFileSync(join(fixtureProjectDir, srcFile), brokenSrc, "utf8");
      const srcHash = createHash("sha256").update(Buffer.from(brokenSrc, "utf8")).digest("hex");

      const testCode = `import assert from "node:assert/strict";
import { add } from "./calculator.js";
assert.equal(add(2, 3), 5);
console.log("TEST_PASSED");
`;
      writeFileSync(join(fixtureProjectDir, testFile), testCode, "utf8");

      // Step B: Create Run in work mode
      const run = runService.createRun({
        conversation_uuid: conversationUuid,
        project_uuid: projectUuid,
        mode: "work"
      });
      assert.equal(run.state, "queued");

      // Corrected source code
      const fixedSrc = "export function add(a, b) { return a + b; }\n";

      // Step C: Execute Loop with autoApprove: true
      const result = await loopService.executeLoop({
        runUuid: run.uuid,
        projectRoot: fixtureProjectDir,
        testCommand: {
          executable: "node",
          args: [testFile],
          cwd: "."
        },
        patchProposal: {
          path: srcFile,
          expected_hash: srcHash,
          patch: fixedSrc
        },
        autoApprove: true
      });

      // Assert result
      assert.equal(
        result.reproduced,
        true,
        "Deliberate bug must be reproduced with non-zero exit code"
      );
      assert.notEqual(result.reproduction_exit_code, 0);
      assert.equal(result.patch_applied, true, "Patch must be applied");
      assert.ok(result.patch_result?.diff_artifact_uuid, "Diff artifact must be generated");
      assert.equal(result.verified, true, "Verification test must pass with exit code 0");
      assert.equal(result.verification_exit_code, 0);
      assert.match(result.verification_output, /TEST_PASSED/);
      assert.equal(result.status, "succeeded");

      // Verify file content updated atomically on disk
      assert.equal(readFileSync(join(fixtureProjectDir, srcFile), "utf8"), fixedSrc);

      // Verify run state is succeeded
      const updatedRun = runService.getRunByUuid(run.uuid);
      assert.equal(updatedRun.state, "succeeded");

      // Verify events stream sequence
      const events = runService.getEventsSince(run.uuid, 0);
      const eventTypes = events.map((e) => e.event_type);
      assert.ok(eventTypes.includes("loop.reproducing"));
      assert.ok(eventTypes.includes("loop.reproduced"));
      assert.ok(eventTypes.includes("loop.patch_proposed"));
      assert.ok(eventTypes.includes("loop.patch_applied"));
      assert.ok(eventTypes.includes("loop.verified"));
      assert.ok(eventTypes.includes("run.succeeded"));
    });
  });

  describe("2. Approval Gate: Pause in Waiting State when Approval is Required (E11, E12)", () => {
    test("pauses execution in waiting state when autoApprove is false", async () => {
      const srcFile = "greeter.js";
      const testFile = "greeter.test.mjs";

      const brokenSrc = "export function greet(name) { return 'Goodbye ' + name; }\n";
      writeFileSync(join(fixtureProjectDir, srcFile), brokenSrc, "utf8");
      const srcHash = createHash("sha256").update(Buffer.from(brokenSrc, "utf8")).digest("hex");

      const testCode = `import assert from "node:assert/strict";
import { greet } from "./greeter.js";
assert.equal(greet("World"), "Hello World");
`;
      writeFileSync(join(fixtureProjectDir, testFile), testCode, "utf8");

      const run = runService.createRun({
        conversation_uuid: conversationUuid,
        project_uuid: projectUuid,
        mode: "work"
      });

      const fixedSrc = "export function greet(name) { return 'Hello ' + name; }\n";

      // Execute loop without autoApprove
      const result = await loopService.executeLoop({
        runUuid: run.uuid,
        projectRoot: fixtureProjectDir,
        testCommand: {
          executable: "node",
          args: [testFile]
        },
        patchProposal: {
          path: srcFile,
          expected_hash: srcHash,
          patch: fixedSrc
        },
        autoApprove: false
      });

      assert.equal(result.reproduced, true);
      assert.equal(
        result.patch_applied,
        false,
        "Patch must NOT be applied without operator approval"
      );
      assert.equal(result.verified, false);
      assert.equal(result.status, "waiting");

      // Target file remains untouched
      assert.equal(readFileSync(join(fixtureProjectDir, srcFile), "utf8"), brokenSrc);

      // Run state must be waiting
      const waitingRun = runService.getRunByUuid(run.uuid);
      assert.equal(waitingRun.state, "waiting");

      // Verify event was emitted
      const events = runService.getEventsSince(run.uuid, 0);
      assert.ok(events.some((e) => e.event_type === "loop.patch_proposed"));
    });
  });

  describe("3. Conflict Detection and Graceful Recovery (E08, E23)", () => {
    test("detects hash mismatch when file changed externally and enters blocked state without file mutation", async () => {
      const srcFile = "state.js";
      const testFile = "state.test.mjs";

      const originalSrc = "export const count = 0;\n";
      writeFileSync(join(fixtureProjectDir, srcFile), originalSrc, "utf8");

      // Stale hash that does not match originalSrc
      const staleHash = "0000000000000000000000000000000000000000000000000000000000000000";

      const testCode = `import assert from "node:assert/strict";
import { count } from "./state.js";
assert.equal(count, 42);
`;
      writeFileSync(join(fixtureProjectDir, testFile), testCode, "utf8");

      const run = runService.createRun({
        conversation_uuid: conversationUuid,
        project_uuid: projectUuid,
        mode: "work"
      });

      const result = await loopService.executeLoop({
        runUuid: run.uuid,
        projectRoot: fixtureProjectDir,
        testCommand: {
          executable: "node",
          args: [testFile]
        },
        patchProposal: {
          path: srcFile,
          expected_hash: staleHash,
          patch: "export const count = 42;\n"
        },
        autoApprove: true
      });

      assert.equal(result.status, "conflict");
      assert.equal(result.patch_applied, false);
      assert.match(result.error ?? "", /hash mismatch/i);

      // Verify original file on disk is strictly preserved
      assert.equal(readFileSync(join(fixtureProjectDir, srcFile), "utf8"), originalSrc);

      // Run transitions to blocked
      const blockedRun = runService.getRunByUuid(run.uuid);
      assert.equal(blockedRun.state, "blocked");

      // Verify conflict event was recorded
      const events = runService.getEventsSince(run.uuid, 0);
      assert.ok(events.some((e) => e.event_type === "loop.conflict"));
    });
  });

  describe("4. Process Cancellation Lifecycle (E10)", () => {
    test("aborts running loop via cancelRun and cleanly terminates child process tree", async () => {
      const slowTestFile = "hanging.test.mjs";
      // Long-running child test process
      const slowTestCode = `setInterval(() => {}, 1000);\n`;
      writeFileSync(join(fixtureProjectDir, slowTestFile), slowTestCode, "utf8");

      const run = runService.createRun({
        conversation_uuid: conversationUuid,
        project_uuid: projectUuid,
        mode: "work"
      });

      const abortController = new AbortController();

      // Trigger cancel after 300ms
      setTimeout(() => {
        abortController.abort();
        runService.cancelRun(run.uuid, "Operator cancelled golden loop");
      }, 300);

      const result = await loopService.executeLoop({
        runUuid: run.uuid,
        projectRoot: fixtureProjectDir,
        testCommand: {
          executable: "node",
          args: [slowTestFile],
          timeout_ms: 10000
        },
        patchProposal: {
          path: "nonexistent.js",
          expected_hash: "a".repeat(64),
          patch: "content"
        },
        signal: abortController.signal
      });

      assert.equal(result.status, "cancelled");

      const cancelledRun = runService.getRunByUuid(run.uuid);
      assert.equal(cancelledRun.state, "cancelled");
      assert.ok(cancelledRun.cancellation_generation > 0);

      const events = runService.getEventsSince(run.uuid, 0);
      assert.ok(events.some((e) => e.event_type === "run.cancelled"));
    });
  });

  describe("5. Bounded Repair Loop (DEVELOPMENT-LOOP.md)", () => {
    test("attempts repair when initial patch fails verification and succeeds on repair patch", async () => {
      const srcFile = "multiplier.js";
      const testFile = "multiplier.test.mjs";

      const originalSrc = "export function multiply(a, b) { return 0; }\n";
      writeFileSync(join(fixtureProjectDir, srcFile), originalSrc, "utf8");
      const origHash = createHash("sha256").update(Buffer.from(originalSrc, "utf8")).digest("hex");

      const testCode = `import assert from "node:assert/strict";
import { multiply } from "./multiplier.js";
assert.equal(multiply(3, 4), 12);
`;
      writeFileSync(join(fixtureProjectDir, testFile), testCode, "utf8");

      const run = runService.createRun({
        conversation_uuid: conversationUuid,
        project_uuid: projectUuid,
        mode: "work"
      });

      // Incomplete patch: returns a * 2 (fails for 3 * 4 = 12)
      const faultyPatch = "export function multiply(a, b) { return a * 2; }\n";

      // Proper repair patch: returns a * b
      const correctPatch = "export function multiply(a, b) { return a * b; }\n";

      const result = await loopService.executeLoop({
        runUuid: run.uuid,
        projectRoot: fixtureProjectDir,
        testCommand: {
          executable: "node",
          args: [testFile]
        },
        patchProposal: {
          path: srcFile,
          expected_hash: origHash,
          patch: faultyPatch
        },
        repairPatches: [
          {
            path: srcFile,
            patch: correctPatch
          }
        ],
        autoApprove: true,
        maxRepairBudget: 2
      });

      assert.equal(result.reproduced, true);
      assert.equal(result.verified, true, "Verification must succeed after repair attempt");
      assert.equal(result.repair_attempts, 1, "Must have used 1 repair attempt");
      assert.equal(result.status, "succeeded");

      // Verify disk content matches correct patch
      assert.equal(readFileSync(join(fixtureProjectDir, srcFile), "utf8"), correctPatch);

      // Verify repair events
      const events = runService.getEventsSince(run.uuid, 0);
      assert.ok(events.some((e) => e.event_type === "loop.repair_attempt"));
      assert.ok(events.some((e) => e.event_type === "run.succeeded"));
    });

    test("stops and marks failed when repair budget is exhausted without runaway iterations", async () => {
      const srcFile = "budget.js";
      const testFile = "budget.test.mjs";

      const originalSrc = "export const val = 0;\n";
      writeFileSync(join(fixtureProjectDir, srcFile), originalSrc, "utf8");
      const origHash = createHash("sha256").update(Buffer.from(originalSrc, "utf8")).digest("hex");

      const testCode = `import assert from "node:assert/strict";
import { val } from "./budget.js";
assert.equal(val, 999);
`;
      writeFileSync(join(fixtureProjectDir, testFile), testCode, "utf8");

      const run = runService.createRun({
        conversation_uuid: conversationUuid,
        project_uuid: projectUuid,
        mode: "work"
      });

      // Both initial and repair patches are faulty
      const faulty1 = "export const val = 1;\n";
      const faulty2 = "export const val = 2;\n";

      const result = await loopService.executeLoop({
        runUuid: run.uuid,
        projectRoot: fixtureProjectDir,
        testCommand: {
          executable: "node",
          args: [testFile]
        },
        patchProposal: {
          path: srcFile,
          expected_hash: origHash,
          patch: faulty1
        },
        repairPatches: [
          {
            path: srcFile,
            patch: faulty2
          }
        ],
        autoApprove: true,
        maxRepairBudget: 1 // Strict ceiling of 1 repair attempt
      });

      assert.equal(result.verified, false);
      assert.equal(result.repair_attempts, 1);
      assert.equal(result.status, "failed");

      const failedRun = runService.getRunByUuid(run.uuid);
      assert.equal(failedRun.state, "failed");
    });
  });

  describe("6. Invariant & Terminal State Guards (CONTRACTS.md Invariant 1)", () => {
    test("rejects executing coding loop on already terminal run with 409 InvalidStateError", async () => {
      const run = runService.createRun({
        conversation_uuid: conversationUuid,
        project_uuid: projectUuid,
        mode: "work"
      });

      // Force to succeeded terminal state
      runService.transitionState(run.uuid, "running");
      runService.transitionState(run.uuid, "succeeded");

      await assert.rejects(
        async () => {
          await loopService.executeLoop({
            runUuid: run.uuid,
            projectRoot: fixtureProjectDir,
            testCommand: {
              executable: "node",
              args: ["--version"]
            }
          });
        },
        (err) => {
          assert.equal(err instanceof InvalidStateError, true);
          assert.equal(err.statusCode, 409);
          return true;
        }
      );
    });
  });
});
