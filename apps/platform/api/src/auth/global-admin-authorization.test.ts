import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerAuthRequestContext } from "./auth-request-context.js";
import { AuthSessionRepository, emptySessionCache, type AuthSessionRecord } from "./auth-session.repository.js";
import { hasActiveSuperAdminSession, parseSessionAuthority } from "./auth-session-authority.js";
import { isGlobalPlatformAdminRoute } from "./super-admin.guard.js";
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

const operations = [
  ["GET","/admin/tenants"],["HEAD","/admin/tenants"],["POST","/admin/tenants"],
  ["PUT","/admin/tenants/example"],["POST","/admin/tenants/example/suspend"],
  ["POST","/admin/tenants/example/restore"],["GET","/admin/activity/tenant/example"],
  ["GET","/admin/plans"],["POST","/admin/plans"],["PUT","/admin/plans/1"],
  ["GET","/admin/subscriptions"],["POST","/admin/subscriptions"],["PUT","/admin/subscriptions/1"],
  ["GET","/admin/entitlements"],["POST","/admin/entitlements"],["PUT","/admin/entitlements/1"],
  ["GET","/admin/tenant-access"],["GET","/admin/plans/1/access"],["PUT","/admin/plans/1/access"],
  ["GET","/admin/access-control"],["POST","/admin/access-control/permissions"],
  ["POST","/admin/access-control/roles"],["POST","/admin/access-control/users"],
  ["GET","/admin/platform-activity"],["GET","/admin/apps"],["POST","/admin/apps"],["PUT","/admin/apps/1"],
  ["GET","/admin/industries"],["POST","/admin/industries"],["PUT","/admin/industries/1"],
  ["GET","/api/platform/admin/tenants"],["POST","/api/platform/admin/tenants"],
  ["GET","/admin/future-operation"]
] as const;

function identity(userType: AuthUserType, label: string) {
  const token=signAuthToken({email:`${label}@example.test`,userId:label,userType,
    ...(userType==="tenant"?{tenantId:label,tenantDbName:`synthetic_${label}`,tenantCode:label}: {})});
  const payload=verifyAuthToken(token)!;
  const session:AuthSessionRecord={context:emptySessionCache(),expiresAt:new Date(payload.exp*1000),jti:payload.jti,lastSeenAt:new Date(),loginHost:payload.loginHost,revokedAt:null,tenantAccessMode:payload.tenantAccessMode,tenantCode:payload.tenantCode??null,tenantDbName:payload.tenantDbName??null,tenantId:payload.tenantId??null,userEmail:payload.email,userName:label,userType,userUuid:payload.userId,uuid:label};
  return {token,payload,session};
}

