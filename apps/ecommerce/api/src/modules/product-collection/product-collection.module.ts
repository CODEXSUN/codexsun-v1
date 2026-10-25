import type { FastifyInstance, FastifyRequest } from "fastify";
import { registerProductCollectionRoutes } from "./product-collection.routes.js";

export const productCollectionModule = {
  key: "ecommerce.catalog.product-collection",
  register(
    app: FastifyInstance,
    resolveActorEmail: (request: FastifyRequest) => string = () => ""
  ) {
    return registerProductCollectionRoutes(app, resolveActorEmail);
  }
};
