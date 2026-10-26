import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { fail } from "@codexsun/framework/http";
import { hasActiveSuperAdminSession } from "./auth-session-authority.js";

export function isGlobalPlatformAdminRoute(path: string) {
  return /^\/(?:api\/platform\/)?admin(?:\/|$)/u.test(path);
}

export function registerGlobalPlatformAdminAuthorization(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    const path = request.routeOptions.url ?? request.url.split("?")[0] ?? "";
    if (isGlobalPlatformAdminRoute(path)) return requireSuperAdmin(request, reply);
  });
}

export async function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (hasActiveSuperAdminSession(request.authContext)) {
    return;
  }

  return reply.code(403).send(
    fail(
      {
        code: "SUPER_ADMIN_REQUIRED",
        message: "Super Admin permission is required for this operation."
      },
      { requestId: request.id }
    )
  );
}