test("actual global admin reads and writes require active Super Admin authority",async t=>{
  const app=Fastify();
  const sessions=new Map<string,AuthSessionRecord>();
  let businessCalls=0;
  t.mock.method(AuthSessionRepository.prototype,"findActive",async(jti:string)=>sessions.get(jti)??null);
  t.mock.method(TenantRepository.prototype,"findByIdOrCode",async()=>{throw new Error("Global admin denial must precede tenant database resolution");});
  const services:[object,string[]][]=[
    [TenantService.prototype,["listTenants","createTenant","updateTenant","suspendTenant","restoreTenant","listActivity"]],
    [PlanService.prototype,["listPlans","createPlan","updatePlan"]],
    [SubscriptionService.prototype,["listSubscriptions","createSubscription","updateSubscription"]],
    [EntitlementService.prototype,["listEntitlements","listTenantAccess","getPlanAccess","savePlanAccess","createEntitlement","updateEntitlement"]],
    [AccessControlService.prototype,["overview","savePermission","saveRole","saveUser"]],
    [PlatformActivityService.prototype,["listActivity"]],[AppRegistryService.prototype,["listApps","createApp","updateApp"]],
    [IndustryService.prototype,["listIndustries","createIndustry","updateIndustry"]]
  ];
  for(const [prototype,names] of services)for(const name of names){
    t.mock.method(prototype as Record<string,()=>Promise<unknown>>,name,async()=>{businessCalls++;return [];});
  }
  registerAuthRequestContext(app);
  for(const register of [registerTenantRoutes,registerPlanRoutes,registerSubscriptionRoutes,registerEntitlementRoutes,registerAccessControlRoutes,registerPlatformActivityRoutes,registerAppRegistryRoutes,registerIndustryRoutes])await register(app);
  await app.register(async scope=>{await registerTenantRoutes(scope);},{prefix:"/api/platform"});
  app.get("/admin/future-operation",async()=>{businessCalls++;return {success:true};});
  app.get("/auth/session",async request=>({userType:request.authContext?.payload.userType}));
  app.get("/public/admin-information",async()=>({public:true}));
  try {
    await app.ready();
    for(const caller of ["tenant_admin","tenant_user","staff","anonymous"]){
      await t.test(`${caller} cannot execute any global read or write`,async()=>{
        const auth=caller==="anonymous"?null:identity(caller==="staff"?"staff":"tenant",caller);
        if(auth){
          auth.session.context.safeSettings={role:caller==="tenant_admin"?"super-admin":"user",permissions:["*"]};
          sessions.set(auth.payload.jti,auth.session);
        }
        for(const [method,url] of operations){
          const response=await app.inject({method,url,headers:{...(auth?{authorization:`Bearer ${auth.token}`} : {}),"x-user-type":"super_admin","x-role":"super-admin","x-tenant-id":"another-tenant"},...(["POST","PUT"].includes(method)?{payload:{userType:"super_admin",desk:"sa"}}:{})});
          assert.equal(response.statusCode,403,`${method} ${url}`);
          if(method!=="HEAD")assert.equal(response.json().error.code,"SUPER_ADMIN_REQUIRED");
        }
        assert.equal(businessCalls,0);
      });
    }
    await t.test("signed claims alone, mismatched sessions, expired and revoked records grant no access",async()=>{
      const operator=identity("super_admin","operator");
      for(const session of [null,{...operator.session,userType:"staff" as const},{...operator.session,expiresAt:new Date(0)},{...operator.session,revokedAt:new Date()}]){
        sessions.clear();if(session)sessions.set(operator.payload.jti,session);
        const response=await app.inject({url:"/admin/tenants",headers:{authorization:`Bearer ${operator.token}`}});
        assert.ok([401,403].includes(response.statusCode));assert.equal(businessCalls,0);
      }
      const forged=await app.inject({url:"/admin/tenants",headers:{authorization:"Bearer forged-super-admin"}});
      assert.equal(forged.statusCode,401);assert.equal(businessCalls,0);
    });
    await t.test("active server-backed Super Admin retains global reads and writes",async()=>{
      const operator=identity("super_admin","operator");sessions.set(operator.payload.jti,operator.session);
      for(const url of ["/admin/tenants","/api/platform/admin/tenants","/admin/plans","/admin/subscriptions","/admin/entitlements","/admin/access-control","/admin/apps","/admin/industries","/admin/platform-activity","/admin/future-operation"]){
        assert.equal((await app.inject({url,headers:{authorization:`Bearer ${operator.token}`}})).statusCode,200,url);
      }
      assert.equal((await app.inject({method:"POST",url:"/admin/tenants",headers:{authorization:`Bearer ${operator.token}`},payload:{}})).statusCode,200);
      assert.equal(businessCalls,11);
    });
    await t.test("staff keeps its own session route and public paths remain public",async()=>{
      const staff=identity("staff","staff");sessions.set(staff.payload.jti,staff.session);
      assert.equal((await app.inject({url:"/auth/session",headers:{authorization:`Bearer ${staff.token}`}})).json().userType,"staff");
      assert.equal((await app.inject({url:"/public/admin-information"})).statusCode,200);
    });
  }finally{await app.close();}
});

test("authority parsing never defaults unknown metadata to Super Admin or platform mode",()=>{
  assert.equal(parseSessionAuthority("unknown","platform"),null);
  assert.equal(parseSessionAuthority("super_admin","unknown"),null);
  assert.equal(parseSessionAuthority("",""),null);
  assert.deepEqual(parseSessionAuthority("super_admin","platform"),{userType:"super_admin",tenantAccessMode:"platform"});
  assert.equal(hasActiveSuperAdminSession(undefined),false);
  const operator=identity("super_admin","operator");
  assert.equal(hasActiveSuperAdminSession(operator),true);
  assert.equal(hasActiveSuperAdminSession({...operator,payload:{...operator.payload,exp:0}}),false);
  assert.equal(hasActiveSuperAdminSession({...operator,session:{...operator.session,userUuid:"other"}}),false);
});

test("only the global admin namespace is selected from registered route patterns",()=>{
  for(const path of ["/admin","/admin/tenants/:id","/api/platform/admin/tenants"])assert.equal(isGlobalPlatformAdminRoute(path),true);
  for(const path of ["/administrator","/public/admin","/tenant/roles","/api/other/admin","/auth/session"])assert.equal(isGlobalPlatformAdminRoute(path),false);
});
