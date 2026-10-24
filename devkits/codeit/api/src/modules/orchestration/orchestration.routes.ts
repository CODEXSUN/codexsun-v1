import { ValidationError } from "../../errors.js";
import type { RouteDefinition } from "../project/project.routes.js";
import type { OrchestrationService } from "./orchestration.service.js";
import {
  CompleteAssignmentRequestSchema,
  DispatchRequestSchema,
  FailAssignmentRequestSchema,
  IntegrationGateInputSchema,
  WorkerHeartbeatSchema
} from "./orchestration.types.js";

export function createOrchestrationRoutes(
  orchestrationService: OrchestrationService
): RouteDefinition[] {
  return [
    // 1. List assignments for a run
    {
      method: "GET",
      path: "/api/codeit/assignments",
      handler: (_req, _res, ctx) => {
        const runUuid = ctx.query.get("run_uuid");
        if (!runUuid) {
          throw new ValidationError("Missing required query parameter: run_uuid");
        }
        const items = orchestrationService.getAssignmentsForRun(runUuid);
        return { items };
      }
    },

    // 2. Query active path leases
    {
      method: "GET",
      path: "/api/codeit/assignments/leases",
      handler: (_req, _res, ctx) => {
        const runUuid = ctx.query.get("run_uuid") ?? undefined;
        const leases = orchestrationService.getActivePathLeases(runUuid);
        return { leases };
      }
    },

    // 3. Dispatch worker assignment
    {
      method: "POST",
      path: "/api/codeit/assignments/dispatch",
      handler: (_req, _res, ctx) => {
        const parseResult = DispatchRequestSchema.safeParse(ctx.body ?? {});
        if (!parseResult.success) {
          throw new ValidationError("Invalid dispatch payload", {
            issues: parseResult.error.issues
          });
        }
        return orchestrationService.dispatch(parseResult.data);
      }
    },

    // 4. Worker heartbeat renewing lease
    {
      method: "POST",
      path: "/api/codeit/assignments/:uuid/heartbeat",
      handler: (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        const parseResult = WorkerHeartbeatSchema.safeParse(ctx.body ?? {});
        if (!parseResult.success) {
          throw new ValidationError("Invalid heartbeat payload", {
            issues: parseResult.error.issues
          });
        }
        return orchestrationService.heartbeat(uuid, parseResult.data);
      }
    },

    // 5. Report task completion with result artifact
    {
      method: "POST",
      path: "/api/codeit/assignments/:uuid/complete",
      handler: (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        const parseResult = CompleteAssignmentRequestSchema.safeParse(ctx.body ?? {});
        if (!parseResult.success) {
          throw new ValidationError("Invalid complete payload", {
            issues: parseResult.error.issues
          });
        }
        const assignment = orchestrationService.completeAssignment(uuid, parseResult.data);
        return { success: true, assignment };
      }
    },

    // 6. Report failure with error payload
    {
      method: "POST",
      path: "/api/codeit/assignments/:uuid/fail",
      handler: (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        const parseResult = FailAssignmentRequestSchema.safeParse(ctx.body ?? {});
        if (!parseResult.success) {
          throw new ValidationError("Invalid fail payload", {
            issues: parseResult.error.issues
          });
        }
        const assignment = orchestrationService.failAssignment(uuid, parseResult.data);
        return { success: true, assignment };
      }
    },

    // 7. Integration gate: sequential merge with pre-apply SHA-256 validation
    {
      method: "POST",
      path: "/api/codeit/assignments/integrate",
      handler: async (_req, _res, ctx) => {
        const parseResult = IntegrationGateInputSchema.safeParse(ctx.body ?? {});
        if (!parseResult.success) {
          throw new ValidationError("Invalid integration input", {
            issues: parseResult.error.issues
          });
        }
        return orchestrationService.integrateArtifacts(parseResult.data);
      }
    },

    // 8. Get assignment details by UUID
    {
      method: "GET",
      path: "/api/codeit/assignments/:uuid",
      handler: (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        return orchestrationService.getAssignmentByUuid(uuid);
      }
    }
  ];
}
