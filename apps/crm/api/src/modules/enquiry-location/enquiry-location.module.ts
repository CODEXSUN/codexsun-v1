import type { FastifyInstance, FastifyRequest } from "fastify";
import { registerEnquiryLocationRoutes } from "./enquiry-location.routes.js";
import type { EnquiryLocationContext } from "./enquiry-location.types.js";

export const enquiryLocationModule = {
  key: "crm.enquiry-location",
  register: (
    app: FastifyInstance,
    context: (request: FastifyRequest) => Promise<EnquiryLocationContext>
  ) => registerEnquiryLocationRoutes(app, context)
};
