import type { FastifyInstance, FastifyRequest } from "fastify";
import { registerProductSpecificationRoutes } from "./product-specification.routes.js";

export const productSpecificationModule = {
  key: "ecommerce.catalog.product-specification",
  register(
    app: FastifyInstance,
    resolveActorEmail: (request: FastifyRequest) => string = () => ""
  ) {
    return registerProductSpecificationRoutes(app, resolveActorEmail);
  }
};
