import { createHash, randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { NotFoundError, ValidationError } from "../../errors.js";
import { ApprovalRequiredError, PolicyDeniedError, ToolPolicy } from "./tool.policy.js";
export { ApprovalRequiredError, PolicyDeniedError };
import {
  type ApprovalRecord,
  type CreateApprovalInput,
  CreateApprovalInputSchema,
  type CreateToolInvocationInput,
  CreateToolInvocationInputSchema,
  type PolicyEvaluationContext,
  type PolicyEvaluationResult,
  type ToolDefinition,
  type ToolInvocationRecord,
  type ToolInvocationState
} from "./tool.types.js";

const DEFAULT_BUILTIN_TOOLS: ToolDefinition[] = [
  {
    name: "workspace_read_file",
    version: "1.0.0",
    description:
      "Read file contents within canonical project root with size bounds and secret masking",
    category: "read",
    capability: "workspace.read",
    dangerous: false
  },
  {
    name: "workspace_list_dir",
    version: "1.0.0",
    description: "List directory tree within canonical project root with entry bounds",
    category: "read",
    capability: "workspace.read",
    dangerous: false
  },
  {
    name: "workspace_search",
    version: "1.0.0",
    description: "Search text within canonical project root with result count/size bounds",
    category: "read",
    capability: "workspace.read",
    dangerous: false
  },
  {
    name: "git_status",
    version: "1.0.0",
    description: "Inspect git status of canonical project repository",
    category: "diagnostic",
    capability: "git.read",
    dangerous: false
  },
  {
    name: "git_diff",
    version: "1.0.0",
    description: "Inspect git diff of canonical project repository",
    category: "diagnostic",
    capability: "git.read",
    dangerous: false
  },
  {
    name: "workspace_patch",
    version: "1.0.0",
    description: "Apply atomic patch to a scoped workspace file",
    category: "mutation",
    capability: "workspace.write",
    dangerous: true
  },
  {
    name: "command_run",
    version: "1.0.0",
    description: "Execute bounded command in project root within process limits",
    category: "command",
    capability: "command.execute",
    dangerous: true
  }
];

interface ToolInvocationRow {
  id: number;
  uuid: string;
  run_uuid: string;
  assignment_uuid: string | null;
  tool_name: string;
  tool_version: string;
  arguments_hash: string;
  arguments_payload: string;
  grant_uuid: string | null;
  state: string;
  result_artifact_uuid: string | null;
  created_at: string;
  updated_at: string;
}

interface ApprovalRow {
  id: number;
  uuid: string;
  action_digest: string;
  project_uuid: string;
  run_uuid: string;
  expiry: string;
  actor: string;
  decision: string;
  constraints: string;
  created_at: string;
  updated_at: string;
}

function mapInvocationRow(row: ToolInvocationRow): ToolInvocationRecord {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.arguments_payload);
  } catch {
    payload = {};
  }

  return {
    id: row.id,
    uuid: row.uuid,
    run_uuid: row.run_uuid,
    assignment_uuid: row.assignment_uuid,
    tool_name: row.tool_name,
    tool_version: row.tool_version,
    arguments_hash: row.arguments_hash,
    arguments_payload: payload,
    grant_uuid: row.grant_uuid,
    state: row.state as ToolInvocationState,
    result_artifact_uuid: row.result_artifact_uuid,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapApprovalRow(row: ApprovalRow): ApprovalRecord {
  let constraints: Record<string, unknown> = {};
  try {
    constraints = JSON.parse(row.constraints);
  } catch {
    constraints = {};
  }

  return {
    id: row.id,
    uuid: row.uuid,
    action_digest: row.action_digest,
    project_uuid: row.project_uuid,
    run_uuid: row.run_uuid,
    expiry: row.expiry,
    actor: row.actor,
    decision: row.decision as "approved" | "denied" | "pending",
    constraints,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export class ToolService {
  private readonly toolRegistry = new Map<string, ToolDefinition>();

  constructor(private readonly db: DatabaseSync) {
    for (const tool of DEFAULT_BUILTIN_TOOLS) {
      this.registerTool(tool);
    }
  }

  // --- Tool Catalog Registry ---

  registerTool(tool: ToolDefinition): void {
    this.toolRegistry.set(tool.name, tool);
  }

  getTool(name: string): ToolDefinition | null {
    return this.toolRegistry.get(name) ?? null;
  }

  listTools(): ToolDefinition[] {
    return Array.from(this.toolRegistry.values());
  }

  // --- Policy Evaluation ---

  evaluate(ctx: PolicyEvaluationContext): PolicyEvaluationResult {
    return ToolPolicy.evaluate(ctx);
  }

  computeActionDigest(
    toolName: string,
    toolVersion: string,
    args: Record<string, unknown> = {}
  ): string {
    return ToolPolicy.computeActionDigest(toolName, toolVersion, args);
  }

  // --- Tool Invocations Persistence ---

  recordInvocation(input: CreateToolInvocationInput): ToolInvocationRecord {
    const parseResult = CreateToolInvocationInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new ValidationError("Invalid tool invocation payload", {
        errors: parseResult.error.issues
      });
    }

    const data = parseResult.data;
    const argsPayload = data.arguments_payload ?? {};
    const argsHash = createHash("sha256").update(JSON.stringify(argsPayload)).digest("hex");

    const uuid = randomBytes(4).toString("hex").toLowerCase();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO codeit_tool_invocations (
        uuid, run_uuid, assignment_uuid, tool_name, tool_version,
        arguments_hash, arguments_payload, grant_uuid, state,
        result_artifact_uuid, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      uuid,
      data.run_uuid,
      data.assignment_uuid ?? null,
      data.tool_name,
      data.tool_version,
      argsHash,
      JSON.stringify(argsPayload),
      data.grant_uuid ?? null,
      "proposed",
      null,
      now,
      now
    );

    const record = this.getInvocation(uuid);
    if (!record) {
      throw new Error(`Failed to retrieve newly inserted invocation ${uuid}`);
    }
    return record;
  }

  updateInvocationState(
    uuid: string,
    state: ToolInvocationState,
    resultArtifactUuid: string | null = null
  ): ToolInvocationRecord {
    const existing = this.getInvocation(uuid);
    if (!existing) {
      throw new NotFoundError(`Tool invocation not found with UUID: ${uuid}`, { uuid });
    }

    const now = new Date().toISOString();
    const artifactUuid = resultArtifactUuid ?? existing.result_artifact_uuid ?? null;
    this.db
      .prepare(
        `
        UPDATE codeit_tool_invocations
        SET state = ?, result_artifact_uuid = ?, updated_at = ?
        WHERE uuid = ?
      `
      )
      .run(state, artifactUuid, now, uuid);

    return this.getInvocation(uuid)!;
  }

  getInvocation(uuid: string): ToolInvocationRecord | null {
    const row = this.db
      .prepare("SELECT * FROM codeit_tool_invocations WHERE uuid = ?")
      .get(uuid) as unknown as ToolInvocationRow | undefined;

    return row ? mapInvocationRow(row) : null;
  }

  listInvocations(runUuid: string): ToolInvocationRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM codeit_tool_invocations WHERE run_uuid = ? ORDER BY id ASC")
      .all(runUuid) as unknown as ToolInvocationRow[];

    return rows.map(mapInvocationRow);
  }

  // --- Approvals Management ---

  createApproval(input: CreateApprovalInput): ApprovalRecord {
    const parseResult = CreateApprovalInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new ValidationError("Invalid approval payload", {
        errors: parseResult.error.issues
      });
    }

    const data = parseResult.data;
    const uuid = randomBytes(4).toString("hex").toLowerCase();
    const now = new Date().toISOString();
    const expiry = data.expiry ?? new Date(Date.now() + 3600 * 1000).toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO codeit_approvals (
        uuid, action_digest, project_uuid, run_uuid, expiry,
        actor, decision, constraints, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      uuid,
      data.action_digest,
      data.project_uuid,
      data.run_uuid,
      expiry,
      data.actor,
      data.decision,
      JSON.stringify(data.constraints ?? {}),
      now,
      now
    );

    const record = this.getApproval(uuid);
    if (!record) {
      throw new Error(`Failed to retrieve newly created approval ${uuid}`);
    }
    return record;
  }

  getApproval(uuid: string): ApprovalRecord | null {
    const row = this.db
      .prepare("SELECT * FROM codeit_approvals WHERE uuid = ?")
      .get(uuid) as unknown as ApprovalRow | undefined;

    return row ? mapApprovalRow(row) : null;
  }

  decideApproval(uuid: string, decision: "approved" | "denied"): ApprovalRecord {
    const existing = this.getApproval(uuid);
    if (!existing) {
      throw new NotFoundError(`Approval record not found with UUID: ${uuid}`, { uuid });
    }

    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE codeit_approvals SET decision = ?, updated_at = ? WHERE uuid = ?")
      .run(decision, now, uuid);

    return this.getApproval(uuid)!;
  }

  revokeApproval(uuid: string): ApprovalRecord {
    return this.decideApproval(uuid, "denied");
  }

  findValidApproval(
    projectUuid: string,
    runUuid: string,
    actionDigest: string
  ): ApprovalRecord | null {
    const now = new Date().toISOString();
    const row = this.db
      .prepare(
        `
        SELECT * FROM codeit_approvals
        WHERE project_uuid = ? AND run_uuid = ? AND action_digest = ? AND decision = 'approved' AND expiry > ?
        ORDER BY id DESC LIMIT 1
      `
      )
      .get(projectUuid, runUuid, actionDigest, now) as unknown as ApprovalRow | undefined;

    return row ? mapApprovalRow(row) : null;
  }
}
