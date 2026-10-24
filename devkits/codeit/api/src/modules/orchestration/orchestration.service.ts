import { createHash, randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { InvalidStateError, NotFoundError } from "../../errors.js";
import type { OrchestrationRepository } from "./orchestration.repository.js";
import {
  type AssignmentRecord,
  type CompleteAssignmentRequest,
  ConcurrencyLimitExceededError,
  DependencyUnsatisfiedError,
  type DispatchRequest,
  type DispatchResult,
  type FailAssignmentRequest,
  type IntegrationGateInput,
  type IntegrationGateResult,
  IntegrationConflictError,
  IntegrationHashMismatchError,
  LeaseExpiredError,
  type PathLease,
  PathLeaseConflictError,
  type WorkerHeartbeat,
  WorkerIsolationError
} from "./orchestration.types.js";

export function normalizePathPattern(p: string): string {
  let norm = p.replace(/\\/g, "/").trim();
  if (norm.startsWith("./")) {
    norm = norm.slice(2);
  }
  norm = norm.replace(/^\/+/, "");
  norm = norm.replace(/\/+$/, "");
  return norm;
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/\\/g, "/")
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "::DOUBLE_STAR::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DOUBLE_STAR::/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function pathsOverlap(patternA: string, patternB: string): boolean {
  const pA = normalizePathPattern(patternA);
  const pB = normalizePathPattern(patternB);

  if (pA === pB) return true;
  if (pA === "**" || pA === "*" || pB === "**" || pB === "*") return true;

  const isWildcardA = pA.endsWith("/**") || pA.endsWith("/*");
  const isWildcardB = pB.endsWith("/**") || pB.endsWith("/*");

  const baseA = pA.replace(/\/\*\*?$/, "");
  const baseB = pB.replace(/\/\*\*?$/, "");

  if (isWildcardA && isWildcardB) {
    if (baseA === baseB) return true;
    if (baseA.startsWith(baseB + "/")) return true;
    if (baseB.startsWith(baseA + "/")) return true;
  } else if (isWildcardA) {
    if (pB === baseA || pB.startsWith(baseA + "/")) return true;
  } else if (isWildcardB) {
    if (pA === baseB || pA.startsWith(baseB + "/")) return true;
  }

  if (pA.includes("*") || pB.includes("*")) {
    const regexA = globToRegex(pA);
    const regexB = globToRegex(pB);

    if (regexA.test(pB) || regexB.test(pA)) return true;
  }

  return false;
}

export function generateHexUuid(): string {
  return randomBytes(4).toString("hex");
}

export function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export interface OrchestrationServiceOptions {
  maxConcurrency?: number | undefined;
  defaultLeaseDurationMs?: number | undefined;
}

export class OrchestrationService {
  private readonly maxConcurrency: number;
  private readonly defaultLeaseDurationMs: number;

  constructor(
    private readonly repository: OrchestrationRepository,
    private readonly db?: DatabaseSync | undefined,
    options?: OrchestrationServiceOptions
  ) {
    this.maxConcurrency = options?.maxConcurrency ?? 2;
    this.defaultLeaseDurationMs = options?.defaultLeaseDurationMs ?? 30000;
  }

  getMaxConcurrency(): number {
    return this.maxConcurrency;
  }

  pruneExpiredLeases(run_uuid?: string): AssignmentRecord[] {
    const now = new Date().toISOString();
    return this.repository.markExpiredLeases(now, run_uuid);
  }

  getActivePathLeases(run_uuid?: string): PathLease[] {
    this.pruneExpiredLeases(run_uuid);
    return this.repository.queryActiveLeases(run_uuid);
  }

  getAssignmentsForRun(run_uuid: string): AssignmentRecord[] {
    this.pruneExpiredLeases(run_uuid);
    return this.repository.findAssignmentsByRun(run_uuid);
  }

  getAssignmentByUuid(uuid: string): AssignmentRecord {
    this.pruneExpiredLeases();
    const assignment = this.repository.findByUuid(uuid);
    if (!assignment) {
      throw new NotFoundError(`Assignment ${uuid} not found`);
    }
    return assignment;
  }

  private checkRunGenerationFence(runUuid: string): { runState: string; generation: number } {
    const runBrief = this.repository.getRunBrief(runUuid);
    if (!runBrief) {
      return { runState: "active", generation: 0 };
    }

    if (
      runBrief.state === "cancelled" ||
      runBrief.state === "cancelling" ||
      runBrief.state === "failed"
    ) {
      this.repository.cancelActiveAssignmentsForRun(runUuid);
      throw new InvalidStateError(
        `Run ${runUuid} is in terminal state '${runBrief.state}'. Active assignments have been fenced.`,
        409,
        { run_uuid: runUuid, state: runBrief.state, generation: runBrief.cancellation_generation }
      );
    }

    return { runState: runBrief.state, generation: runBrief.cancellation_generation };
  }

