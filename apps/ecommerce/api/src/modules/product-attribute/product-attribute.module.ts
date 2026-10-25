import type { FastifyInstance, FastifyRequest } from "fastify";
import { registerProductAttributeRoutes } from "./product-attribute.routes.js";

export const productAttributeModule = {
  key: "ecommerce.catalog.product-attribute",
  register(
    app: FastifyInstance,
    resolveActorEmail: (request: FastifyRequest) => string = () => ""
  ) {
    return registerProductAttributeRoutes(app, resolveActorEmail);
  }
};
