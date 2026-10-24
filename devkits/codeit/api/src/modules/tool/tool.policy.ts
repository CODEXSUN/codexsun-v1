import { createHash } from "node:crypto";
import { CodeitError } from "../../errors.js";
import type { PolicyEvaluationContext, PolicyEvaluationResult } from "./tool.types.js";

export class PolicyDeniedError extends CodeitError {
  constructor(message = "Policy denied", details: Record<string, unknown> = {}) {
    super("CODEIT_POLICY_DENIED", message, 403, false, details);
    this.name = "PolicyDeniedError";
  }
}

export class ApprovalRequiredError extends CodeitError {
  constructor(message = "Operator approval required", details: Record<string, unknown> = {}) {
    super("CODEIT_APPROVAL_REQUIRED", message, 403, false, details);
    this.name = "ApprovalRequiredError";
  }
}

function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

export class ToolPolicy {
  /**
   * Computes a canonical deterministic action digest for a tool invocation.
   */
  public static computeActionDigest(
    toolName: string,
    toolVersion: string,
    args: Record<string, unknown> = {}
  ): string {
    const canonicalArgs = sortObjectKeys(args);
    const serialized = JSON.stringify({
      tool: toolName,
      version: toolVersion,
      args: canonicalArgs
    });
    return createHash("sha256").update(serialized).digest("hex");
  }

  /**
   * Evaluates capability policy given actor, project trust, run mode, grants, and tool context.
   * Enforces strict defense-in-depth ceilings.
   */
  public static evaluate(ctx: PolicyEvaluationContext): PolicyEvaluationResult {
    const { projectTrust, mode, tool, argumentsPayload = {}, grants = [], approval = null } = ctx;

    const actionDigest = ToolPolicy.computeActionDigest(tool.name, tool.version, argumentsPayload);

    // 1. Archived Project Rule: All capabilities unconditionally denied
    if (projectTrust === "archived") {
      return {
        decision: "deny",
        reason: "Project is archived; all tool capabilities are unconditionally denied.",
        actionDigest,
        requiresApproval: false
      };
    }

    const isMutation =
      tool.category === "mutation" ||
      tool.capability.includes("write") ||
      tool.capability.includes("patch");

    const isCommand =
      tool.category === "command" ||
      tool.capability.includes("execute") ||
      tool.capability.includes("command");

    const isNetwork = tool.category === "network" || tool.capability.includes("network");

    // 2. Untrusted Project Rule: Cannot execute commands, network tools, or mutations
    if (projectTrust === "untrusted") {
      if (isCommand) {
        return {
          decision: "deny",
          reason: "Untrusted project cannot execute arbitrary commands.",
          actionDigest,
          requiresApproval: false
        };
      }
      if (isNetwork) {
        return {
          decision: "deny",
          reason: "Untrusted project cannot access external network tools.",
          actionDigest,
          requiresApproval: false
        };
      }
      if (isMutation) {
        return {
          decision: "deny",
          reason: "Untrusted project cannot perform workspace mutations.",
          actionDigest,
          requiresApproval: false
        };
      }
    }

    // 3. Mode Ceilings: Ask, Plan, and Review unconditionally deny mutations and commands
    if (mode === "ask" || mode === "plan" || mode === "review") {
      if (isMutation || isCommand || isNetwork) {
        return {
          decision: "deny",
          reason: `Mode '${mode}' strictly forbids mutations, commands, and network capabilities.`,
          actionDigest,
          requiresApproval: false
        };
      }
    }

    // 4. Grant check: If capability has explicit grant requirement
    const matchingGrant = grants.find(
      (g) => g.capability === tool.capability || g.capability === "*"
    );

    if (matchingGrant) {
      if (matchingGrant.revoked) {
        return {
          decision: "deny",
          reason: `Grant for capability '${tool.capability}' was revoked.`,
          actionDigest,
          requiresApproval: false
        };
      }
      if (matchingGrant.expiry && new Date(matchingGrant.expiry).getTime() <= Date.now()) {
        return {
          decision: "deny",
          reason: `Grant for capability '${tool.capability}' has expired.`,
          actionDigest,
          requiresApproval: false
        };
      }
    }

    // 5. Read and Diagnostic Tools: Allowed without approval unless explicitly marked dangerous
    if (tool.category === "read" || tool.category === "diagnostic") {
      if (!tool.dangerous) {
        return {
          decision: "allow",
          reason: "Read/diagnostic tool permitted by mode and trust policy.",
          actionDigest,
          requiresApproval: false
        };
      }
    }

    // 6. Mutation / Command / Dangerous tools in Work Mode
    // Must be bound to a valid, unexpired, matching Approval Record
    if (!approval) {
      return {
        decision: "require_approval",
        reason: `Capability '${tool.capability}' requires explicit operator approval in mode '${mode}'.`,
        actionDigest,
        requiresApproval: true
      };
    }

    // Validate approval record
    if (approval.decision === "denied") {
      return {
        decision: "deny",
        reason: "Approval for this action was explicitly denied by operator.",
        actionDigest,
        requiresApproval: false
      };
    }

    // Check action digest binding
    if (approval.action_digest !== actionDigest) {
      return {
        decision: "require_approval",
        reason:
          "Action digest mismatch: arguments, tool name, or version changed since approval was generated.",
        actionDigest,
        requiresApproval: true
      };
    }

    // Check expiry
    const expiryTime = new Date(approval.expiry).getTime();
    if (Number.isNaN(expiryTime) || expiryTime <= Date.now()) {
      return {
        decision: "require_approval",
        reason: "Approval has expired. Fresh operator authorization required.",
        actionDigest,
        requiresApproval: true
      };
    }

    if (approval.decision === "approved") {
      return {
        decision: "allow",
        reason: "Action approved by operator with matching action digest.",
        actionDigest,
        requiresApproval: false
      };
    }

    // If pending approval
    return {
      decision: "require_approval",
      reason: "Approval is pending operator decision.",
      actionDigest,
      requiresApproval: true
    };
  }
}
