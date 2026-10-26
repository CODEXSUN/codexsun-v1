import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "@codexsun/framework/errors";
import { registerCoreTenantDatabaseConnection } from "@codexsun/core-api";
import { registerBillingTenantDatabaseConnection } from "@codexsun/billing-api";
import { registerAccountsTenantDatabaseConnection } from "@codexsun/accounts-api";
import { TenantRepository } from "../modules/tenant/tenant.repository.js";
import {
  isSharedApplicationHost,
  normalizeTenantDomain
} from "../modules/tenant-domain/tenant-domain.repository.js";
import { getTenantDatabase, resolveTenantDatabasePassword } from "../database/tenant-database.js";
import { AuthSessionRepository, type AuthSessionRecord } from "./auth-session.repository.js";
import { verifyAuthToken, type AuthTokenPayload } from "./jwt.js";
import { readEncryptedSessionCookie, clearInvalidSessionCookies } from "./session-cookie.js";
import { isSingleTenantMode } from "../tenancy-mode.js";
import { env } from "../env.js";
import { requestHost } from "./request-host.js";
import { claimsMatchSession } from "./auth-session-authority.js";
import { isGlobalPlatformAdminRoute, registerGlobalPlatformAdminAuthorization, requireSuperAdmin } from "./super-admin.guard.js";

export { claimsMatchSession } from "./auth-session-authority.js";

export { requestHost } from "./request-host.js";

declare module "fastify" {
  interface FastifyRequest {
    authContext?: {
      payload: AuthTokenPayload;
      session: AuthSessionRecord;
      source: "bearer" | "cookie";
    };
  }
}

const sessions = new AuthSessionRepository();
const tenants = new TenantRepository();
const publicAuthPaths = new Set([
  "/auth/login",
  "/auth/development/tenant-login",
  "/auth/session/reset",
  "/auth/tenant-context",
  "/health",
  "/ready",
  "/sitemap.xml"
]);

export function registerAuthRequestContext(app: FastifyInstance) {
  app.decorateRequest("authContext", undefined);
  app.addHook("onRequest", async (request, reply) => {
    const requestPath = request.routeOptions.url ?? request.url.split("?")[0] ?? "";
    if (requestPath === "/health" || requestPath === "/ready") return;
    clearInvalidSessionCookies(reply, request);
    const authentication = selectRequestAuthentication(
      bearerToken(request),
      readEncryptedSessionCookie(request)
    );
    if (!authentication) return;
    const { source, token } = authentication;

    const payload = verifyAuthToken(token);
    const session = payload ? await sessions.findActive(payload.jti) : null;
    if (!payload || !claimsMatchSession(payload, session)) {
      if (isPublicAuthenticationPath(requestPath)) return;
      throw authenticationError("AUTH_SESSION_EXPIRED", "Session expired. Please sign in again.");
    }

    const host = requestHost(request);
    if (
      !hostMatchesClaims(host, payload) &&
      !isTrustedInternalBearerRequest(source, host, request.socket.remoteAddress)
    ) {
      if (isPublicAuthenticationPath(requestPath)) return;
      throw authenticationError(
        "AUTH_DOMAIN_MISMATCH",
        "This session is not valid for the requested domain."
      );
    }
    if (source === "cookie") enforceBrowserRequestOrigin(request, host);

    request.authContext = { payload, session, source };
    if (isPublicAuthenticationPath(requestPath)) return;
    // Global administration never resolves tenant business context or trusts tenant roles.
    if (isGlobalPlatformAdminRoute(requestPath) && payload.userType !== "super_admin") {
      return requireSuperAdmin(request,reply);
    }

    if (payload.userType === "tenant") {
      const tenant = payload.tenantId ? await tenants.findByIdOrCode(payload.tenantId) : null;
      if (
        !tenant ||
        tenant.status !== "active" ||
        (isSingleTenantMode() &&
          tenant.corporateId?.trim().toUpperCase() !==
            env.CODEXSUN_SINGLE_TENANT_CORPORATE_ID.trim().toUpperCase()) ||
        tenant.dbName !== payload.tenantDbName ||
        tenant.tenantCode !== payload.tenantCode
      ) {
        throw authenticationError(
          "AUTH_TENANT_ACCESS_INVALID",
          "Tenant access is no longer valid."
        );
      }
      if (
        payload.tenantAccessMode === "custom_domain" &&
        (await tenants.findByDomain(host))?.uuid !== tenant.uuid
      ) {
        throw authenticationError(
          "AUTH_TENANT_DOMAIN_INVALID",
          "The custom domain is not verified for this tenant."
        );
      }
      const connection = {
        database: tenant.dbName,
        host: tenant.dbHost,
        password: resolveTenantDatabasePassword(tenant),
        port: tenant.dbPort,
        user: tenant.dbUser
      };
      registerCoreTenantDatabaseConnection(connection);
      registerBillingTenantDatabaseConnection(connection);
      registerAccountsTenantDatabaseConnection(connection);
      getTenantDatabase(tenant);
      request.headers.authorization = `Bearer ${token}`;
      request.headers["x-tenant-id"] = tenant.uuid;
      request.headers["x-tenant-db"] = tenant.dbName;
      request.tenantId = tenant.uuid;
      reply.header("x-tenant-id", tenant.uuid);
      const defaults = session.context.defaultCompany;
      if (defaults) {
        request.headers["x-company-id"] ??= String(defaults.companyId);
        request.headers["x-financial-year-id"] ??= String(defaults.financialYearId);
      }
    } else {
      request.headers.authorization = `Bearer ${token}`;
    }

    if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
      await sessions.touch(payload.jti);
    }
  });
  registerGlobalPlatformAdminAuthorization(app);
}

export function isPublicAuthenticationPath(path: string) {
  return (
    path.startsWith("/public/") || path.startsWith("/storefront/") || publicAuthPaths.has(path)
  );
}

function bearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }
  const query = request.query as Record<string, string | undefined> | undefined;
  if (query?.token) {
    return query.token.trim();
  }
  return "";
}

export function selectRequestAuthentication(bearer: string, cookie: string) {
  if (cookie) return { source: "cookie" as const, token: cookie };
  if (bearer) return { source: "bearer" as const, token: bearer };
  return null;
}

function hostMatchesClaims(host: string, payload: AuthTokenPayload) {
  if (!payload.loginHost) return true;
  if (payload.tenantAccessMode === "shared_domain" || payload.tenantAccessMode === "platform") {
    return (
      host === payload.loginHost &&
      isSharedApplicationHost(host) &&
      isSharedApplicationHost(payload.loginHost)
    );
  }
  return host === payload.loginHost;
}

export function isTrustedInternalBearerRequest(
  source: "bearer" | "cookie",
  host: string,
  remoteAddress: string | undefined
) {
  if (source !== "bearer" || (host !== "127.0.0.1" && host !== "localhost")) return false;
  return (
    remoteAddress === "127.0.0.1" || remoteAddress === "::1" || remoteAddress === "::ffff:127.0.0.1"
  );
}

function authenticationError(code: string, message: string) {
  return new AppError({ code, message, statusCode: 401 });
}

export function enforceBrowserRequestOrigin(request: FastifyRequest, host = requestHost(request)) {
  if (request.headers["sec-fetch-site"] === "cross-site") {
    throw AppError.forbidden("Cross-site session requests are not allowed.");
  }
  const origin = request.headers.origin;
  if (!origin) return;
  try {
    if (normalizeTenantDomain(new URL(origin).hostname) !== host) {
      throw AppError.forbidden("Request origin does not match the application domain.");
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.forbidden("Request origin is invalid.");
  }
}
