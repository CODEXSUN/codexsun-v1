/**
 * Codeit Orchestration Client Services
 *
 * Typed client functions interacting with Codeit Orchestration API endpoints.
 * Enforces server-side authority, real backend responses, and error propagation.
 */

import type {
  AssignmentItem,
  DispatchRequestInput,
  PathLeaseItem,
  WorkerHeartbeatInput
} from "./orchestration.types";

const API_BASE = "/api/codeit";

export function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/codexsun_codeit_csrf=([^;]+)/);
  if (match && match[1]) return match[1];
  return "";
}

function getAuthHeaders(): Record<string, string> {
  const token = getCsrfToken();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { "x-codeit-csrf": token } : {})
  };
}

interface ApiResponse<T> {
  success?: boolean;
  items?: T[];
  leases?: T[];
  assignment?: T;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export class OrchestrationService {
  /**
   * Fetch assignments for a specific run or all assignments
   */
  async getAssignments(runUuid: string): Promise<AssignmentItem[]> {
    const res = await fetch(`${API_BASE}/assignments?run_uuid=${encodeURIComponent(runUuid)}`, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      credentials: "same-origin"
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as ApiResponse<unknown>;
      throw new Error(err.error?.message ?? `HTTP ${res.status}: Failed to fetch assignments`);
    }

    const body = (await res.json()) as ApiResponse<AssignmentItem>;
    return body.items ?? [];
  }

  /**
   * Fetch active path leases
   */
  async getActiveLeases(runUuid?: string): Promise<PathLeaseItem[]> {
    const url = runUuid
      ? `${API_BASE}/assignments/leases?run_uuid=${encodeURIComponent(runUuid)}`
      : `${API_BASE}/assignments/leases`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      credentials: "same-origin"
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as ApiResponse<unknown>;
      throw new Error(err.error?.message ?? `HTTP ${res.status}: Failed to fetch active leases`);
    }

    const body = (await res.json()) as ApiResponse<PathLeaseItem>;
    return body.leases ?? [];
  }

  /**
   * Dispatch a new worker assignment
   */
  async dispatch(input: DispatchRequestInput): Promise<{
    assignment: AssignmentItem;
    lease_token: string;
    lease_expiry: string;
  }> {
    const res = await fetch(`${API_BASE}/assignments/dispatch`, {
      method: "POST",
      headers: getAuthHeaders(),
      credentials: "same-origin",
      body: JSON.stringify({
        ...input,
        caller_role: input.caller_role ?? "supervisor"
      })
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as ApiResponse<unknown>;
      throw new Error(err.error?.message ?? `HTTP ${res.status}: Failed to dispatch assignment`);
    }

    return (await res.json()) as {
      assignment: AssignmentItem;
      lease_token: string;
      lease_expiry: string;
    };
  }

  /**
   * Send heartbeat to renew worker lease
   */
  async sendHeartbeat(
    assignmentUuid: string,
    input: WorkerHeartbeatInput
  ): Promise<{ assignment: AssignmentItem; lease_expiry: string }> {
    const res = await fetch(
      `${API_BASE}/assignments/${encodeURIComponent(assignmentUuid)}/heartbeat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(input)
      }
    );

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as ApiResponse<unknown>;
      throw new Error(err.error?.message ?? `HTTP ${res.status}: Heartbeat renewal failed`);
    }

    return (await res.json()) as { assignment: AssignmentItem; lease_expiry: string };
  }

  /**
   * Fail / cancel an assignment
   */
  async failAssignment(
    assignmentUuid: string,
    workerId: string,
    errorMessage: string
  ): Promise<AssignmentItem> {
    const res = await fetch(`${API_BASE}/assignments/${encodeURIComponent(assignmentUuid)}/fail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({
        worker_id: workerId,
        error: { message: errorMessage }
      })
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as ApiResponse<unknown>;
      throw new Error(err.error?.message ?? `HTTP ${res.status}: Failed to cancel assignment`);
    }

    const body = (await res.json()) as { success: boolean; assignment: AssignmentItem };
    return body.assignment;
  }
}

export const orchestrationService = new OrchestrationService();