  dispatch(req: DispatchRequest): DispatchResult {
    // 1. Worker isolation guard: a worker cannot dispatch sub-workers
    if (req.caller_role === "worker") {
      throw new WorkerIsolationError(
        "Workers lack dispatch grant to spawn sub-workers (DEC-09, SUPERVISOR-WORKERS.md)",
        { caller_role: req.caller_role, task_id: req.task_id, worker_id: req.worker_id }
      );
    }

    // 2. Prune expired leases first to free stale capacity
    this.pruneExpiredLeases(req.run_uuid);

    // 3. Generation fencing: check run cancellation state
    const { generation } = this.checkRunGenerationFence(req.run_uuid);

    // 4. Bounded concurrency: maximum concurrent active implementation workers
    const activeCount = this.repository.countActiveAssignments(req.run_uuid);
    if (activeCount >= this.maxConcurrency) {
      throw new ConcurrencyLimitExceededError(
        `Maximum concurrent workers reached (limit: ${this.maxConcurrency}, active: ${activeCount})`,
        {
          run_uuid: req.run_uuid,
          active_workers: activeCount,
          max_concurrency: this.maxConcurrency
        }
      );
    }

    // 5. Dependency graph validator: verify prerequisite tasks are completed
    if (req.dependencies && req.dependencies.length > 0) {
      for (const depTaskId of req.dependencies) {
        const depAssignment = this.repository.findByRunAndTaskId(req.run_uuid, depTaskId);
        if (!depAssignment) {
          throw new DependencyUnsatisfiedError(
            `Prerequisite task '${depTaskId}' has not been recorded or dispatched for run '${req.run_uuid}'`,
            { run_uuid: req.run_uuid, task_id: req.task_id, missing_dependency: depTaskId }
          );
        }

        if (depAssignment.state !== "completed") {
          throw new DependencyUnsatisfiedError(
            `Prerequisite task '${depTaskId}' is not completed (current state: '${depAssignment.state}')`,
            {
              run_uuid: req.run_uuid,
              task_id: req.task_id,
              prerequisite: depTaskId,
              prerequisite_state: depAssignment.state
            }
          );
        }
      }
    }

    // 6. Disjoint path lease manager: detect overlapping path leases
    const activeLeases = this.repository.queryActiveLeases(req.run_uuid);
    for (const reqPath of req.allowed_paths) {
      for (const activeLease of activeLeases) {
        if (pathsOverlap(reqPath, activeLease.path_pattern)) {
          throw new PathLeaseConflictError(
            `Path pattern '${reqPath}' conflicts with active lease on '${activeLease.path_pattern}' held by worker '${activeLease.worker_id}' (task: '${activeLease.task_id}')`,
            {
              requested_path: reqPath,
              conflicting_lease: activeLease
            }
          );
        }
      }
    }

    // 7. Create assignment record
    const uuid = generateHexUuid();
    const leaseDuration = req.lease_duration_ms ?? this.defaultLeaseDurationMs;
    const now = new Date();
    const nowIso = now.toISOString();
    const leaseExpiry = new Date(now.getTime() + leaseDuration).toISOString();

    const created = this.repository.createAssignment({
      uuid,
      run_uuid: req.run_uuid,
      task_id: req.task_id,
      worker_id: req.worker_id,
      dependencies: req.dependencies ?? [],
      lease_generation: generation,
      lease_expiry: leaseExpiry,
      allowed_paths: req.allowed_paths,
      attempt: req.attempt ?? 1,
      state: "active",
      result_payload: null,
      error_payload: null,
      created_at: nowIso,
      updated_at: nowIso
    });

    const activeWorkerCount = this.repository.countActiveAssignments(req.run_uuid);

    return {
      assignment: created,
      lease_token: `${uuid}-${generation}`,
      lease_expiry: leaseExpiry,
      active_worker_count: activeWorkerCount,
      max_concurrency: this.maxConcurrency
    };
  }

