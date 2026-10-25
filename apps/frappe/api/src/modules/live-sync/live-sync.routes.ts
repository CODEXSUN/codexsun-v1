import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { registerContractRoute } from "@codexsun/framework/http";
import { assertFrappeExportAllowed, type ExportKind } from "../export/index.js";
import type { LiveSyncSettings } from "./live-sync.types.js";
const kind = z.enum(["contacts", "enquiries", "activities", "call-logs"]);
const settingsSchema = z.object({
  enabled: z.boolean(),
  paused: z.boolean(),
  direction: z.enum(["inbound", "bidirectional"]),
  inboundBaseUrl: z.string().nullable(),
  inboundCheckpointAt: z.string().nullable(),
  scheduleMinutes: z.union([
    z.literal(1),
    z.literal(5),
    z.literal(15),
    z.literal(30),
    z.literal(60)
  ]),
  modules: z
    .object({
      contacts: z.boolean(),
      enquiries: z.boolean(),
      activities: z.boolean(),
      "call-logs": z.boolean()
    })
    .strict(),
  lastScheduledAt: z.string().nullable(),
  updatedAt: z.string(),
  updatedBy: z.string(),
  backgroundWorkerEnabled: z.boolean()
});
const jobSchema = z.object({
  id: z.number().int().positive(),
  kind,
  direction: z.enum(["inbound", "outbound"]),
  status: z.string(),
  createdAt: z.string(),
  errorMessage: z.string().nullable(),
  progress: z
    .object({
      scanned: z.number().int().nonnegative().optional(),
      exported: z.number().int().nonnegative().optional(),
      created: z.number().int().nonnegative().optional(),
      skipped: z.number().int().nonnegative().optional(),
      failed: z.number().int().nonnegative().optional(),
      failures: z
        .array(
          z.object({
            id: z.number().int().positive().optional(),
            name: z.string().optional(),
            message: z.string()
          })
        )
        .optional(),
      results: z
        .array(
          z.object({
            id: z.number().int().positive(),
            outcome: z.string(),
            message: z.string().nullable()
          })
        )
        .optional()
    })
    .passthrough()
    .nullable()
});
export type LiveSyncCallbacks = {
  settings(request: FastifyRequest): Promise<LiveSyncSettings>;
  save(
    request: FastifyRequest,
    input: Pick<
      LiveSyncSettings,
      "enabled" | "paused" | "direction" | "scheduleMinutes" | "modules"
    >
  ): Promise<LiveSyncSettings>;
  queue(request: FastifyRequest, kind: ExportKind): Promise<{ id: number }>;
  jobs(request: FastifyRequest): Promise<z.infer<typeof jobSchema>[]>;
};
export function registerFrappeLiveSyncRoutes(app: FastifyInstance, callbacks: LiveSyncCallbacks) {
  registerContractRoute(app, {
    method: "GET",
    url: "/frappe/live-sync",
    schemas: { response: settingsSchema },
    handler: ({ request }) => callbacks.settings(request)
  });
  registerContractRoute(app, {
    method: "PUT",
    url: "/frappe/live-sync",
    schemas: {
      body: settingsSchema
        .pick({
          enabled: true,
          paused: true,
          direction: true,
          scheduleMinutes: true,
          modules: true
        })
        .strict(),
      response: settingsSchema
    },
    handler: ({ request, body }) => callbacks.save(request, body)
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/frappe/live-sync/:kind/resync",
    schemas: {
      params: z.object({ kind }),
      body: z.object({}).strict(),
      response: z.object({ id: z.number().int().positive() })
    },
    handler: async ({ request, params }) => {
      assertFrappeExportAllowed(params.kind, "export");
      return callbacks.queue(request, params.kind);
    }
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/frappe/live-sync/jobs",
    schemas: { response: z.array(jobSchema) },
    handler: ({ request }) => callbacks.jobs(request)
  });
}
