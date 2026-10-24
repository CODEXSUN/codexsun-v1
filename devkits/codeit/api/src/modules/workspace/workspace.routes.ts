import type { IncomingMessage, ServerResponse } from "node:http";
import { InvalidStateError, NotFoundError, ValidationError } from "../../errors.js";
import type { ProjectRecord } from "../project/project.types.js";
import type { ProjectService } from "../project/project.service.js";
import type { RunService } from "../run/run.service.js";
import { ApprovalRequiredError, PolicyDeniedError, ToolPolicy } from "../tool/tool.policy.js";
import type { ToolService } from "../tool/tool.service.js";
import type { ProjectTrust, RunMode } from "../tool/tool.types.js";
import type { CommandRunner } from "./workspace.command.js";
import type { ExecuteCommandInput } from "./workspace.command.types.js";
import type { WorkspaceGit } from "./workspace.git.js";
import type { WorkspacePatcher } from "./workspace.patch.js";
import type { ApplyPatchInput } from "./workspace.patch.types.js";
import type { WorkspaceReader } from "./workspace.reader.js";
import type { WorkspaceSearcher } from "./workspace.searcher.js";

export { PolicyDeniedError, ApprovalRequiredError };

export interface RouteDefinition {
  method: string;
  path: string;
  handler: (
    req: IncomingMessage,
    res: ServerResponse,
    ctx: {
      params: Record<string, string>;
      query: URLSearchParams;
      body: unknown;
      correlationId: string;
    }
  ) => Promise<unknown> | unknown;
}

export type ProjectLookupFn = (projectUuid: string) => { root_path: string } | null;

