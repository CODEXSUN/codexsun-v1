import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "@codexsun/framework/errors";
import { registerContractRoute } from "@codexsun/framework/http";
import { EnquiryLocationRepository } from "./enquiry-location.repository.js";
import { EnquiryLocationService } from "./enquiry-location.service.js";
import type { EnquiryLocationContext as Scope } from "./enquiry-location.types.js";

const params = z.object({ id: z.coerce.number().int().positive() });
const item = z.object({
  id: z.number().int().positive(),
  uuid: z.string().length(8),
  enquiryId: z.number().int().positive(),
  contactId: z.number().int().positive().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().nonnegative().nullable(),
  capturedAt: z.string().datetime(),
  createdBy: z.string(),
  createdAt: z.string().datetime()
});

export function registerEnquiryLocationRoutes(
  app: FastifyInstance,
  context: (request: FastifyRequest) => Promise<Scope>
) {
  const load = async (scope: Scope, enquiryId: number) => {
    const enquiry = await scope.database
      .selectFrom("crm_enquiries")
      .select(["id", "contact_id", "assigned_user_id", "created_by"])
      .where("id", "=", enquiryId)
      .executeTakeFirst();
    if (!enquiry) throw AppError.notFound("Enquiry was not found.");
    return enquiry;
  };
  const service = (scope: Scope) =>
    new EnquiryLocationService(
      new EnquiryLocationRepository(scope.database, scope.workEvent),
      scope.actorEmail,
      scope.actorUserId,
      scope.canViewAll
    );

  registerContractRoute(app, {
    method: "GET",
    url: "/crm/enquiries/:id/locations",
    schemas: { params, response: z.object({ items: z.array(item) }) },
    handler: async ({ params: routeParams, request }) => {
      const scope = await context(request);
      const enquiry = await load(scope, routeParams.id);
      return {
        items: await service(scope).list(routeParams.id, {
          assignedUserId: enquiry.assigned_user_id,
          createdBy: enquiry.created_by
        })
      };
    }
  });

  registerContractRoute(app, {
    method: "POST",
    url: "/crm/enquiries/:id/locations",
    schemas: {
      params,
      body: z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        accuracyMeters: z.number().nonnegative().max(100000).nullable().default(null),
        capturedAt: z.iso.datetime({ offset: true })
      }),
      response: item
    },
    handler: async ({ params: routeParams, body, request }) => {
      const scope = await context(request);
      const enquiry = await load(scope, routeParams.id);
      return service(scope).create(
        routeParams.id,
        enquiry.contact_id,
        { assignedUserId: enquiry.assigned_user_id, createdBy: enquiry.created_by },
        body
      );
    }
  });
}
