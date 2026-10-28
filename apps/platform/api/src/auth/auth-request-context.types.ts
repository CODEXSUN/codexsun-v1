import type { AuthSessionRecord } from "./auth-session.repository.js";
import type { AuthTokenPayload } from "./jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    authContext?: {
      payload: AuthTokenPayload;
      session: AuthSessionRecord;
      source: "bearer" | "cookie";
    };
  }
}
