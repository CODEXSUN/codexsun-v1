import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { registerAuthRequestContext } from "./auth-request-context.js";
import {
  AuthSessionRepository,
  emptySessionCache,
  type AuthSessionRecord
} from "./auth-session.repository.js";
import { signAuthToken, verifyAuthToken, type AuthUserType } from "./jwt.js";
import { TenantRepository } from "../modules/tenant/tenant.repository.js";
import { TenantService } from "../modules/tenant/tenant.service.js";
import { registerTenantRoutes } from "../modules/tenant/tenant.routes.js";
import { PlanService } from "../modules/plan/plan.service.js";
import { registerPlanRoutes } from "../modules/plan/plan.routes.js";
import { SubscriptionService } from "../modules/subscription/subscription.service.js";
import { registerSubscriptionRoutes } from "../modules/subscription/subscription.routes.js";
import { EntitlementService } from "../modules/entitlement/entitlement.service.js";
import { registerEntitlementRoutes } from "../modules/entitlement/entitlement.routes.js";
import { AccessControlService } from "../modules/access-control/access-control.service.js";
import { registerAccessControlRoutes } from "../modules/access-control/access-control.routes.js";
import { PlatformActivityService } from "../modules/platform-activity/platform-activity.service.js";
import { registerPlatformActivityRoutes } from "../modules/platform-activity/platform-activity.routes.js";
import { AppRegistryService } from "../modules/app-registry/app-registry.service.js";
import { registerAppRegistryRoutes } from "../modules/app-registry/app-registry.routes.js";
import { IndustryService } from "../modules/industry/industry.service.js";
import { registerIndustryRoutes } from "../modules/industry/industry.routes.js";

import type { TestContext } from "node:test";

export const operations = [
  ["GET", "/admin/tenants"],
  ["HEAD", "/admin/tenants"],
  ["POST", "/admin/tenants"],
  ["PUT", "/admin/tenants/example"],
  ["POST", "/admin/tenants/example/suspend"],
  ["POST", "/admin/tenants/example/restore"],
  ["GET", "/admin/activity/tenant/example"],
  ["GET", "/admin/plans"],
  ["POST", "/admin/plans"],
  ["PUT", "/admin/plans/1"],
  ["GET", "/admin/subscriptions"],
  ["POST", "/admin/subscriptions"],
  ["PUT", "/admin/subscriptions/1"],
  ["GET", "/admin/entitlements"],
  ["POST", "/admin/entitlements"],
  ["PUT", "/admin/entitlements/1"],
  ["GET", "/admin/tenant-access"],
  ["GET", "/admin/plans/1/access"],
  ["PUT", "/admin/plans/1/access"],
  ["GET", "/admin/access-control"],
  ["POST", "/admin/access-control/permissions"],
  ["POST", "/admin/access-control/roles"],
  ["POST", "/admin/access-control/users"],
  ["GET", "/admin/platform-activity"],
  ["GET", "/admin/apps"],
  ["POST", "/admin/apps"],
  ["PUT", "/admin/apps/1"],
  ["GET", "/admin/industries"],
  ["POST", "/admin/industries"],
  ["PUT", "/admin/industries/1"],
  ["GET", "/api/platform/admin/tenants"],
  ["POST", "/api/platform/admin/tenants"],
  ["GET", "/admin/future-operation"]
] as const;

export function identity(userType: AuthUserType, label: string) {
  const token = signAuthToken({
    email: `${label}@example.test`,
    userId: label,
    userType,
    ...(userType === "tenant"
      ? { tenantId: label, tenantDbName: `synthetic_${label}`, tenantCode: label }
      : {})
  });
  const payload = verifyAuthToken(token)!;
  const session: AuthSessionRecord = {
    context: emptySessionCache(),
    expiresAt: new Date(payload.exp * 1000),
    jti: payload.jti,
    lastSeenAt: new Date(),
    loginHost: payload.loginHost,
    revokedAt: null,
    tenantAccessMode: payload.tenantAccessMode,
    tenantCode: payload.tenantCode ?? null,
    tenantDbName: payload.tenantDbName ?? null,
    tenantId: payload.tenantId ?? null,
    userEmail: payload.email,
    userName: label,
    userType,
    userUuid: payload.userId,
    uuid: label
  };
  return { token, payload, session };
}

export async function createGlobalAdminFixture(t: TestContext) {
  const app = Fastify();
  await app.register(cookie);
  const sessions = new Map<string, AuthSessionRecord>();
  let businessCalls = 0;
  t.mock.method(
    AuthSessionRepository.prototype,
    "findActive",
    async (jti: string) => sessions.get(jti) ?? null
  );
  t.mock.method(TenantRepository.prototype, "findByIdOrCode", async () => {
    throw new Error("Global admin denial must precede tenant database resolution");
  });
  const services: [object, string[]][] = [
    [
      TenantService.prototype,
      [
        "listTenants",
        "createTenant",
        "updateTenant",
        "suspendTenant",
        "restoreTenant",
        "listActivity"
      ]
    ],
    [PlanService.prototype, ["listPlans", "createPlan", "updatePlan"]],
    [
      SubscriptionService.prototype,
      ["listSubscriptions", "createSubscription", "updateSubscription"]
    ],
    [
      EntitlementService.prototype,
      [
        "listEntitlements",
        "listTenantAccess",
        "getPlanAccess",
        "savePlanAccess",
        "createEntitlement",
        "updateEntitlement"
      ]
    ],
    [AccessControlService.prototype, ["overview", "savePermission", "saveRole", "saveUser"]],
    [PlatformActivityService.prototype, ["listActivity"]],
    [AppRegistryService.prototype, ["listApps", "createApp", "updateApp"]],
    [IndustryService.prototype, ["listIndustries", "createIndustry", "updateIndustry"]]
  ];
  for (const [prototype, names] of services)
    for (const name of names) {
      t.mock.method(prototype as Record<string, () => Promise<unknown>>, name, async () => {
        businessCalls++;
        return [];
      });
    }
  registerAuthRequestContext(app);
  for (const register of [
    registerTenantRoutes,
    registerPlanRoutes,
    registerSubscriptionRoutes,
    registerEntitlementRoutes,
    registerAccessControlRoutes,
    registerPlatformActivityRoutes,
    registerAppRegistryRoutes,
    registerIndustryRoutes
  ])
    await register(app);
  await app.register(
    async (scope) => {
      await registerTenantRoutes(scope);
    },
    { prefix: "/api/platform" }
  );
  app.get("/admin/future-operation", async () => {
    businessCalls++;
    return { success: true };
  });
  app.get("/auth/session", async (request) => ({
    userType: request.authContext?.payload.userType
  }));
  app.get("/public/admin-information", async () => ({ public: true }));
  return { app, sessions, businessCalls: () => businessCalls };
}
