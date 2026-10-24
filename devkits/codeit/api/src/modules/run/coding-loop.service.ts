import type { DatabaseSync } from "node:sqlite";
import { InvalidStateError } from "../../errors.js";
import { ProjectRepository } from "../project/project.repository.js";
import { ProjectService } from "../project/project.service.js";
import { ToolPolicy } from "../tool/tool.policy.js";
import { ToolService } from "../tool/tool.service.js";
import type { CommandRunner } from "../workspace/workspace.command.js";
import type { CommandResult } from "../workspace/workspace.command.types.js";
import { PatchConflictError, type WorkspacePatcher } from "../workspace/workspace.patch.js";
import type { PatchResult } from "../workspace/workspace.patch.types.js";
import type { RunService } from "./run.service.js";
import { TERMINAL_STATES } from "./run.types.js";

export interface CodingLoopOptions {
  runUuid: string;
  projectRoot: string;
  testCommand: {
    executable: string;
    args: string[];
    cwd?: string;
    timeout_ms?: number;
  };
  patchProposal?: {
    path: string;
    expected_hash: string;
    patch: string;
  };
  repairPatches?: Array<{
    path: string;
    expected_hash?: string;
    patch: string;
  }>;
  autoApprove?: boolean;
  maxRepairBudget?: number;
  correlationId?: string;
  signal?: AbortSignal;
}

export interface CodingLoopResult {
  run_uuid: string;
  reproduced: boolean;
  reproduction_exit_code: number;
  reproduction_output: string;
  patch_applied: boolean;
  patch_result?: PatchResult;
  verified: boolean;
  verification_exit_code: number;
  verification_output: string;
  repair_attempts: number;
  status: "succeeded" | "failed" | "cancelled" | "conflict" | "waiting";
  error?: string;
}

export class CodingLoopService {
  private readonly toolService?: ToolService;
  private readonly projectService?: ProjectService;

  constructor(
    private readonly runService: RunService,
    private readonly patcher: WorkspacePatcher,
    private readonly runner: CommandRunner,
    private readonly db?: DatabaseSync,
    options?: {
      toolService?: ToolService;
      projectService?: ProjectService;
    }
  ) {
    if (options?.toolService) {
      this.toolService = options.toolService;
    } else if (db) {
      this.toolService = new ToolService(db);
    }

    if (options?.projectService) {
      this.projectService = options.projectService;
    } else if (db) {
      this.projectService = new ProjectService(new ProjectRepository(db));
    }
  }

