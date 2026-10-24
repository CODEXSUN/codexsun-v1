/**
 * Codeit Conversation Module Types
 * Revision: 1.0.0-frozen (Devkits Codeit CONTRACTS.md)
 */

export type ConversationMode = "ask" | "plan" | "work" | "review";

export type RunState =
  | "queued"
  | "planning"
  | "waiting"
  | "running"
  | "paused"
  | "blocked"
  | "verifying"
  | "cancelling"
  | "succeeded"
  | "failed"
  | "cancelled";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export type CompletionState = "draft" | "streaming" | "final" | "failed";

export type ToolInvocationState =
  "proposed" | "approved" | "denied" | "running" | "completed" | "failed";

export type ArtifactType = "plan" | "diff" | "test_report" | "diagnostic" | "evidence";

export type ApprovalDecision = "approved" | "denied";

export type ConnectionState = "connected" | "connecting" | "disconnected" | "denied";

export interface Project {
  id?: number | undefined;
  uuid: string; // 8-character hex
  name: string;
  root_path: string;
  trust_state: "untrusted" | "trusted" | "archived";
  policy_revision: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id?: number | undefined;
  uuid: string; // 8-character hex
  project_uuid: string;
  title: string;
  selected_mode: ConversationMode;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface RunBudget {
  max_duration_seconds: number;
  max_output_bytes: number;
  max_tool_invocations: number;
  max_repair_attempts: number;
  consumed_duration_seconds?: number | undefined;
  consumed_output_bytes?: number | undefined;
  consumed_tool_invocations?: number | undefined;
}

export interface Run {
  id?: number | undefined;
  uuid: string; // 8-character hex
  project_uuid: string;
  conversation_uuid: string;
  mode: ConversationMode;
  state: RunState;
  cancellation_generation: number;
  budget: RunBudget;
  created_at: string;
  updated_at: string;
}

export interface ToolInvocation {
  id?: number | undefined;
  uuid: string; // 8-character hex
  run_uuid: string;
  assignment_uuid?: string | null | undefined;
  tool_name: string;
  tool_version: string;
  arguments_hash: string;
  arguments_payload: Record<string, unknown>;
  grant_uuid?: string | null | undefined;
  state: ToolInvocationState;
  result_artifact_uuid?: string | null | undefined;
  execution_time_ms?: number | undefined;
  failure_reason?: string | undefined;
  created_at: string;
  updated_at: string;
}

export interface Artifact {
  id?: number | undefined;
  uuid: string; // 8-character hex
  run_uuid: string;
  artifact_type: ArtifactType;
  content_hash: string;
  relative_storage_key: string;
  byte_size: number;
  media_type: string;
  provenance: {
    creator?: string | undefined;
    task_id?: string | undefined;
    tool_name?: string | undefined;
    revision?: string | number | undefined;
    summary?: string | undefined;
    [key: string]: unknown;
  };
  content?: string | undefined;
  created_at: string;
  updated_at: string;
}

export interface Approval {
  id?: number | undefined;
  uuid: string; // 8-character hex
  action_digest: string;
  project_uuid: string;
  run_uuid: string;
  expiry: string;
  actor: string;
  decision: ApprovalDecision;
  constraints: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ContextReference {
  path: string;
  type: "file" | "symbol" | "directory";
  lineRange?: [number, number] | undefined;
}

export interface Message {
  id?: number | undefined;
  uuid: string; // 8-character hex
  conversation_uuid: string;
  role: MessageRole;
  content: string;
  request_key: string;
  completion_state: CompletionState;
  tool_invocations?: ToolInvocation[] | undefined;
  artifacts?: Artifact[] | undefined;
  approvals?: Approval[] | undefined;
  context_references?: ContextReference[] | undefined;
  created_at: string;
  updated_at: string;
}

export interface ComposerInput {
  content: string;
  mode: ConversationMode;
  contextReferences: ContextReference[];
}

export interface ConversationFilters {
  project_uuid?: string | undefined;
  archived?: boolean | undefined;
  search?: string | undefined;
  limit?: number | undefined;
  cursor?: string | undefined;
}

export interface RunEventPayload {
  to_state?: RunState | undefined;
  from_state?: RunState | undefined;
  reason?: string | undefined;
  delta?: string | undefined;
  error?: { message: string; [key: string]: unknown } | undefined;
  message_uuid?: string | undefined;
  content?: string | undefined;
  role?: string | undefined;
  tool_name?: string | undefined;
  tool_uuid?: string | undefined;
  tool_invocation?: ToolInvocation | undefined;
  artifact?: Artifact | undefined;
  command?: string | undefined;
  exit_code?: number | undefined;
  output?: string | undefined;
  [key: string]: unknown;
}

export interface RunEvent {
  id?: number | undefined;
  run_uuid: string;
  seq: number;
  event_type: string;
  payload: RunEventPayload;
  correlation_id?: string | null | undefined;
  created_at: string;
}

export interface ConversationWorkspaceProps {
  projectUuid?: string | undefined;
  initialConversationUuid?: string | undefined;
  onNavigateProject?: ((uuid: string) => void) | undefined;
  className?: string | undefined;
}

/**
 * Standard date formatting per UI-WORKFLOWS.md:
 * "Use DD-MM-YYYY and DD-MM-YYYY HH:mm for displayed dates and times."
 */
export function formatCodeitDate(dateInput: string | Date | number): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function formatCodeitDateTime(dateInput: string | Date | number): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
