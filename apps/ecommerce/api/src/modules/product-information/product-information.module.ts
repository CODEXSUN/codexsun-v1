import type { FastifyInstance, FastifyRequest } from "fastify";
import { registerProductInformationRoutes } from "./product-information.routes.js";
export const productInformationModule = {
  key: "ecommerce.catalog.product-information",
  register(
    app: FastifyInstance,
    resolveActorEmail: (request: FastifyRequest) => string = () => ""
  ) {
    return registerProductInformationRoutes(app, resolveActorEmail);
  }
};