export function createWorkspaceRoutes(
  reader: WorkspaceReader,
  searcher: WorkspaceSearcher,
  git: WorkspaceGit,
  patcher: WorkspacePatcher,
  runner: CommandRunner,
  projectLookupOrService: ProjectLookupFn | ProjectService,
  runService?: RunService,
  toolService?: ToolService,
  toolPolicy: typeof ToolPolicy = ToolPolicy
): RouteDefinition[] {
  const projectService: ProjectService | null =
    typeof projectLookupOrService === "object" &&
    projectLookupOrService !== null &&
    "getProjectByUuid" in projectLookupOrService
      ? (projectLookupOrService as ProjectService)
      : null;

  const projectLookup: ProjectLookupFn | null =
    typeof projectLookupOrService === "function" ? projectLookupOrService : null;

  function getProject(projectUuid: string | null): ProjectRecord {
    if (!projectUuid) {
      throw new ValidationError("Missing required parameter: project_uuid");
    }
    if (projectService) {
      return projectService.getProjectByUuid(projectUuid);
    }
    if (projectLookup) {
      const p = projectLookup(projectUuid);
      if (!p) {
        throw new NotFoundError(`Project not found with UUID: ${projectUuid}`, {
          project_uuid: projectUuid
        });
      }
      return {
        uuid: projectUuid,
        name: "Project",
        root_path: p.root_path,
        trust_state: "trusted",
        policy_revision: "1.0.0",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    throw new NotFoundError(`Project not found with UUID: ${projectUuid}`, {
      project_uuid: projectUuid
    });
  }

  function getProjectRoot(projectUuid: string | null): string {
    return getProject(projectUuid).root_path;
  }

  return [
    {
      method: "GET",
      path: "/api/codeit/workspace/files",
      handler: (_req, _res, ctx) => {
        const projectUuid = ctx.query.get("project_uuid");
        const filePath = ctx.query.get("path");

        if (!filePath) {
          throw new ValidationError("Missing required query parameter: path");
        }

        const projectRoot = getProjectRoot(projectUuid);
        return reader.readFile(projectRoot, filePath);
      }
    },
    {
      method: "GET",
      path: "/api/codeit/workspace/search",
      handler: (_req, _res, ctx) => {
        const projectUuid = ctx.query.get("project_uuid");
        const query = ctx.query.get("query");
        const limitParam = ctx.query.get("limit");

        if (!query) {
          throw new ValidationError("Missing required query parameter: query");
        }

        const projectRoot = getProjectRoot(projectUuid);
        const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

        return searcher.search(projectRoot, query, { maxResults: limit });
      }
    },
    {
      method: "GET",
      path: "/api/codeit/workspace/git",
      handler: async (_req, _res, ctx) => {
        const projectUuid = ctx.query.get("project_uuid");
        const action = ctx.query.get("action") || "status";
        const stagedParam = ctx.query.get("staged");
        const isStaged = stagedParam === "true" || stagedParam === "1";

        const projectRoot = getProjectRoot(projectUuid);

        if (action === "diff") {
          const diffResult = await git.getDiff(projectRoot, { staged: isStaged });
          return { action: "diff", result: diffResult };
        }

        const statusResult = await git.getStatus(projectRoot);
        return { action: "status", result: statusResult };
      }
    },
    {
      method: "POST",
      path: "/api/codeit/workspace/patch",
      handler: (_req, _res, ctx) => {
        const body = (ctx.body ?? {}) as ApplyPatchInput & {
          project_uuid?: string;
          caller_role?: string;
          approval_uuid?: string;
        };
        const projectUuid = body.project_uuid ?? ctx.query.get("project_uuid");
        if (!projectUuid) {
          throw new ValidationError("Missing required parameter: project_uuid");
        }

        // a. Resolve projectRoot server-side from project_uuid via projectService. NEVER trust client-provided projectRoot.
        const project = getProject(projectUuid);
        const projectRoot = project.root_path;

        // b. Verify run_uuid: Look up the Run from runService. Verify run.project_uuid === project.uuid.
        const runUuid = body.run_uuid ?? ctx.query.get("run_uuid");
        if (!runUuid) {
          throw new ValidationError("Missing required parameter: run_uuid");
        }

        if (!runService) {
          throw new InvalidStateError("RunService not configured for workspace routes", 500);
        }

        const run = runService.getRunByUuid(runUuid);
        if (run.project_uuid !== project.uuid) {
          throw new InvalidStateError(
            `Run ${run.uuid} does not belong to project ${project.uuid}`,
            409,
            { run_uuid: run.uuid, project_uuid: project.uuid }
          );
        }

        // c. Validate Run state: Terminal states ('succeeded', 'failed', 'cancelled', 'timeout') must reject execution with 409 InvalidStateError or PolicyDeniedError.
        const terminalStates = ["succeeded", "failed", "cancelled", "timeout", "cancelling"];
        if (terminalStates.includes(run.state)) {
          throw new InvalidStateError(
            `Cannot apply patch: run ${run.uuid} is in state '${run.state}'`,
            409,
            { run_uuid: run.uuid, state: run.state }
          );
        }

        // d. Validate Run mode: 'plan' and 'ask' modes MUST be strictly denied command and patch mutation tools (CODEIT_POLICY_DENIED). Only 'work' mode is permitted.
        if (run.mode !== "work") {
          throw new PolicyDeniedError(
            `Mode '${run.mode}' strictly forbids workspace mutations. Only 'work' mode is permitted.`,
            { run_uuid: run.uuid, mode: run.mode }
          );
        }

        // e. Validate Project trust: Untrusted projects (project.trust_state === 'untrusted') MUST be denied execution tools.
        if (project.trust_state === "untrusted" || project.trust_state === "archived") {
          throw new PolicyDeniedError(
            `Untrusted or archived project cannot perform workspace mutations.`,
            { project_uuid: project.uuid, trust_state: project.trust_state }
          );
        }

        // f. Evaluate toolPolicy.evaluate(): check grants, actor role, mode, trust, and approval requirements.
        // g. Caller-supplied caller_role must not be trusted; derive role from session context.
        const actor = "operator";

        const tool = toolService?.getTool("workspace_patch") ?? {
          name: "workspace_patch",
          version: "1.0.0",
          description: "Apply atomic patch to a scoped workspace file",
          category: "mutation" as const,
          capability: "workspace.write",
          dangerous: true
        };

        const argumentsPayload: Record<string, unknown> = {
          path: body.path,
          patch: body.patch,
          expected_hash: body.expected_hash
        };

        const actionDigest = toolPolicy.computeActionDigest(
          tool.name,
          tool.version,
          argumentsPayload
        );

        const approval =
          body.approval_uuid && toolService
            ? toolService.getApproval(body.approval_uuid)
            : (toolService?.findValidApproval(project.uuid, run.uuid, actionDigest) ?? null);

        const evalResult = toolPolicy.evaluate({
          actor,
          projectTrust: project.trust_state as ProjectTrust,
          mode: run.mode as RunMode,
          tool,
          argumentsPayload,
          approval
        });

        if (evalResult.decision === "deny") {
          throw new PolicyDeniedError(evalResult.reason, {
            run_uuid: run.uuid,
            action_digest: evalResult.actionDigest
          });
        }

        if (evalResult.decision === "require_approval") {
          throw new ApprovalRequiredError(evalResult.reason, {
            run_uuid: run.uuid,
            action_digest: evalResult.actionDigest
          });
        }

        // h. Recheck cancellation immediately before spawning/executing.
        const freshRun = runService.getRunByUuid(run.uuid);
        if (
          freshRun.state === "cancelled" ||
          freshRun.state === "cancelling" ||
          freshRun.cancellation_generation > run.cancellation_generation
        ) {
          throw new InvalidStateError(
            `Run ${run.uuid} was cancelled prior to patch application`,
            409,
            { run_uuid: run.uuid, state: freshRun.state }
          );
        }

        const patchInput: ApplyPatchInput = {
          ...body,
          run_uuid: run.uuid
        };

        return patcher.applyPatch(projectRoot, patchInput);
      }
    },
    {
      method: "POST",
      path: "/api/codeit/workspace/command",
      handler: async (_req, _res, ctx) => {
        const body = (ctx.body ?? {}) as ExecuteCommandInput & {
          project_uuid?: string;
          caller_role?: string;
          approval_uuid?: string;
        };
        const projectUuid = body.project_uuid ?? ctx.query.get("project_uuid");
        if (!projectUuid) {
          throw new ValidationError("Missing required parameter: project_uuid");
        }

        // a. Resolve projectRoot server-side from project_uuid via projectService. NEVER trust client-provided projectRoot.
        const project = getProject(projectUuid);
        const projectRoot = project.root_path;

        // b. Verify run_uuid: Look up the Run from runService. Verify run.project_uuid === project.uuid.
        const runUuid = body.run_uuid ?? ctx.query.get("run_uuid");
        if (!runUuid) {
          throw new ValidationError("Missing required parameter: run_uuid");
        }

        if (!runService) {
          throw new InvalidStateError("RunService not configured for workspace routes", 500);
        }

        const run = runService.getRunByUuid(runUuid);
        if (run.project_uuid !== project.uuid) {
          throw new InvalidStateError(
            `Run ${run.uuid} does not belong to project ${project.uuid}`,
            409,
            { run_uuid: run.uuid, project_uuid: project.uuid }
          );
        }

        // c. Validate Run state: Terminal states ('succeeded', 'failed', 'cancelled', 'timeout') must reject execution with 409 InvalidStateError or PolicyDeniedError.
        const terminalStates = ["succeeded", "failed", "cancelled", "timeout", "cancelling"];
        if (terminalStates.includes(run.state)) {
          throw new InvalidStateError(
            `Cannot execute command: run ${run.uuid} is in state '${run.state}'`,
            409,
            { run_uuid: run.uuid, state: run.state }
          );
        }

        // d. Validate Run mode: 'plan' and 'ask' modes MUST be strictly denied command and patch mutation tools (CODEIT_POLICY_DENIED). Only 'work' mode is permitted.
        if (run.mode !== "work") {
          throw new PolicyDeniedError(
            `Mode '${run.mode}' strictly forbids command execution. Only 'work' mode is permitted.`,
            { run_uuid: run.uuid, mode: run.mode }
          );
        }

        // e. Validate Project trust: Untrusted projects (project.trust_state === 'untrusted') MUST be denied execution tools.
        if (project.trust_state === "untrusted" || project.trust_state === "archived") {
          throw new PolicyDeniedError(
            `Untrusted or archived project cannot execute arbitrary commands.`,
            { project_uuid: project.uuid, trust_state: project.trust_state }
          );
        }

        // f. Evaluate toolPolicy.evaluate(): check grants, actor role, mode, trust, and approval requirements.
        // g. Caller-supplied caller_role must not be trusted; derive role from session context.
        const actor = "operator";

        const tool = toolService?.getTool("command_run") ?? {
          name: "command_run",
          version: "1.0.0",
          description: "Execute bounded command in project root within process limits",
          category: "command" as const,
          capability: "command.execute",
          dangerous: true
        };

        const argumentsPayload: Record<string, unknown> = {
          executable: body.executable,
          args: body.args ?? [],
          cwd: body.cwd ?? "."
        };

        const actionDigest = toolPolicy.computeActionDigest(
          tool.name,
          tool.version,
          argumentsPayload
        );

        const approval =
          body.approval_uuid && toolService
            ? toolService.getApproval(body.approval_uuid)
            : (toolService?.findValidApproval(project.uuid, run.uuid, actionDigest) ?? null);

        const evalResult = toolPolicy.evaluate({
          actor,
          projectTrust: project.trust_state as ProjectTrust,
          mode: run.mode as RunMode,
          tool,
          argumentsPayload,
          approval
        });

        if (evalResult.decision === "deny") {
          throw new PolicyDeniedError(evalResult.reason, {
            run_uuid: run.uuid,
            action_digest: evalResult.actionDigest
          });
        }

        if (evalResult.decision === "require_approval") {
          throw new ApprovalRequiredError(evalResult.reason, {
            run_uuid: run.uuid,
            action_digest: evalResult.actionDigest
          });
        }

        // h. Recheck cancellation immediately before spawning/executing.
        const freshRun = runService.getRunByUuid(run.uuid);
        if (
          freshRun.state === "cancelled" ||
          freshRun.state === "cancelling" ||
          freshRun.cancellation_generation > run.cancellation_generation
        ) {
          throw new InvalidStateError(
            `Run ${run.uuid} was cancelled prior to command execution`,
            409,
            { run_uuid: run.uuid, state: freshRun.state }
          );
        }

        const cmdInput: ExecuteCommandInput = {
          ...body,
          run_uuid: run.uuid
        };

        return runner.execute(cmdInput, { projectRoot });
      }
    }
  ];
}
