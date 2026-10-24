/**
 * Codeit Orchestration Types
 *
 * Types for supervisor orchestration, worker assignments, path leases,
 * and integration gates.
 */

export interface AssignmentItem {
  id?: number | undefined;
  uuid: string;
  run_uuid: string;
  task_id: string;
  worker_id: string;
  dependencies: string[];
  lease_generation: number;
  lease_expiry: string;
  allowed_paths: string[];
  attempt: number;
  state: "assigned" | "active" | "completed" | "failed" | "cancelled" | "expired";
  result_payload?: Record<string, unknown> | null | undefined;
  error_payload?: Record<string, unknown> | null | undefined;
  created_at: string;
  updated_at: string;
}

export interface PathLeaseItem {
  path_pattern: string;
  assignment_uuid: string;
  task_id: string;
  worker_id: string;
  run_uuid: string;
  lease_expiry: string;
  created_at?: string | undefined;
}

export interface DispatchRequestInput {
  run_uuid: string;
  task_id: string;
  worker_id: string;
  allowed_paths: string[];
  dependencies?: string[] | undefined;
  lease_duration_ms?: number | undefined;
  caller_role?: "supervisor" | "operator" | undefined;
}

export interface WorkerHeartbeatInput {
  worker_id: string;
  extend_by_ms?: number | undefined;
}

export interface OrchestrationWorkspaceProps {
  runUuid?: string | undefined;
  className?: string | undefined;
}
