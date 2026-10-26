import { enquiryWhatsAppModule } from "../enquiry-whatsapp/index.js";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Kysely } from "kysely";
import { z } from "zod";
import { registerContractRoute } from "@codexsun/framework/http";
import { AppError } from "@codexsun/framework/errors";
import type {} from "@codexsun/framework/api";
import { EnquiryRepository } from "./enquiry.repository.js";
import {
  EnquiryService,
  type EnquiryRelations,
  type PendingClosureLookup
} from "./enquiry.service.js";
import { EnquiryReadService } from "./enquiry.read-source.js";
import type { EnquiryDatabase } from "./enquiry.types.js";
import { registerEnquiryWorkRoutes } from "./enquiry.work.routes.js";
import { ListInService } from "../list-in/list-in.service.js";
import { ListInRepository } from "../list-in/list-in.repository.js";
import { StatusService } from "../status/status.service.js";
import { StatusRepository } from "../status/status.repository.js";
import { PriorityService } from "../priority/priority.service.js";
import { PriorityRepository } from "../priority/priority.repository.js";
import { localViewRecord, localViewComment, type EnquiryViewInput } from "./enquiry.view-model.js";
import { EnquirySyncRepository, type EnquiryDeliveryState } from "./enquiry.sync.repository.js";

const nullableText = z.string().trim().nullable();
const inputSchema = z.object({
  title: z.string().trim().max(255).default(""),
  description: nullableText,
  contactId: z.number().int().positive().nullable(),
  capturedName: z.string().trim().max(191).nullable(),
  capturedEmail: z.email().max(191).nullable(),
  capturedPhone: z.string().trim().max(80).nullable(),
  source: z.string().trim().min(1).max(80),
  sourceReference: z.string().trim().max(191).nullable(),
  listInId: z.number().int().positive().nullable(),
  statusId: z.number().int().positive(),
  priorityId: z.number().int().positive(),
  assignedUserId: z.number().int().positive().nullable(),
  enquiredAt: z.string().datetime({ offset: true }),
  dueDate: z.iso.date().nullable(),
  closedReason: nullableText
});
const recordSchema = inputSchema.extend({
  enquiryNo: z.number().int().positive().max(2147483646),
  title: z.string().min(1).max(255),
  id: z.number().int().positive(),
  uuid: z.string(),
  contactName: nullableText,
  listIn: nullableText,
  status: z.string(),
  statusName: z.string(),
  priority: z.string(),
  priorityName: z.string(),
  createdBy: z.string(),
  createdByName: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  closurePending: z.boolean().optional(),
  runningJobId: z.number().int().positive().nullable().optional(),
  runningJobStartedAt: z.string().nullable().optional(),
  frappeSyncStatus: z
    .enum(["pending", "processing", "retry", "failed", "synced", "unlinked"])
    .nullable()
    .optional(),
  canViewFrappeSync: z.boolean().optional(),
  frappeSyncError: z.string().nullable().optional(),
  frappeRemoteName: z.string().nullable().optional()
});
const referenceSchema = z.string().trim().min(1).max(191);
const viewInputSchema = inputSchema
  .omit({
    listInId: true,
    statusId: true,
    priorityId: true,
    assignedUserId: true
  })
  .extend({
    listInId: referenceSchema.nullable(),
    statusId: referenceSchema,
    priorityId: referenceSchema,
    assignedUserId: referenceSchema.nullable()
  });
const viewRecordSchema = recordSchema
  .omit({
    id: true,
    enquiryNo: true,
    listInId: true,
    statusId: true,
    priorityId: true,
    assignedUserId: true
  })
  .extend({
    id: referenceSchema,
    enquiryNo: referenceSchema,
    listInId: referenceSchema.nullable(),
    statusId: referenceSchema,
    priorityId: referenceSchema,
    assignedUserId: referenceSchema.nullable(),
    assignedToName: nullableText
  });