  heartbeat(
    assignmentUuid: string,
    heartbeat: WorkerHeartbeat
  ): { assignment: AssignmentRecord; lease_expiry: string } {
    const assignment = this.repository.findByUuid(assignmentUuid);
    if (!assignment) {
      throw new NotFoundError(`Assignment ${assignmentUuid} not found`);
    }

    // Worker isolation: verify worker ID
    if (assignment.worker_id !== heartbeat.worker_id) {
      throw new WorkerIsolationError(
        `Worker ID mismatch: expected '${assignment.worker_id}', got '${heartbeat.worker_id}'`,
        {
          assignment_uuid: assignmentUuid,
          expected: assignment.worker_id,
          actual: heartbeat.worker_id
        }
      );
    }

    // Generation fencing: verify run state
    const runBrief = this.repository.getRunBrief(assignment.run_uuid);
    if (runBrief) {
      if (
        runBrief.state === "cancelled" ||
        runBrief.state === "cancelling" ||
        runBrief.state === "failed"
      ) {
        this.repository.transitionState(assignmentUuid, "cancelled");
        throw new LeaseExpiredError(
          `Run ${assignment.run_uuid} has been cancelled. Lease revoked.`,
          { assignment_uuid: assignmentUuid, run_state: runBrief.state }
        );
      }

      if (runBrief.cancellation_generation > assignment.lease_generation) {
        this.repository.transitionState(assignmentUuid, "cancelled");
        throw new LeaseExpiredError(
          `Worker lease was fenced by newer run cancellation generation (current: ${runBrief.cancellation_generation}, lease: ${assignment.lease_generation})`,
          {
            assignment_uuid: assignmentUuid,
            current_generation: runBrief.cancellation_generation,
            lease_generation: assignment.lease_generation
          }
        );
      }
    }

    // Expiry check
    const now = Date.now();
    const currentExpiryTime = new Date(assignment.lease_expiry).getTime();
    if (currentExpiryTime <= now) {
      this.repository.transitionState(assignmentUuid, "expired");
      throw new LeaseExpiredError(
        `Worker lease for assignment ${assignmentUuid} expired at ${assignment.lease_expiry}`,
        { assignment_uuid: assignmentUuid, expired_at: assignment.lease_expiry }
      );
    }

    // State check
    if (assignment.state !== "active" && assignment.state !== "assigned") {
      throw new InvalidStateError(
        `Cannot renew heartbeat for assignment in '${assignment.state}' state`,
        409,
        { assignment_uuid: assignmentUuid, state: assignment.state }
      );
    }

    const extendBy = heartbeat.extend_by_ms ?? this.defaultLeaseDurationMs;
    const newExpiry = new Date(now + extendBy).toISOString();

    const updated = this.repository.updateHeartbeat(assignmentUuid, newExpiry);

    return {
      assignment: updated,
      lease_expiry: newExpiry
    };
  }

  completeAssignment(assignmentUuid: string, req: CompleteAssignmentRequest): AssignmentRecord {
    const assignment = this.repository.findByUuid(assignmentUuid);
    if (!assignment) {
      throw new NotFoundError(`Assignment ${assignmentUuid} not found`);
    }

    // Worker isolation check: a worker cannot self-approve completion
    if (req.self_approved) {
      throw new WorkerIsolationError(
        "A worker cannot accept its own completion claim as independent review (DEC-09, SUPERVISOR-WORKERS.md)",
        { assignment_uuid: assignmentUuid, worker_id: req.worker_id, caller_role: req.caller_role }
      );
    }

    // Verify worker identity
    if (req.caller_role === "worker" && assignment.worker_id !== req.worker_id) {
      throw new WorkerIsolationError(
        `Worker ID mismatch: expected '${assignment.worker_id}', got '${req.worker_id}'`,
        { assignment_uuid: assignmentUuid, expected: assignment.worker_id, actual: req.worker_id }
      );
    }

    // Check generation fencing
    const runBrief = this.repository.getRunBrief(assignment.run_uuid);
    if (runBrief) {
      if (
        runBrief.state === "cancelled" ||
        runBrief.state === "cancelling" ||
        runBrief.state === "failed"
      ) {
        this.repository.transitionState(assignmentUuid, "cancelled");
        throw new LeaseExpiredError(
          `Run ${assignment.run_uuid} has been cancelled. Late results cannot be accepted.`,
          { assignment_uuid: assignmentUuid, run_state: runBrief.state }
        );
      }

      if (runBrief.cancellation_generation > assignment.lease_generation) {
        this.repository.transitionState(assignmentUuid, "cancelled");
        throw new LeaseExpiredError(
          `Worker assignment fenced by newer run generation. Result rejected.`,
          { assignment_uuid: assignmentUuid, current_generation: runBrief.cancellation_generation }
        );
      }
    }

    // Check expiry
    if (new Date(assignment.lease_expiry).getTime() < Date.now()) {
      this.repository.transitionState(assignmentUuid, "expired");
      throw new LeaseExpiredError(
        `Worker lease expired before completion was reported (expired at: ${assignment.lease_expiry})`,
        { assignment_uuid: assignmentUuid, expired_at: assignment.lease_expiry }
      );
    }

    if (assignment.state !== "active" && assignment.state !== "assigned") {
      throw new InvalidStateError(
        `Cannot complete assignment in state '${assignment.state}'`,
        409,
        { assignment_uuid: assignmentUuid, state: assignment.state }
      );
    }

    const resultPayload: Record<string, unknown> = {
      completed_at: new Date().toISOString(),
      completed_by: req.worker_id,
      caller_role: req.caller_role ?? "worker",
      result_artifact: req.result_artifact ?? null,
      diff: req.diff ?? null,
      changed_files: req.changed_files ?? []
    };

    return this.repository.transitionState(assignmentUuid, "completed", {
      result_payload: resultPayload
    });
  }

