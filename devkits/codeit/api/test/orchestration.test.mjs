import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const distPath = resolve(process.cwd(), "dist/devkits/codeit/api");

// Compile TypeScript if needed before importing
if (!existsSync(join(distPath, "modules/orchestration/index.js"))) {
  execSync("npx tsc -p devkits/codeit/api/tsconfig.json", { stdio: "pipe" });
}

const {
  OrchestrationModule,
  OrchestrationService,
  OrchestrationRepository,
  createOrchestrationRoutes,
  pathsOverlap,
  normalizePathPattern,
  ConcurrencyLimitExceededError,
  DependencyUnsatisfiedError,
  PathLeaseConflictError,
  LeaseExpiredError,
  WorkerIsolationError,
  IntegrationConflictError,
  IntegrationHashMismatchError
} = await import(pathToFileURL(join(distPath, "modules/orchestration/index.js")).href);

const { CodeitDatabase, runMigrations } = await import(
  pathToFileURL(join(distPath, "storage/index.js")).href
);

const { ConversationModule } = await import(
  pathToFileURL(join(distPath, "modules/conversation/index.js")).href
);

const { ProjectModule } = await import(
  pathToFileURL(join(distPath, "modules/project/index.js")).href
);

const { RunModule } = await import(pathToFileURL(join(distPath, "modules/run/index.js")).href);