const viewIdSchema = z.object({ id: referenceSchema });
const localId = (value: string) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw AppError.validation("Invalid Local enquiry ID.");
  return id;
};
const localInput = (input: EnquiryViewInput) => ({
  ...input,
  listInId: input.listInId === null ? null : localId(input.listInId),
  statusId: localId(input.statusId),
  priorityId: localId(input.priorityId),
  assignedUserId: input.assignedUserId === null ? null : localId(input.assignedUserId)
});
const alertIdSchema = z.object({ alertId: z.coerce.number().int().positive() });
const listQuerySchema = z.object({
  scope: z.enum(["all", "assigned", "created"]).default("all"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
  search: z.string().trim().max(191).default(""),
  mobile: z
    .string()
    .regex(/^\d{7,15}$/)
    .optional(),
  contactId: z.coerce.number().int().positive().optional(),
  searchCustomer: z.string().trim().max(191).optional(),
  searchDetails: z.string().trim().max(191).optional(),
  searchListIn: z.string().trim().max(191).optional(),
  searchDueDate: z.string().trim().max(191).optional(),
  searchPriority: z.string().trim().max(191).optional(),
  searchCreator: z.string().trim().max(191).optional(),
  searchAssignedTo: z.string().trim().max(191).optional(),
  searchStatus: z.string().trim().max(191).optional(),
  filter: z.string().trim().max(80).default("all"),
  fromAt: z.iso.datetime({ offset: true }).optional(),
  toAt: z.iso.datetime({ offset: true }).optional(),
  listInId: z.string().trim().min(1).max(191).optional(),
  createdBy: z.string().trim().min(1).max(191).optional(),
  assignedUserId: z.string().trim().min(1).max(191).optional(),
  fromDate: z.iso.date().optional(),
  toDate: z.iso.date().optional()
});
const reportQuerySchema = listQuerySchema
  .pick({
    fromAt: true,
    toAt: true,
    assignedUserId: true
  })
  .extend({ view: z.enum(["list-in", "creator", "assignee", "status"]).default("list-in") });
const reportRowSchema = z.object({
  listInId: referenceSchema.nullable(),
  listIn: nullableText,
  createdBy: z.string(),
  assignedUserId: referenceSchema.nullable(),
  status: z.string(),
  statusName: z.string(),
  count: z.number().int().nonnegative()
});
const pageSchema = z.object({
  items: z.array(recordSchema),
  total: z.number().int().nonnegative(),
  statusCounts: z.array(z.object({ code: z.string(), count: z.number().int().nonnegative() }))
});
const viewPageSchema = pageSchema.extend({ items: z.array(viewRecordSchema) });
const scopeSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  newCalls: z.number().int().nonnegative(),
  attention: z.number().int().nonnegative(),
  updated7: z.number().int().nonnegative(),
  updated30: z.number().int().nonnegative(),
  created7: z.number().int().nonnegative(),
  created30: z.number().int().nonnegative(),
  oldestActiveDays: z.number().int().nonnegative().nullable(),
  statusCounts: z.array(z.object({ code: z.string(), count: z.number().int().nonnegative() })),
  priorityCounts: z.array(z.object({ code: z.string(), count: z.number().int().nonnegative() }))
});
const commentSchema = z.object({
  id: z.number().int().positive(),
  uuid: z.string(),
  enquiryId: z.number().int().positive(),
  parentId: z.number().int().positive().nullable(),
  body: z.string(),
  bodyFormat: z.enum(["plain", "html"]),
  createdBy: z.string(),
  createdByName: z.string().nullable(),
  createdAt: z.string()
});
const commentInputSchema = z.object({
  requestId: z.string().min(8).max(80).optional(),
  body: z.string().trim().min(1).max(10000),
  bodyFormat: z.enum(["plain", "html"]).default("plain"),
  parentId: z.number().int().positive().nullable().default(null)
});
const viewCommentSchema = commentSchema.omit({ id: true, enquiryId: true, parentId: true }).extend({
  id: referenceSchema,
  enquiryId: referenceSchema,
  parentId: referenceSchema.nullable()
});
const viewCommentInputSchema = commentInputSchema.omit({ parentId: true }).extend({
  parentId: referenceSchema.nullable().default(null)
});

export type EnquiryRequestContext = {
  database: Kysely<EnquiryDatabase>;
  actorEmail: string;
  actorUserId: number | null;
  canViewAll: boolean;
  canViewFrappeSync?: boolean;
  readFrappeSync?: (ids: number[]) => Promise<Map<number, EnquiryDeliveryState>>;
  relations: EnquiryRelations;
  listUsers: () => Promise<Array<{ id: number; name: string; email: string; status: string }>>;
  pendingClosureLookup?: PendingClosureLookup;
  workEvent?: (
    transaction: import("kysely").Transaction<EnquiryDatabase>,
    enquiryId: number,
    action: string,
    body: string
  ) => Promise<void>;
  dispatchFrappeSync?: (eventId: number) => Promise<void>;
};