  failAssignment(assignmentUuid: string, req: FailAssignmentRequest): AssignmentRecord {
    const assignment = this.repository.findByUuid(assignmentUuid);
    if (!assignment) {
      throw new NotFoundError(`Assignment ${assignmentUuid} not found`);
    }

    if (assignment.state === "completed") {
      throw new InvalidStateError(
        `Cannot fail assignment ${assignmentUuid}: already in completed state`,
        409,
        { assignment_uuid: assignmentUuid }
      );
    }

    const errorPayload: Record<string, unknown> = {
      failed_at: new Date().toISOString(),
      failed_by: req.worker_id,
      error: req.error
    };

    return this.repository.transitionState(assignmentUuid, "failed", {
      error_payload: errorPayload
    });
  }

  handleRunCancellation(runUuid: string): number {
    return this.repository.cancelActiveAssignmentsForRun(runUuid);
  }

  async integrateArtifacts(input: IntegrationGateInput): Promise<IntegrationGateResult> {
    const runBrief = this.repository.getRunBrief(input.run_uuid);
    if (runBrief && (runBrief.state === "cancelled" || runBrief.state === "failed")) {
      throw new InvalidStateError(
        `Cannot run integration gate: run ${input.run_uuid} is in '${runBrief.state}' state`,
        409
      );
    }

    // 1. Validate all requested assignments are completed
    for (const uuid of input.assignment_uuids) {
      const assignment = this.repository.findByUuid(uuid);
      if (!assignment) {
        throw new NotFoundError(`Assignment ${uuid} not found for integration`);
      }
      if (assignment.state !== "completed") {
        throw new InvalidStateError(
          `Cannot integrate incomplete assignment '${assignment.task_id}' (${uuid}): current state is '${assignment.state}'`,
          409,
          { assignment_uuid: uuid, state: assignment.state }
        );
      }
    }

    // 2. Disjoint check: detect conflicting concurrent modifications to the same file
    const seenPaths = new Set<string>();
    for (const patch of input.patches) {
      const norm = normalizePathPattern(patch.path);
      if (seenPaths.has(norm)) {
        throw new IntegrationConflictError(
          `Conflicting concurrent modifications to file: '${patch.path}' across worker patches`,
          { conflicting_path: patch.path }
        );
      }
      seenPaths.add(norm);
    }

    // 3. Workspace state and fresh pre-apply SHA-256 validation
    const workspaceFiles: Record<string, string> = { ...(input.workspace_files ?? {}) };
    const appliedFiles: Array<{ path: string; old_hash: string; new_hash: string }> = [];

    for (const patch of input.patches) {
      const norm = normalizePathPattern(patch.path);
      const currentContent = workspaceFiles[norm] ?? "";
      const actualPreHash = sha256Hex(currentContent);

      if (actualPreHash !== patch.expected_hash) {
        throw new IntegrationHashMismatchError(
          `Pre-apply SHA-256 validation failed for file '${patch.path}': expected ${patch.expected_hash}, got ${actualPreHash}`,
          {
            path: patch.path,
            expected_hash: patch.expected_hash,
            actual_hash: actualPreHash
          }
        );
      }

      // Sequential application
      workspaceFiles[norm] = patch.new_content;
      const newHash = sha256Hex(patch.new_content);

      appliedFiles.push({
        path: patch.path,
        old_hash: actualPreHash,
        new_hash: newHash
      });
    }

    // 4. Combined final hash of all workspace files
    const sortedPaths = Object.keys(workspaceFiles).sort();
    const hasher = createHash("sha256");
    for (const p of sortedPaths) {
      hasher.update(`${p}:${sha256Hex(workspaceFiles[p]!)}|`);
    }
    const combinedHash = hasher.digest("hex");

    return {
      run_uuid: input.run_uuid,
      success: true,
      integrated_at: new Date().toISOString(),
      integrated_assignments: input.assignment_uuids,
      applied_files: appliedFiles,
      combined_hash: combinedHash,
      resulting_files: workspaceFiles
    };
  }
}
