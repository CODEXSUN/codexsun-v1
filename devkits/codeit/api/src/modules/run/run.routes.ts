import type { RouteDefinition } from "../project/project.routes.js";
import type { CodingLoopOptions, CodingLoopService } from "./coding-loop.service.js";
import type { RunService } from "./run.service.js";
import { type CreateRunInput, type RunState, TERMINAL_STATES } from "./run.types.js";
import { ValidationError } from "../../errors.js";

export function createRunRoutes(
  runService: RunService,
  codingLoopService?: CodingLoopService | undefined
): RouteDefinition[] {
  return [
    {
      method: "POST",
      path: "/api/codeit/runs",
      handler: async (_req, _res, ctx) => {
        const input = (ctx.body ?? {}) as CreateRunInput & { auto_execute?: boolean };
        const run = runService.createRun(input, ctx.correlationId);

        // If auto_execute is requested (default true for ask/plan modes), trigger execution in background
        if (input.auto_execute !== false) {
          // Do not await background execution so response returns immediately
          void runService.executeRun(run.uuid, { correlationId: ctx.correlationId }).catch(() => {
            // Background errors handled inside executeRun
          });
        }

        return run;
      }
    },
    {
      method: "POST",
      path: "/api/codeit/runs/:uuid/loop",
      handler: async (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        if (!codingLoopService) {
          throw new ValidationError("CodingLoopService is not configured");
        }
        const body = (ctx.body ?? {}) as Omit<CodingLoopOptions, "runUuid">;
        return codingLoopService.executeLoop({
          ...body,
          runUuid: uuid,
          correlationId: ctx.correlationId
        });
      }
    },
    {
      method: "GET",
      path: "/api/codeit/runs/:uuid",
      handler: (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        return runService.getRunByUuid(uuid);
      }
    },
    {
      method: "GET",
      path: "/api/codeit/runs/:uuid/events",
      handler: async (req, res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        const run = runService.getRunByUuid(uuid);

        const lastIdHeader = req?.headers
          ? (req.headers["last-event-id"] as string | undefined)
          : undefined;
        const cursorParam = ctx.query.get("cursor");
        const cursor = Number(lastIdHeader ?? cursorParam ?? 0);

        // Fallback for direct unit tests without real HTTP ServerResponse
        if (!res || typeof res.write !== "function" || typeof res.writeHead !== "function") {
          const events = runService.getEventsSince(uuid, isNaN(cursor) ? 0 : cursor);
          return { items: events };
        }

        // Set Server-Sent Events headers
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no"
        });

        // 1. Replay historical events from sequence cursor without side effect duplication
        const pastEvents = runService.getEventsSince(uuid, isNaN(cursor) ? 0 : cursor);
        for (const event of pastEvents) {
          res.write(
            `id: ${event.seq}\nevent: ${event.event_type}\ndata: ${JSON.stringify(event.payload)}\n\n`
          );
        }

        // If run is already in terminal state and all events replayed, end stream
        if (TERMINAL_STATES.includes(run.state)) {
          res.end();
          return;
        }

        // 2. Subscribe to live stream events
        return new Promise<void>((resolvePromise) => {
          let ended = false;

          const finish = () => {
            if (!ended) {
              ended = true;
              unsubscribe();
              if (!res.writableEnded) {
                res.end();
              }
              resolvePromise();
            }
          };

          const unsubscribe = runService.subscribeToRunEvents(uuid, (event) => {
            if (ended || res.writableEnded) {
              finish();
              return;
            }

            res.write(
              `id: ${event.seq}\nevent: ${event.event_type}\ndata: ${JSON.stringify(event.payload)}\n\n`
            );

            // If terminal state reached, conclude SSE stream
            const toState = event.payload?.to_state as string | undefined;
            if (
              (toState && TERMINAL_STATES.includes(toState as RunState)) ||
              event.event_type === "run.cancelled" ||
              event.event_type === "run.succeeded" ||
              event.event_type === "run.failed"
            ) {
              setTimeout(finish, 50);
            }
          });

          req.on("close", finish);
          req.on("error", finish);
        });
      }
    },
    {
      method: "POST",
      path: "/api/codeit/runs/:uuid/cancel",
      handler: (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        const body = (ctx.body ?? {}) as { reason?: string };
        return runService.cancelRun(uuid, body.reason, ctx.correlationId);
      }
    },
    {
      method: "POST",
      path: "/api/codeit/runs/:uuid/pause",
      handler: (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        const body = (ctx.body ?? {}) as { reason?: string };
        return runService.pauseRun(uuid, body.reason, ctx.correlationId);
      }
    },
    {
      method: "POST",
      path: "/api/codeit/runs/:uuid/resume",
      handler: (_req, _res, ctx) => {
        const uuid = ctx.params["uuid"] ?? "";
        return runService.resumeRun(uuid, ctx.correlationId);
      }
    }
  ];
}