export function registerEnquiryRoutes(
  app: FastifyInstance,
  context: (request: FastifyRequest) => Promise<EnquiryRequestContext>
) {
  const service = async (request: FastifyRequest) => {
    const scope = await context(request);
    const enquiry = new EnquiryService(
      new EnquiryRepository(scope.database, scope.workEvent, scope.dispatchFrappeSync),
      scope.relations,
      scope,
      scope.pendingClosureLookup
    );
    return { scope, enquiry, read: new EnquiryReadService(enquiry) };
  };
  registerContractRoute(app, {
    method: "POST",
    url: "/crm/enquiries/options/:kind",
    schemas: {
      params: z.object({ kind: z.enum(["list-in", "status", "priority"]) }),
      body: z.object({ name: z.string().trim().min(1).max(80) }),
      response: z.object({ id: referenceSchema, name: z.string(), code: z.string() })
    },
    handler: async ({ params, body, request }) => {
      const { scope } = await service(request);
      const input = { name: body.name, sortOrder: 1000 };
      const record =
        params.kind === "list-in"
          ? await new ListInService(new ListInRepository(scope.database)).create(
              input,
              scope.actorEmail
            )
          : params.kind === "status"
            ? await new StatusService(new StatusRepository(scope.database)).create(
                input,
                scope.actorEmail
              )
            : await new PriorityService(new PriorityRepository(scope.database)).create(
                input,
                scope.actorEmail
              );
      return {
        id: String(record.id),
        name: record.name,
        code:
          "code" in record && typeof record.code === "string"
            ? record.code
            : record.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
      };
    }
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/crm/mobile/enquiries/:id/comments",
    schemas: { params: viewIdSchema, body: viewCommentInputSchema, response: viewCommentSchema },
    handler: async ({ params, body, request }) => {
      const current = await service(request);
      const enquiryId = localId(params.id);
      const saved = await current.enquiry.addComment(
        enquiryId,
        body.body,
        body.parentId === null ? null : localId(body.parentId),
        current.scope.actorEmail,
        body.bodyFormat,
        body.requestId
      );
      return localViewComment(saved);
    }
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/crm/enquiries/options",
    schemas: {
      response: z.object({
        lists: z.array(
          z.object({
            id: referenceSchema,
            name: z.string(),
            status: z.string(),
            code: z.string().optional()
          })
        ),
        statuses: z.array(
          z.object({
            id: referenceSchema,
            name: z.string(),
            status: z.string(),
            code: z.string().optional()
          })
        ),
        priorities: z.array(
          z.object({
            id: referenceSchema,
            name: z.string(),
            status: z.string(),
            code: z.string().optional()
          })
        ),
        users: z.array(
          z.object({
            id: referenceSchema,
            name: z.string(),
            email: z.string().optional(),
            status: z.string()
          })
        ),
        suppliers: z.array(z.object({ id: referenceSchema, name: z.string(), status: z.string() }))
      })
    },
    handler: async ({ request }) => {
      const { scope } = await service(request);
      const [lists, statuses, priorities, users] = await Promise.all([
        scope.database.selectFrom("crm_enquiry_lists").select(["id", "name", "status"]).execute(),
        scope.database
          .selectFrom("crm_enquiry_statuses")
          .select(["id", "name", "code", "status"])
          .execute(),
        scope.database
          .selectFrom("crm_enquiry_priorities")
          .select(["id", "name", "code", "status"])
          .execute(),
        scope.listUsers()
      ]);
      return {
        lists: lists.map((item) => ({ ...item, id: String(item.id) })),
        statuses: statuses.map((item) => ({ ...item, id: String(item.id) })),
        priorities: priorities.map((item) => ({ ...item, id: String(item.id) })),
        users: users.map((item) => ({ ...item, id: String(item.id) })),
        suppliers: []
      };
    }
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/crm/enquiries",
    schemas: {
      querystring: listQuerySchema,
      response: viewPageSchema
    },
    handler: async ({ query, request }) => {
      const current = await service(request);
      const page = await current.read.list(query);
      const canViewFrappeSync = current.scope.canViewFrappeSync === true;
      const statuses = canViewFrappeSync
        ? await (
            current.scope.readFrappeSync ??
            ((ids) => new EnquirySyncRepository(current.scope.database).deliveryStates(ids))
          )(page.items.map((item) => Number(item.id)))
        : new Map();
      return {
        ...page,
        items: page.items.map((item) => ({
          ...item,
          canViewFrappeSync,
          ...(canViewFrappeSync
            ? {
                frappeSyncStatus: statuses.get(Number(item.id))?.status ?? null,
                frappeSyncError: statuses.get(Number(item.id))?.error ?? null,
                frappeRemoteName: statuses.get(Number(item.id))?.remoteName ?? null
              }
            : {})
        }))
      };
    }
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/crm/enquiries/reports",
    schemas: { querystring: reportQuerySchema, response: z.array(reportRowSchema) },
    handler: async ({ query, request }) => {
      const current = await service(request);
      const rows = await current.enquiry.report(query);
      return rows.map((row) => ({
        ...row,
        listInId: row.listInId === null ? null : String(row.listInId),
        assignedUserId: row.assignedUserId === null ? null : String(row.assignedUserId)
      }));
    }
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/crm/enquiries/overview-activity",
    schemas: { response: z.object({ commentsByYou30Days: z.number().int().nonnegative() }) },
    handler: async ({ request }) => {
      const current = await service(request);
      return current.enquiry.overviewActivity(current.scope.actorEmail);
    }
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/crm/enquiries/attention",
    schemas: {
      querystring: z.object({ today: z.iso.date() }),
      response: z.object({
        assignments: z.array(
          z.object({
            id: z.number().int().positive(),
            enquiryId: z.number().int().positive(),
            enquiryNo: z.number().int().positive(),
            title: z.string(),
            createdAt: z.string()
          })
        ),
        due: z.array(recordSchema)
      })
    },
    handler: async ({ query, request }) => {
      const current = await service(request);
      return current.enquiry.attention(query.today);
    }
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/crm/enquiries/summary",
    schemas: {
      querystring: z.object({ today: z.iso.date() }),
      response: z.object({
        allCount: z.number().int().nonnegative(),
        assigned: scopeSummarySchema,
        created: scopeSummarySchema,
        all: scopeSummarySchema
      })
    },
    handler: async ({ query, request }) => {
      const current = await service(request);
      return current.enquiry.summary(query.today);
    }
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/crm/enquiries/alerts/:alertId/read",
    schemas: {
      params: alertIdSchema,
      response: z.object({ read: z.boolean() })
    },
    handler: async ({ params, request }) =>
      (await service(request)).enquiry.readAlert(params.alertId)
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/crm/enquiries/:id",
    schemas: { params: viewIdSchema, response: viewRecordSchema },
    handler: async ({ params, request }) => {
      const current = await service(request);
      const record = localViewRecord(await current.enquiry.get(localId(params.id)));
      if (!current.scope.canViewFrappeSync) return { ...record, canViewFrappeSync: false };
      const statuses = await (
        current.scope.readFrappeSync ??
        ((ids) => new EnquirySyncRepository(current.scope.database).deliveryStates(ids))
      )([Number(params.id)]);
      return {
        ...record,
        canViewFrappeSync: true,
        frappeSyncStatus: statuses.get(Number(params.id))?.status ?? null,
        frappeSyncError: statuses.get(Number(params.id))?.error ?? null,
        frappeRemoteName: statuses.get(Number(params.id))?.remoteName ?? null
      };
    }
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/crm/enquiries/:id/frappe-sync",
    schemas: {
      params: viewIdSchema,
      response: z.array(
        z.object({
          id: z.string(),
          eventType: z.enum(["enquiry-upsert", "comment-add", "job-upsert", "estimate-upsert"]),
          status: z.enum(["pending", "processing", "retry", "failed", "synced"]),
          attempts: z.number().int().nonnegative(),
          remoteName: z.string().nullable(),
          lastError: z.string().nullable(),
          createdAt: z.string(),
          validation: z
            .object({
              status: z.enum(["valid", "invalid", "warning"]),
              errors: z.array(z.string()),
              checkedAt: z.string()
            })
            .nullable()
        })
      )
    },
    handler: async ({ params, request }) => {
      const current = await service(request);
      if (!current.scope.canViewFrappeSync)
        throw AppError.forbidden("You cannot view Frappe sync details.");
      const id = localId(params.id);
      await current.enquiry.get(id);
      return new EnquirySyncRepository(current.scope.database).listForEnquiry(id);
    }
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/crm/enquiries",
    schemas: { body: viewInputSchema, response: viewRecordSchema },
    handler: async ({ body, request }) => {
      const current = await service(request);
      const saved = await current.enquiry.create(localInput(body), current.scope.actorEmail);
      return localViewRecord(saved);
    }
  });
  registerContractRoute(app, {
    method: "PUT",
    url: "/crm/enquiries/:id",
    schemas: { body: viewInputSchema, params: viewIdSchema, response: viewRecordSchema },
    handler: async ({ body, params, request }) => {
      const current = await service(request);
      const id = localId(params.id);
      const saved = await current.enquiry.update(id, localInput(body), current.scope.actorEmail);
      return localViewRecord(saved);
    }
  });
  registerContractRoute(app, {
    method: "PATCH",
    url: "/crm/enquiries/:id/properties",
    schemas: {
      body: viewInputSchema
        .pick({
          listInId: true,
          priorityId: true,
          assignedUserId: true,
          dueDate: true,
          statusId: true,
          closedReason: true
        })
        .partial()
        .refine((value) => Object.keys(value).length > 0),
      params: viewIdSchema,
      response: viewRecordSchema
    },
    handler: async ({ body, params, request }) => {
      const current = await service(request);
      const id = localId(params.id);
      const patch = {
        ...(body.listInId !== undefined
          ? { listInId: body.listInId === null ? null : localId(body.listInId) }
          : {}),
        ...(body.priorityId !== undefined ? { priorityId: localId(body.priorityId) } : {}),
        ...(body.assignedUserId !== undefined
          ? {
              assignedUserId: body.assignedUserId === null ? null : localId(body.assignedUserId)
            }
          : {}),
        ...(body.statusId !== undefined ? { statusId: localId(body.statusId) } : {}),
        ...(body.dueDate !== undefined ? { dueDate: body.dueDate } : {}),
        ...(body.closedReason !== undefined ? { closedReason: body.closedReason } : {})
      };
      const saved = await current.enquiry.updateProperties(id, patch, current.scope.actorEmail);
      return localViewRecord(saved);
    }
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/crm/enquiries/:id/open-new-call",
    schemas: { params: viewIdSchema, response: viewRecordSchema },
    handler: async ({ params, request }) => {
      const current = await service(request);
      const id = localId(params.id);
      const saved = await current.enquiry.openNewCall(id, current.scope.actorEmail);
      return localViewRecord(saved);
    }
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/crm/enquiries/:id/comments",
    schemas: { params: viewIdSchema, response: z.array(viewCommentSchema) },
    handler: async ({ params, request }) => {
      const current = await service(request);
      return (await current.enquiry.listComments(localId(params.id))).map(localViewComment);
    }
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/crm/enquiries/:id/comments",
    schemas: { params: viewIdSchema, body: viewCommentInputSchema, response: viewCommentSchema },
    handler: async ({ params, body, request }) => {
      const current = await service(request);
      {
        const enquiryId = localId(params.id);
        const saved = await current.enquiry.addComment(
          enquiryId,
          body.body,
          body.parentId === null ? null : localId(body.parentId),
          current.scope.actorEmail,
          body.bodyFormat,
          body.requestId
        );
        return localViewComment(saved);
      }
    }
  });
  enquiryWhatsAppModule.register(app, async (request) => {
    const current = await service(request);
    return {
      database: current.scope.database as unknown as import("kysely").Kysely<
        import("../enquiry-whatsapp/index.js").WhatsAppDatabase
      >,
      actorEmail: current.scope.actorEmail,
      recordHandoff: async (transaction, enquiryId, message) => {
        await current.scope.workEvent?.(
          transaction as never,
          enquiryId,
          "whatsapp-handoff",
          message
        );
      },
      verifyEnquiry: async (id) => {
        const record = await current.enquiry.get(id);
        const contact = record.contactId
          ? await current.scope.relations.contact(record.contactId)
          : null;
        return { mobile: contact?.primaryPhone || record.capturedPhone };
      }
    };
  });
  registerEnquiryWorkRoutes(app, async (request) => {
    const current = await service(request);
    return current.scope;
  });
}