function sha256(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

describe("T09: Supervisor and Parallel Workers Orchestration Test Suite", () => {
  const testBaseDir = join(tmpdir(), `codeit-orchestration-test-${Date.now()}`);
  let codeitDb;
  let db;
  let orchestrationModule;
  let orchestrationService;
  let orchestrationRepo;
  let runModule;
  let runService;
  let projectUuid;
  let conversationUuid;
  let testRunUuid;

  before(() => {
    mkdirSync(testBaseDir, { recursive: true });
    codeitDb = new CodeitDatabase({ inMemory: true });
    db = codeitDb.db;
    runMigrations(db);

    const now = new Date().toISOString();
    projectUuid = "10000001";
    conversationUuid = "20000001";
    testRunUuid = "30000001";

    // Seed test project
    db.prepare(
      `
      INSERT INTO codeit_projects (uuid, name, root_path, trust_state, policy_revision, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      projectUuid,
      "Orchestration Test Project",
      resolve(testBaseDir, "proj"),
      "trusted",
      "1.0.0",
      now,
      now
    );

    // Seed test conversation
    db.prepare(
      `
      INSERT INTO codeit_conversations (uuid, project_uuid, title, selected_mode, archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(conversationUuid, projectUuid, "Orchestration Chat", "work", 0, now, now);

    // Seed test run
    db.prepare(
      `
      INSERT INTO codeit_runs (uuid, project_uuid, conversation_uuid, mode, state, cancellation_generation, budget, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(testRunUuid, projectUuid, conversationUuid, "work", "running", 0, "{}", now, now);

    runModule = new RunModule(db);
    runService = runModule.service;

    orchestrationModule = new OrchestrationModule(db, {
      maxConcurrency: 2,
      defaultLeaseDurationMs: 30000
    });
    orchestrationService = orchestrationModule.service;
    orchestrationRepo = orchestrationModule.repository;
  });

  after(() => {
    try {
      codeitDb?.close();
      rmSync(testBaseDir, { recursive: true, force: true });
    } catch {}
  });

  describe("1. Disjoint Path Lease Manager and Pattern Overlaps", () => {
    test("accurately detects overlapping and disjoint path patterns", () => {
      // Exact matches
      assert.strictEqual(pathsOverlap("src/modules/foo/bar.ts", "src/modules/foo/bar.ts"), true);
      assert.strictEqual(pathsOverlap("src/modules/foo/bar.ts", "src/modules/foo/baz.ts"), false);

      // Directory wildcard vs child file
      assert.strictEqual(pathsOverlap("src/modules/foo/**", "src/modules/foo/bar.ts"), true);
      assert.strictEqual(pathsOverlap("src/modules/foo/bar.ts", "src/modules/foo/**"), true);
      assert.strictEqual(pathsOverlap("src/modules/foo/**", "src/modules/bar/sub.ts"), false);

      // Sibling directories with wildcards (disjoint)
      assert.strictEqual(pathsOverlap("devkits/codeit/api/**", "devkits/codeit/src/**"), false);
      assert.strictEqual(pathsOverlap("packages/a/**", "packages/b/**"), false);

      // Nested wildcard containment
      assert.strictEqual(pathsOverlap("src/**", "src/modules/foo/**"), true);
      assert.strictEqual(pathsOverlap("src/modules/**", "src/**"), true);

      // Global wildcards
      assert.strictEqual(pathsOverlap("**", "src/modules/foo.ts"), true);
      assert.strictEqual(pathsOverlap("src/modules/foo.ts", "**"), true);
    });

    test("rejects conflicting path lease when another worker holds overlapping pattern", () => {
      // Worker A dispatches on src/modules/foo/**
      const dispatchA = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-PATH-01",
        worker_id: "worker-path-a",
        allowed_paths: ["src/modules/foo/**"],
        lease_duration_ms: 30000
      });
      assert.ok(dispatchA.assignment.uuid);

      // Worker B attempts to dispatch on child file src/modules/foo/bar.ts
      assert.throws(
        () => {
          orchestrationService.dispatch({
            run_uuid: testRunUuid,
            task_id: "T-PATH-02",
            worker_id: "worker-path-b",
            allowed_paths: ["src/modules/foo/bar.ts"],
            lease_duration_ms: 30000
          });
        },
        (err) => {
          assert.ok(err instanceof PathLeaseConflictError);
          assert.strictEqual(err.code, "CODEIT_LEASE_CONFLICT");
          return true;
        }
      );

      // Worker C dispatches on completely disjoint path src/modules/bar/** -> succeeds!
      const dispatchC = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-PATH-03",
        worker_id: "worker-path-c",
        allowed_paths: ["src/modules/bar/**"],
        lease_duration_ms: 30000
      });
      assert.ok(dispatchC.assignment.uuid);

      // Clean up for next tests
      orchestrationService.completeAssignment(dispatchA.assignment.uuid, {
        worker_id: "worker-path-a"
      });
      orchestrationService.completeAssignment(dispatchC.assignment.uuid, {
        worker_id: "worker-path-c"
      });
    });
  });

  describe("2. Bounded Concurrency Limit Enforcement (DEC-07)", () => {
    test("enforces default maximum of 2 concurrent implementation workers", () => {
      // Dispatch Worker 1
      const res1 = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-CONCUR-01",
        worker_id: "worker-c1",
        allowed_paths: ["dir-c1/**"]
      });
      assert.strictEqual(res1.active_worker_count, 1);
      assert.strictEqual(res1.max_concurrency, 2);

      // Dispatch Worker 2
      const res2 = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-CONCUR-02",
        worker_id: "worker-c2",
        allowed_paths: ["dir-c2/**"]
      });
      assert.strictEqual(res2.active_worker_count, 2);

      // Dispatch Worker 3 -> must be rejected due to capacity bound (limit: 2, active: 2)
      assert.throws(
        () => {
          orchestrationService.dispatch({
            run_uuid: testRunUuid,
            task_id: "T-CONCUR-03",
            worker_id: "worker-c3",
            allowed_paths: ["dir-c3/**"]
          });
        },
        (err) => {
          assert.ok(err instanceof ConcurrencyLimitExceededError);
          assert.strictEqual(err.code, "CODEIT_CONCURRENCY_EXCEEDED");
          assert.strictEqual(err.statusCode, 429);
          return true;
        }
      );

      // Worker 1 completes -> active count drops to 1
      orchestrationService.completeAssignment(res1.assignment.uuid, {
        worker_id: "worker-c1"
      });

      // Now Worker 3 dispatch must succeed!
      const res3 = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-CONCUR-03",
        worker_id: "worker-c3",
        allowed_paths: ["dir-c3/**"]
      });
      assert.strictEqual(res3.active_worker_count, 2);

      // Clean up
      orchestrationService.completeAssignment(res2.assignment.uuid, { worker_id: "worker-c2" });
      orchestrationService.completeAssignment(res3.assignment.uuid, { worker_id: "worker-c3" });
    });
  });

  describe("3. Dependency Graph Validator", () => {
    test("rejects dispatch if prerequisite task is unrecorded, active, or failed", () => {
      // 1. Missing / unrecorded prerequisite
      assert.throws(
        () => {
          orchestrationService.dispatch({
            run_uuid: testRunUuid,
            task_id: "T-DEP-02",
            worker_id: "worker-dep",
            dependencies: ["T-NONEXISTENT"],
            allowed_paths: ["dir-dep/**"]
          });
        },
        (err) => {
          assert.ok(err instanceof DependencyUnsatisfiedError);
          assert.strictEqual(err.code, "CODEIT_DEPENDENCY_UNSATISFIED");
          assert.match(err.message, /has not been recorded/);
          return true;
        }
      );

      // 2. Prerequisite is currently active / in progress
      const depPrereq = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-DEP-PREREQ-1",
        worker_id: "worker-p1",
        allowed_paths: ["dir-prereq-1/**"]
      });

      assert.throws(
        () => {
          orchestrationService.dispatch({
            run_uuid: testRunUuid,
            task_id: "T-DEP-DEPENDENT-1",
            worker_id: "worker-dep1",
            dependencies: ["T-DEP-PREREQ-1"],
            allowed_paths: ["dir-dependent-1/**"]
          });
        },
        (err) => {
          assert.ok(err instanceof DependencyUnsatisfiedError);
          assert.match(err.message, /is not completed/);
          return true;
        }
      );

      // 3. Prerequisite fails
      orchestrationService.failAssignment(depPrereq.assignment.uuid, {
        worker_id: "worker-p1",
        error: { code: "CODEIT_BUILD_FAILED", message: "Compilation failure in task 1" }
      });

      assert.throws(
        () => {
          orchestrationService.dispatch({
            run_uuid: testRunUuid,
            task_id: "T-DEP-DEPENDENT-1",
            worker_id: "worker-dep1",
            dependencies: ["T-DEP-PREREQ-1"],
            allowed_paths: ["dir-dependent-1/**"]
          });
        },
        (err) => {
          assert.ok(err instanceof DependencyUnsatisfiedError);
          assert.match(err.message, /current state: 'failed'/);
          return true;
        }
      );

      // 4. Successful prerequisite completion unlocks dependent dispatch
      const depPrereq2 = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-DEP-PREREQ-2",
        worker_id: "worker-p2",
        allowed_paths: ["dir-prereq-2/**"]
      });

      orchestrationService.completeAssignment(depPrereq2.assignment.uuid, {
        worker_id: "worker-p2",
        result_artifact: { artifact_type: "diff", content: "diff payload" }
      });

      const depSuccess = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-DEP-DEPENDENT-2",
        worker_id: "worker-dep2",
        dependencies: ["T-DEP-PREREQ-2"],
        allowed_paths: ["dir-dependent-2/**"]
      });

      assert.ok(depSuccess.assignment.uuid);
      assert.strictEqual(depSuccess.assignment.state, "active");
      orchestrationService.completeAssignment(depSuccess.assignment.uuid, {
        worker_id: "worker-dep2"
      });
    });
  });

  describe("4. Lease Expiry, Heartbeats, and Capacity Recovery", () => {
    test("heartbeat renews lease expiry timestamp", () => {
      const dispatch = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-HB-01",
        worker_id: "worker-hb",
        allowed_paths: ["dir-hb/**"],
        lease_duration_ms: 10000
      });

      const initialExpiry = dispatch.lease_expiry;

      // Renew heartbeat
      const hbResult = orchestrationService.heartbeat(dispatch.assignment.uuid, {
        worker_id: "worker-hb",
        extend_by_ms: 25000
      });

      assert.ok(new Date(hbResult.lease_expiry).getTime() > new Date(initialExpiry).getTime());
      orchestrationService.completeAssignment(dispatch.assignment.uuid, { worker_id: "worker-hb" });
    });

    test("missed heartbeat causes lease expiry and frees held path lease", async () => {
      // Dispatch worker with very short 50ms lease
      const dispatch = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-EXPIRE-01",
        worker_id: "worker-exp",
        allowed_paths: ["dir-exclusive/**"],
        lease_duration_ms: 50
      });

      // Wait 100ms for lease to expire
      await new Promise((r) => setTimeout(r, 100));

      // 1. Worker heartbeat after expiry is rejected with CODEIT_LEASE_EXPIRED
      assert.throws(
        () => {
          orchestrationService.heartbeat(dispatch.assignment.uuid, {
            worker_id: "worker-exp"
          });
        },
        (err) => {
          assert.ok(err instanceof LeaseExpiredError);
          assert.strictEqual(err.code, "CODEIT_LEASE_EXPIRED");
          return true;
        }
      );

      // Assignment was transitioned to expired
      const expiredRecord = orchestrationRepo.findByUuid(dispatch.assignment.uuid);
      assert.strictEqual(expiredRecord.state, "expired");

      // 2. Test pruneExpiredLeases on an assignment that missed heartbeat without calling heartbeat
      const dispatchUnchecked = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-EXPIRE-02",
        worker_id: "worker-exp2",
        allowed_paths: ["dir-unchecked/**"],
        lease_duration_ms: 50
      });

      await new Promise((r) => setTimeout(r, 100));

      const pruned = orchestrationService.pruneExpiredLeases(testRunUuid);
      assert.ok(pruned.some((a) => a.uuid === dispatchUnchecked.assignment.uuid));
      assert.strictEqual(
        orchestrationRepo.findByUuid(dispatchUnchecked.assignment.uuid).state,
        "expired"
      );

      // 3. Path 'dir-exclusive/**' is now free for another worker to lease!
      const newDispatch = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-EXPIRE-REPLACEMENT",
        worker_id: "worker-new",
        allowed_paths: ["dir-exclusive/**"]
      });
      assert.ok(newDispatch.assignment.uuid);
      orchestrationService.completeAssignment(newDispatch.assignment.uuid, {
        worker_id: "worker-new"
      });
    });
  });

  describe("5. Run Cancellation and Generation Fencing (E10)", () => {
    test("cancelling run immediately cancels active assignments and fences stale workers", () => {
      // Create dedicated run for cancellation testing
      const cancelRunUuid = "30000099";
      const now = new Date().toISOString();
      db.prepare(
        `
        INSERT INTO codeit_runs (uuid, project_uuid, conversation_uuid, mode, state, cancellation_generation, budget, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(cancelRunUuid, projectUuid, conversationUuid, "work", "running", 0, "{}", now, now);

      const workerAssigned = orchestrationService.dispatch({
        run_uuid: cancelRunUuid,
        task_id: "T-CANCEL-01",
        worker_id: "worker-cancel-target",
        allowed_paths: ["dir-cancel/**"]
      });
      assert.strictEqual(workerAssigned.assignment.state, "active");

      // Cancel the run via runService (simulating operator cancellation)
      runService.cancelRun(cancelRunUuid, "User triggered emergency cancel");

      // Notify orchestration of cancellation
      orchestrationService.handleRunCancellation(cancelRunUuid);

      // Verify assignment was immediately transitioned to 'cancelled'
      const updated = orchestrationRepo.findByUuid(workerAssigned.assignment.uuid);
      assert.strictEqual(updated.state, "cancelled");

      // Worker attempting heartbeat is rejected
      assert.throws(
        () => {
          orchestrationService.heartbeat(workerAssigned.assignment.uuid, {
            worker_id: "worker-cancel-target"
          });
        },
        (err) => {
          assert.ok(err instanceof LeaseExpiredError || err.code === "CODEIT_LEASE_EXPIRED");
          return true;
        }
      );

      // Worker attempting completion is rejected
      assert.throws(
        () => {
          orchestrationService.completeAssignment(workerAssigned.assignment.uuid, {
            worker_id: "worker-cancel-target"
          });
        },
        (err) => {
          assert.ok(err instanceof LeaseExpiredError || err.code === "CODEIT_LEASE_EXPIRED");
          return true;
        }
      );

      // New dispatches to cancelled run are rejected
      assert.throws(
        () => {
          orchestrationService.dispatch({
            run_uuid: cancelRunUuid,
            task_id: "T-CANCEL-02",
            worker_id: "worker-denied",
            allowed_paths: ["dir-new/**"]
          });
        },
        (err) => {
          assert.strictEqual(err.code, "CODEIT_INVALID_STATE");
          return true;
        }
      );
    });
  });

  describe("6. Worker Isolation Guards: Prevention of Child-Worker Delegation & Self-Approval", () => {
    test("worker cannot dispatch sub-workers (lacks dispatch grant)", () => {
      assert.throws(
        () => {
          orchestrationService.dispatch({
            run_uuid: testRunUuid,
            task_id: "T-CHILD-01",
            worker_id: "worker-rogue",
            allowed_paths: ["dir-child/**"],
            caller_role: "worker" // Attempting to dispatch as worker
          });
        },
        (err) => {
          assert.ok(err instanceof WorkerIsolationError);
          assert.strictEqual(err.code, "CODEIT_WORKER_ISOLATION_VIOLATION");
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /Workers lack dispatch grant/);
          return true;
        }
      );
    });

    test("worker cannot accept its own completion claim as independent review", () => {
      const assignment = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-SELF-APPROVE",
        worker_id: "worker-self",
        allowed_paths: ["dir-self/**"]
      });

      // Self-approval attempt is rejected
      assert.throws(
        () => {
          orchestrationService.completeAssignment(assignment.assignment.uuid, {
            worker_id: "worker-self",
            caller_role: "worker",
            self_approved: true
          });
        },
        (err) => {
          assert.ok(err instanceof WorkerIsolationError);
          assert.strictEqual(err.code, "CODEIT_WORKER_ISOLATION_VIOLATION");
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /A worker cannot accept its own completion claim/);
          return true;
        }
      );

      // Normal completion without self-approval succeeds
      const completed = orchestrationService.completeAssignment(assignment.assignment.uuid, {
        worker_id: "worker-self",
        caller_role: "worker",
        self_approved: false,
        result_artifact: { artifact_type: "diff", content: "valid diff" }
      });
      assert.strictEqual(completed.state, "completed");
    });

    test("worker ID mismatch is rejected", () => {
      const assignment = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-MISMATCH-01",
        worker_id: "worker-authorized",
        allowed_paths: ["dir-mismatch/**"]
      });

      assert.throws(
        () => {
          orchestrationService.heartbeat(assignment.assignment.uuid, {
            worker_id: "worker-impostor"
          });
        },
        (err) => {
          assert.ok(err instanceof WorkerIsolationError);
          assert.strictEqual(err.code, "CODEIT_WORKER_ISOLATION_VIOLATION");
          return true;
        }
      );

      orchestrationService.completeAssignment(assignment.assignment.uuid, {
        worker_id: "worker-authorized"
      });
    });
  });

  describe("7. Parallel Execution and Integration Gate with Sequential Pre-Apply SHA-256 Validation", () => {
    test("successfully merges parallel worker artifacts with fresh SHA-256 pre-apply validation", async () => {
      // Setup parallel tasks on disjoint paths
      const dispatchA = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-INT-A",
        worker_id: "worker-int-a",
        allowed_paths: ["packages/module-a/**"]
      });

      const dispatchB = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-INT-B",
        worker_id: "worker-int-b",
        allowed_paths: ["packages/module-b/**"]
      });

      // Both workers execute concurrently
      assert.strictEqual(orchestrationRepo.countActiveAssignments(testRunUuid), 2);

      // Base initial workspace files
      const baseFileA = "export const moduleA = 'version 1.0.0';\n";
      const baseFileB = "export const moduleB = 'version 1.0.0';\n";

      const hashBaseA = sha256(baseFileA);
      const hashBaseB = sha256(baseFileB);

      const newContentA = "export const moduleA = 'version 2.0.0'; // updated by worker A\n";
      const newContentB = "export const moduleB = 'version 2.0.0'; // updated by worker B\n";

      // Worker A completes
      orchestrationService.completeAssignment(dispatchA.assignment.uuid, {
        worker_id: "worker-int-a",
        result_artifact: { artifact_type: "diff", content: newContentA },
        changed_files: ["packages/module-a/index.ts"]
      });

      // Worker B completes
      orchestrationService.completeAssignment(dispatchB.assignment.uuid, {
        worker_id: "worker-int-b",
        result_artifact: { artifact_type: "diff", content: newContentB },
        changed_files: ["packages/module-b/index.ts"]
      });

      // Integration Gate invocation
      const integrationResult = await orchestrationService.integrateArtifacts({
        run_uuid: testRunUuid,
        assignment_uuids: [dispatchA.assignment.uuid, dispatchB.assignment.uuid],
        patches: [
          {
            path: "packages/module-a/index.ts",
            expected_hash: hashBaseA,
            new_content: newContentA
          },
          {
            path: "packages/module-b/index.ts",
            expected_hash: hashBaseB,
            new_content: newContentB
          }
        ],
        workspace_files: {
          "packages/module-a/index.ts": baseFileA,
          "packages/module-b/index.ts": baseFileB
        }
      });

      assert.strictEqual(integrationResult.success, true);
      assert.strictEqual(integrationResult.applied_files.length, 2);
      assert.strictEqual(
        integrationResult.resulting_files["packages/module-a/index.ts"],
        newContentA
      );
      assert.strictEqual(
        integrationResult.resulting_files["packages/module-b/index.ts"],
        newContentB
      );
      assert.ok(integrationResult.combined_hash);
    });

    test("integration gate rejects conflicting concurrent modifications to the same file", async () => {
      const dispatchA = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-CONF-A",
        worker_id: "worker-conf-a",
        allowed_paths: ["shared/file.ts"]
      });
      orchestrationService.completeAssignment(dispatchA.assignment.uuid, {
        worker_id: "worker-conf-a"
      });

      const baseContent = "const shared = 1;\n";
      const baseHash = sha256(baseContent);

      await assert.rejects(
        async () => {
          await orchestrationService.integrateArtifacts({
            run_uuid: testRunUuid,
            assignment_uuids: [dispatchA.assignment.uuid],
            patches: [
              {
                path: "shared/file.ts",
                expected_hash: baseHash,
                new_content: "const shared = 2;\n"
              },
              {
                path: "shared/file.ts",
                expected_hash: baseHash,
                new_content: "const shared = 3;\n"
              }
            ],
            workspace_files: { "shared/file.ts": baseContent }
          });
        },
        (err) => {
          assert.ok(err instanceof IntegrationConflictError);
          assert.strictEqual(err.code, "CODEIT_INTEGRATION_CONFLICT");
          return true;
        }
      );
    });

    test("integration gate rejects patch when base file SHA-256 hash does not match expected_hash", async () => {
      const dispatch = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-HASH-01",
        worker_id: "worker-hash",
        allowed_paths: ["packages/drift/**"]
      });
      orchestrationService.completeAssignment(dispatch.assignment.uuid, {
        worker_id: "worker-hash"
      });

      const actualCurrentContent = "const current = 'modified externally';\n";
      const staleExpectedHash = sha256("const old = 'stale version';\n");

      await assert.rejects(
        async () => {
          await orchestrationService.integrateArtifacts({
            run_uuid: testRunUuid,
            assignment_uuids: [dispatch.assignment.uuid],
            patches: [
              {
                path: "packages/drift/file.ts",
                expected_hash: staleExpectedHash,
                new_content: "const updated = 1;\n"
              }
            ],
            workspace_files: { "packages/drift/file.ts": actualCurrentContent }
          });
        },
        (err) => {
          assert.ok(err instanceof IntegrationHashMismatchError);
          assert.strictEqual(err.code, "CODEIT_HASH_MISMATCH");
          assert.strictEqual(err.statusCode, 409);
          return true;
        }
      );
    });
  });

  describe("8. HTTP Route Handlers Contract Verification", () => {
    test("GET /api/codeit/assignments returns assignments list for run", async () => {
      const routes = createOrchestrationRoutes(orchestrationService);
      const listRoute = routes.find(
        (r) => r.method === "GET" && r.path === "/api/codeit/assignments"
      );
      assert.ok(listRoute);

      const query = new URLSearchParams({ run_uuid: testRunUuid });
      const result = await listRoute.handler(null, null, {
        params: {},
        query,
        body: null,
        correlationId: "test-c1"
      });

      assert.ok(Array.isArray(result.items));
      assert.ok(result.items.length > 0);
    });

    test("POST /api/codeit/assignments/dispatch dispatches new assignment via route", async () => {
      const routes = createOrchestrationRoutes(orchestrationService);
      const dispatchRoute = routes.find(
        (r) => r.method === "POST" && r.path === "/api/codeit/assignments/dispatch"
      );
      assert.ok(dispatchRoute);

      const result = await dispatchRoute.handler(null, null, {
        params: {},
        query: new URLSearchParams(),
        body: {
          run_uuid: testRunUuid,
          task_id: "T-ROUTE-01",
          worker_id: "worker-route",
          allowed_paths: ["route/test/**"]
        },
        correlationId: "test-c2"
      });

      assert.ok(result.assignment);
      assert.strictEqual(result.assignment.task_id, "T-ROUTE-01");
      assert.ok(result.lease_token);

      // Clean up
      orchestrationService.completeAssignment(result.assignment.uuid, {
        worker_id: "worker-route"
      });
    });

    test("POST /api/codeit/assignments/:uuid/heartbeat renews lease via route", async () => {
      const routes = createOrchestrationRoutes(orchestrationService);
      const heartbeatRoute = routes.find(
        (r) => r.method === "POST" && r.path === "/api/codeit/assignments/:uuid/heartbeat"
      );
      assert.ok(heartbeatRoute);

      const dispatch = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-ROUTE-HB",
        worker_id: "worker-route-hb",
        allowed_paths: ["route/hb/**"]
      });

      const result = await heartbeatRoute.handler(null, null, {
        params: { uuid: dispatch.assignment.uuid },
        query: new URLSearchParams(),
        body: { worker_id: "worker-route-hb", extend_by_ms: 15000 },
        correlationId: "test-c3"
      });

      assert.ok(result.lease_expiry);
      orchestrationService.completeAssignment(dispatch.assignment.uuid, {
        worker_id: "worker-route-hb"
      });
    });

    test("POST /api/codeit/assignments/:uuid/fail reports failure via route", async () => {
      const routes = createOrchestrationRoutes(orchestrationService);
      const failRoute = routes.find(
        (r) => r.method === "POST" && r.path === "/api/codeit/assignments/:uuid/fail"
      );
      assert.ok(failRoute);

      const dispatch = orchestrationService.dispatch({
        run_uuid: testRunUuid,
        task_id: "T-ROUTE-FAIL",
        worker_id: "worker-route-fail",
        allowed_paths: ["route/fail/**"]
      });

      const result = await failRoute.handler(null, null, {
        params: { uuid: dispatch.assignment.uuid },
        query: new URLSearchParams(),
        body: {
          worker_id: "worker-route-fail",
          error: { code: "CODEIT_CRASH", message: "Process terminated unexpectedly" }
        },
        correlationId: "test-c4"
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.assignment.state, "failed");
    });
  });
});