  /**
   * Executes the bounded reproduce -> patch -> test -> verify / repair loop per DEVELOPMENT-LOOP.md.
   */
  public async executeLoop(options: CodingLoopOptions): Promise<CodingLoopResult> {
    const {
      runUuid,
      testCommand,
      patchProposal,
      repairPatches = [],
      autoApprove = false,
      maxRepairBudget = 3,
      correlationId,
      signal
    } = options;

    const run = this.runService.getRunByUuid(runUuid);
    const initialGeneration = run.cancellation_generation;

    // Resolve projectRoot server-side from run.project_uuid via database/service lookup rather than trusting client options
    let projectRoot = options.projectRoot;

    if (this.projectService) {
      const project = this.projectService.getProjectByUuid(run.project_uuid);
      projectRoot = project.root_path;
    } else if (this.db) {
      const row = this.db
        .prepare("SELECT root_path FROM codeit_projects WHERE uuid = ?")
        .get(run.project_uuid) as { root_path: string } | undefined;
      if (row) {
        projectRoot = row.root_path;
      }
    }

    // Invariant check: terminal runs cannot execute
    if (TERMINAL_STATES.includes(run.state)) {
      throw new InvalidStateError(
        `Cannot execute coding loop on terminal run in state '${run.state}'`,
        409,
        {
          run_uuid: runUuid,
          state: run.state
        }
      );
    }

    // Move to running state
    if (run.state === "queued") {
      this.runService.transitionState(runUuid, "running", { correlationId });
    }

    // Recheck cancellation before start
    if (signal?.aborted || this.isCancelled(runUuid, initialGeneration)) {
      return this.handleCancelled(runUuid, initialGeneration, correlationId);
    }

    // ==========================================
    // Phase 1: Reproduce Failing Test / Issue
    // ==========================================
    this.runService.recordEvent(
      runUuid,
      "loop.reproducing",
      {
        command: `${testCommand.executable} ${testCommand.args.join(" ")}`,
        cwd: testCommand.cwd ?? "."
      },
      { generation: initialGeneration, correlationId }
    );

    // Recheck cancellation generation fencing before command execution
    if (signal?.aborted || this.isCancelled(runUuid, initialGeneration)) {
      return this.handleCancelled(runUuid, initialGeneration, correlationId);
    }

    const reproResult: CommandResult = await this.runner.execute(
      {
        run_uuid: runUuid,
        executable: testCommand.executable,
        args: testCommand.args,
        cwd: testCommand.cwd ?? ".",
        timeout_ms: testCommand.timeout_ms ?? 10000
      },
      { projectRoot, signal }
    );

    if (signal?.aborted || this.isCancelled(runUuid, initialGeneration)) {
      return this.handleCancelled(runUuid, initialGeneration, correlationId);
    }

    const reproduced = reproResult.exit_code !== 0;
    const reproOutput = (reproResult.stdout + "\n" + reproResult.stderr).trim();

    this.runService.recordEvent(
      runUuid,
      "loop.reproduced",
      {
        reproduced,
        exit_code: reproResult.exit_code,
        duration_ms: reproResult.duration_ms,
        truncated: reproResult.truncated,
        output: reproOutput.slice(0, 5000)
      },
      { generation: initialGeneration, correlationId }
    );

    // If no patch proposal provided, end here as reproduction evidence
    if (!patchProposal) {
      this.runService.transitionState(runUuid, "waiting", {
        reason: "Reproduction complete, awaiting patch proposal",
        correlationId
      });
      return {
        run_uuid: runUuid,
        reproduced,
        reproduction_exit_code: reproResult.exit_code,
        reproduction_output: reproOutput,
        patch_applied: false,
        verified: false,
        verification_exit_code: -1,
        verification_output: "",
        repair_attempts: 0,
        status: "waiting"
      };
    }

    // ==========================================
    // Phase 2: Proposal & Approval Gate
    // ==========================================
    // Verify approval via toolService or active policy grant rather than blindly trusting client-supplied autoApprove
    let isApproved = false;

    const patchActionDigest = ToolPolicy.computeActionDigest("workspace_patch", "1.0.0", {
      path: patchProposal.path,
      expected_hash: patchProposal.expected_hash,
      patch: patchProposal.patch
    });

    // 1. Check existing approval in toolService
    if (this.toolService) {
      const existingApproval = this.toolService.findValidApproval(
        run.project_uuid,
        runUuid,
        patchActionDigest
      );
      if (existingApproval && existingApproval.decision === "approved") {
        isApproved = true;
      }
    }

    // 2. Check active policy grant
    if (!isApproved && this.db) {
      try {
        const grant = this.db
          .prepare(
            "SELECT * FROM codeit_grants WHERE (run_uuid = ? OR project_uuid = ?) AND capability IN ('workspace.write', '*') AND (revoked IS NULL OR revoked = 0) LIMIT 1"
          )
          .get(runUuid, run.project_uuid);
        if (grant) {
          isApproved = true;
        }
      } catch {
        // Table might not exist
      }
    }

    // 3. Only allow auto-approval if run is in 'work' mode; verify & persist approval via toolService
    if (!isApproved && autoApprove && run.mode === "work") {
      if (this.toolService) {
        try {
          this.toolService.createApproval({
            project_uuid: run.project_uuid,
            run_uuid: runUuid,
            action_digest: patchActionDigest,
            actor: "operator",
            decision: "approved",
            constraints: {}
          });
          isApproved = true;
        } catch {
          const app = this.toolService.findValidApproval(
            run.project_uuid,
            runUuid,
            patchActionDigest
          );
          if (app?.decision === "approved") {
            isApproved = true;
          }
        }
      } else {
        isApproved = true;
      }
    }

    this.runService.recordEvent(
      runUuid,
      "loop.patch_proposed",
      {
        path: patchProposal.path,
        expected_hash: patchProposal.expected_hash,
        autoApprove: isApproved
      },
      { generation: initialGeneration, correlationId }
    );

    if (!isApproved) {
      // Pause in waiting state for operator review
      this.runService.transitionState(runUuid, "waiting", {
        reason: "Awaiting operator patch review and approval",
        correlationId
      });
      return {
        run_uuid: runUuid,
        reproduced,
        reproduction_exit_code: reproResult.exit_code,
        reproduction_output: reproOutput,
        patch_applied: false,
        verified: false,
        verification_exit_code: -1,
        verification_output: "",
        repair_attempts: 0,
        status: "waiting"
      };
    }

    // ==========================================
    // Phase 3: Apply Patch Atomically
    // ==========================================
    let activePatchProposal = patchProposal;
    let patchResult: PatchResult;

    // Recheck cancellation generation fencing before patch application
    if (signal?.aborted || this.isCancelled(runUuid, initialGeneration)) {
      return this.handleCancelled(runUuid, initialGeneration, correlationId);
    }

    try {
      patchResult = this.patcher.applyPatch(projectRoot, {
        run_uuid: runUuid,
        path: activePatchProposal.path,
        expected_hash: activePatchProposal.expected_hash,
        patch: activePatchProposal.patch,
        expected_generation: initialGeneration
      });
    } catch (err: unknown) {
      if (err instanceof PatchConflictError) {
        this.runService.recordEvent(
          runUuid,
          "loop.conflict",
          {
            path: activePatchProposal.path,
            error: err.message,
            statusCode: 409
          },
          { generation: initialGeneration, correlationId }
        );
        this.runService.transitionState(runUuid, "blocked", {
          reason: `Patch conflict: ${err.message}`,
          correlationId
        });
        return {
          run_uuid: runUuid,
          reproduced,
          reproduction_exit_code: reproResult.exit_code,
          reproduction_output: reproOutput,
          patch_applied: false,
          verified: false,
          verification_exit_code: -1,
          verification_output: "",
          repair_attempts: 0,
          status: "conflict",
          error: err.message
        };
      }
      throw err;
    }

    this.runService.recordEvent(
      runUuid,
      "loop.patch_applied",
      {
        path: activePatchProposal.path,
        new_hash: patchResult.new_hash,
        previous_hash: patchResult.previous_hash,
        lines_added: patchResult.lines_added,
        lines_deleted: patchResult.lines_deleted,
        diff_artifact_uuid: patchResult.diff_artifact_uuid
      },
      { generation: initialGeneration, correlationId }
    );

    // ==========================================
    // Phase 4: Verification & Bounded Repair Loop
    // ==========================================
    this.runService.transitionState(runUuid, "verifying", { correlationId });

    // Recheck cancellation generation fencing before command execution
    if (signal?.aborted || this.isCancelled(runUuid, initialGeneration)) {
      return this.handleCancelled(runUuid, initialGeneration, correlationId);
    }

    let verifyResult: CommandResult = await this.runner.execute(
      {
        run_uuid: runUuid,
        executable: testCommand.executable,
        args: testCommand.args,
        cwd: testCommand.cwd ?? ".",
        timeout_ms: testCommand.timeout_ms ?? 10000
      },
      { projectRoot, signal }
    );

    let repairAttempts = 0;
    let verifyOutput = (verifyResult.stdout + "\n" + verifyResult.stderr).trim();

    // Repair Loop
    while (
      verifyResult.exit_code !== 0 &&
      repairAttempts < maxRepairBudget &&
      repairAttempts < repairPatches.length
    ) {
      repairAttempts++;
      const nextRepairPatch = repairPatches[repairAttempts - 1]!;

      this.runService.recordEvent(
        runUuid,
        "loop.repair_attempt",
        {
          attempt: repairAttempts,
          maxAttempts: maxRepairBudget,
          reason: `Verification test failed with exit code ${verifyResult.exit_code}`
        },
        { generation: initialGeneration, correlationId }
      );

      // Recheck cancellation generation fencing before repair patch application
      if (signal?.aborted || this.isCancelled(runUuid, initialGeneration)) {
        return this.handleCancelled(runUuid, initialGeneration, correlationId);
      }

      // Apply repair patch
      const currentHash = patchResult.new_hash;
      try {
        patchResult = this.patcher.applyPatch(projectRoot, {
          run_uuid: runUuid,
          path: nextRepairPatch.path,
          expected_hash: nextRepairPatch.expected_hash ?? currentHash,
          patch: nextRepairPatch.patch,
          expected_generation: initialGeneration
        });
      } catch (err: unknown) {
        if (err instanceof PatchConflictError) {
          this.runService.recordEvent(
            runUuid,
            "loop.conflict",
            { attempt: repairAttempts, error: err.message },
            { generation: initialGeneration, correlationId }
          );
          break;
        }
        throw err;
      }

      // Recheck cancellation generation fencing before repair test execution
      if (signal?.aborted || this.isCancelled(runUuid, initialGeneration)) {
        return this.handleCancelled(runUuid, initialGeneration, correlationId);
      }

      // Re-run verification test
      verifyResult = await this.runner.execute(
        {
          run_uuid: runUuid,
          executable: testCommand.executable,
          args: testCommand.args,
          cwd: testCommand.cwd ?? ".",
          timeout_ms: testCommand.timeout_ms ?? 10000
        },
        { projectRoot, signal }
      );
      verifyOutput = (verifyResult.stdout + "\n" + verifyResult.stderr).trim();
    }

    if (signal?.aborted || this.isCancelled(runUuid, initialGeneration)) {
      return this.handleCancelled(runUuid, initialGeneration, correlationId);
    }

    const verified = verifyResult.exit_code === 0;

    this.runService.recordEvent(
      runUuid,
      "loop.verified",
      {
        verified,
        exit_code: verifyResult.exit_code,
        duration_ms: verifyResult.duration_ms,
        repair_attempts: repairAttempts,
        output: verifyOutput.slice(0, 5000)
      },
      { generation: initialGeneration, correlationId }
    );

    // Terminal transition
    if (verified) {
      this.runService.transitionState(runUuid, "succeeded", { correlationId });
      this.runService.recordEvent(
        runUuid,
        "run.succeeded",
        { completed_at: new Date().toISOString() },
        { generation: initialGeneration, correlationId }
      );
      return {
        run_uuid: runUuid,
        reproduced,
        reproduction_exit_code: reproResult.exit_code,
        reproduction_output: reproOutput,
        patch_applied: true,
        patch_result: patchResult,
        verified: true,
        verification_exit_code: verifyResult.exit_code,
        verification_output: verifyOutput,
        repair_attempts: repairAttempts,
        status: "succeeded"
      };
    } else {
      this.runService.transitionState(runUuid, "failed", {
        reason: `Verification test failed after ${repairAttempts} repair attempts with exit code ${verifyResult.exit_code}`,
        correlationId
      });
      return {
        run_uuid: runUuid,
        reproduced,
        reproduction_exit_code: reproResult.exit_code,
        reproduction_output: reproOutput,
        patch_applied: true,
        patch_result: patchResult,
        verified: false,
        verification_exit_code: verifyResult.exit_code,
        verification_output: verifyOutput,
        repair_attempts: repairAttempts,
        status: "failed",
        error: `Verification failed with exit code ${verifyResult.exit_code}`
      };
    }
  }

  private isCancelled(runUuid: string, initialGeneration: number): boolean {
    const current = this.runService.getRunByUuid(runUuid);
    return (
      current.state === "cancelling" ||
      current.state === "cancelled" ||
      current.cancellation_generation > initialGeneration
    );
  }

  private handleCancelled(
    runUuid: string,
    generation: number,
    correlationId?: string
  ): CodingLoopResult {
    const current = this.runService.getRunByUuid(runUuid);
    if (current.state !== "cancelled" && current.state !== "cancelling") {
      this.runService.cancelRun(runUuid, "Coding loop cancelled by operator", correlationId);
    }
    return {
      run_uuid: runUuid,
      reproduced: false,
      reproduction_exit_code: -1,
      reproduction_output: "Cancelled",
      patch_applied: false,
      verified: false,
      verification_exit_code: -1,
      verification_output: "Cancelled",
      repair_attempts: 0,
      status: "cancelled"
    };
  }
}
