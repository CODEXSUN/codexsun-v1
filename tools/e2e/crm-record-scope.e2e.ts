import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { sql } from "kysely";
import { createConnection } from "mysql2/promise";
import { createApiApp } from "@codexsun/framework/api";
import { AppError } from "@codexsun/framework/errors";
import { env } from "../../apps/platform/api/src/env.js";
import { authorizeTenantUser } from "../../apps/platform/api/src/auth/tenant-access-context.js";
import { migrateTenantRuntimeModule } from "../../apps/platform/api/src/modules/tenant/tenant.migration.js";
import { seedTenantRoleModule } from "../../apps/platform/api/src/modules/tenant-role/tenant-role.seed.js";
import { TenantPermissionService } from "../../apps/platform/api/src/modules/tenant-permission/tenant-permission.service.js";
import { TenantRolePermissionService } from "../../apps/platform/api/src/modules/tenant-role-permission/tenant-role-permission.service.js";
import {
  migrateCoreTenantDatabase,
  getCoreDatabase,
  closeCoreDatabase
} from "../../apps/core/api/src/database/core-database.js";
import { migrateCrmTenantDatabase } from "../../apps/crm/api/src/crm.migration.js";
import { enquiryModule, seedEnquiryModule } from "../../apps/crm/api/src/modules/enquiry/index.js";
import { taskModule, seedTaskPermissions } from "../../apps/crm/api/src/modules/task/index.js";
import { activitiesModule } from "../../apps/crm/api/src/modules/activities/index.js";
import { closureModule } from "../../apps/crm/api/src/modules/closure/index.js";
import { seedCoreTenantPermissions } from "../../apps/core/api/src/auth/tenant-permission.seed.js";
import { authorizeEnquiryWrite } from "../../apps/crm/api/src/modules/enquiry/enquiry.write-access.js";
import { seedStatusMaster } from "../../apps/crm/api/src/modules/status/index.js";
import { seedPriorityMaster } from "../../apps/crm/api/src/modules/priority/index.js";
import { enquiryLocationModule } from "../../apps/crm/api/src/modules/enquiry-location/index.js";
import { workReportModule } from "../../apps/crm/api/src/modules/work-report/index.js";

test(
  "CRM record scope uses live roles, protects direct actions, and reconciles legacy grants",
  { timeout: 120000 },
  async (suite) => {
    assert.equal(env.NODE_ENV, "development");
    const name = `codexsun_crm_scope_e2e_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const admin = await createConnection({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD
    });
    const app = await createApiApp({
      appName: "codexsun-crm-scope-test",
      cookieSecret: "codexsun-scope-test-secret",
      corsOrigins: [],
      environment: "development"
    });
    suite.after(async () => {
      await app.close();
      await closeCoreDatabase();
      assert.match(name, /^codexsun_crm_scope_e2e_[a-f0-9]{16}$/);
      try {
        await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
      } finally {
        await admin.end();
      }
    });
    await migrateCoreTenantDatabase(name);
    const database = getCoreDatabase(name);
    await migrateTenantRuntimeModule(database as never);
    await migrateCrmTenantDatabase(database as never);
    await seedTenantRoleModule(database as never);
    await seedStatusMaster(database as never);
    await seedPriorityMaster(database as never);
    await seedEnquiryModule(database as never);
    await seedTaskPermissions(database as never);
    await seedCoreTenantPermissions(database as never);
    for (const [id, role] of [
      [1, "admin"],
      [2, "user"],
      [3, "user"],
      [4, "team-head"],
      [5, "manager"]
    ] as const) {
      await sql`INSERT INTO app_users (id,uuid,name,email,password_hash,status) VALUES (${id},${`scope00${id}`},${role},${`scope${id}@example.test`},'test-only','active')`.execute(
        database
      );
      await sql`INSERT INTO app_user_roles (uuid,user_id,role_id,status,is_protected) SELECT ${`usr0000${id}`},${id},id,'active',FALSE FROM app_roles WHERE \`key\`=${role}`.execute(
        database
      );
    }
    const status = (
      await sql<{ id: number }>`SELECT id FROM crm_enquiry_statuses WHERE code='new'`.execute(
        database
      )
    ).rows[0]!.id;
    const priority = (
      await sql<{ id: number }>`SELECT id FROM crm_enquiry_priorities WHERE code='normal'`.execute(
        database
      )
    ).rows[0]!.id;
    for (const [id, assigned, creator] of [
      [1, 2, 1],
      [2, 3, 2],
      [3, 3, 3],
      [4, null, 3]
    ] as const) {
      await sql`INSERT INTO crm_enquiries (id,enquiry_no,uuid,title,captured_name,source,status_id,priority_id,assigned_user_id,enquired_at,created_by) VALUES (${id},${id},${`enq0000${id}`},${`Scope enquiry ${id}`},'Fixture customer','manual',${status},${priority},${assigned},NOW(),${`scope${creator}@example.test`})`.execute(
        database
      );
      await sql`INSERT INTO crm_enquiry_activity (uuid,enquiry_id,action,details,created_by) VALUES (${`act0000${id}`},${id},'created',${`Scope activity ${id}`},${`scope${creator}@example.test`})`.execute(
        database
      );
      await sql`INSERT INTO crm_tasks (id,uuid,title,description,status_id,priority_id,assigned_user_id,created_by) VALUES (${id},${`tsk0000${id}`},${`Scope task ${id}`},'',${status},${priority},${assigned},${`scope${creator}@example.test`})`.execute(
        database
      );
    }
    const scope = async (email: string, resource: "enquiry" | "task") => {
      const authorize = (permission: string) =>
        authorizeTenantUser(database as never, email, permission);
      await authorize(`crm.${resource}.view`);
      const actor = (
        await sql<{
          id: number;
        }>`SELECT id FROM app_users WHERE email=${email} AND status='active'`.execute(database)
      ).rows[0]!;
      let canViewAll = false;
      try {
        await authorize(`crm.${resource}.view-all`);
        canViewAll = true;
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== "FORBIDDEN") throw error;
      }
      return {
        database: database as never,
        actorEmail: email,
        actorUserId: actor.id,
        canViewAll,
        authorize
      };
    };
    const emailFor = (headers: Record<string, unknown>) =>
      String(headers["x-test-actor"] ?? "scope2@example.test");
    await enquiryModule.register(app, async (request) => ({
      ...(await scope(emailFor(request.headers), "enquiry")),
      relations: {
        contact: async () => null,
        resolveOrCreateCustomer: async () => {
          throw new Error("Read-only scope fixture");
        },
        user: async () => ({ name: "Fixture user" }),
        listIn: async () => null,
        priority: async () => ({ name: "Normal" }),
        status: async () => ({ name: "New", code: "new" })
      },
      listUsers: async () => []
    }));
    await taskModule.register(app, async (request) => scope(emailFor(request.headers), "task"));
    await activitiesModule.register(app, async (request) =>
      scope(emailFor(request.headers), "enquiry")
    );
    await closureModule.register(app, async (request) => ({
      ...(await scope(emailFor(request.headers), "enquiry")),
      canReview: true
    }));
    const read = async (path: string, actor = 2) =>
      app.inject({
        method: "GET",
        url: path,
        headers: { "x-test-actor": `scope${actor}@example.test` }
      });
    await enquiryLocationModule.register(app, async (request) => {
      const context = await scope(emailFor(request.headers), "enquiry");
      if (request.method === "POST") await context.authorize("crm.enquiry.work");
      return context;
    });
    await workReportModule.register(app, async (request) =>
      scope(emailFor(request.headers), "enquiry")
    );
    await authorizeTenantUser(database as never, "scope2@example.test", "crm.enquiry.work");
    await authorizeTenantUser(database as never, "scope2@example.test", "crm.enquiry.update");
    const ordinaryScope = await scope("scope2@example.test", "enquiry");
    for (const suffix of ["jobs/start", "jobs/1/stop", "properties", "comments", "locations"]) {
      await authorizeEnquiryWrite("POST", `/crm/enquiries/1/${suffix}`, ordinaryScope);
      for (const id of [2, 3, 4])
        await assert.rejects(
          authorizeEnquiryWrite("POST", `/crm/enquiries/${id}/${suffix}`, ordinaryScope),
          /Only the assignee/
        );
    }
    for (const [actor, expected] of [
      [1, 4],
      [2, 2],
      [4, 0],
      [5, 0]
    ] as const) {
      for (const module of ["enquiries", "tasks", "activities"]) {
        const response = await read(`/crm/${module}?filter=all`, actor);
        assert.equal(response.statusCode, 200, response.body);
        assert.equal(response.json().data.total, expected, `${module} actor ${actor}`);
        if (actor === 2)
          assert.deepEqual(
            response
              .json()
              .data.items.map((item: { id: number | string }) => Number(item.id))
              .sort(),
            [1, 2]
          );
        if (actor === 2 && module === "enquiries") {
          const createdRecord = response
            .json()
            .data.items.find((item: { id: number | string }) => Number(item.id) === 1);
          assert.equal(createdRecord.createdByName, "admin");
        }
      }
    }
    const summary = await read("/crm/enquiries/summary?today=2026-10-21");
    assert.equal(summary.statusCode, 200, summary.body);
    assert.equal(summary.json().data.allCount, 2);
    assert.equal(summary.json().data.assigned.total, 1);
    assert.equal(summary.json().data.created.total, 1);
    for (const path of [
      "/crm/enquiries?search=Scope%20enquiry%203",
      "/crm/tasks?search=Scope%20task%203",
      "/crm/activities?enquiry=3"
    ]) {
      const response = await read(path);
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.json().data.total, 0);
    }
    for (const path of [
      "/crm/enquiries/3",
      "/crm/enquiries/3/comments",
      "/crm/tasks/3",
      "/crm/tasks/3/comments",
      "/crm/tasks/3/jobs",
      "/crm/tasks/3/activity"
    ]) {
      const response = await read(path);
      assert.ok([403, 404].includes(response.statusCode), response.body);
    }
    for (const path of ["/crm/enquiries/3/comments", "/crm/tasks/3/comments"]) {
      const response = await app.inject({
        method: "POST",
        url: path,
        payload: { body: "Cannot post outside scope", parentId: null }
      });
      assert.ok([403, 404].includes(response.statusCode), response.body);
    }
    const reassignment = await app.inject({
      method: "PATCH",
      url: "/crm/tasks/1/properties",
      payload: { assignedUserId: 3 }
    });
    assert.equal(reassignment.statusCode, 403, reassignment.body);
    for (const id of [1, 3]) {
      await sql`INSERT INTO crm_closure_requests (enquiry_id,requested_by_user_id,requested_by,status,requested_at) VALUES (${id},3,'scope3@example.test','pending',NOW())`.execute(
        database
      );
      await sql`INSERT INTO crm_task_closure_requests (uuid,task_id,requested_by,created_by,reason,status) VALUES (${`clo0000${id}`},${id},'scope3@example.test','scope3@example.test','Fixture closure','pending')`.execute(
        database
      );
    }
    const closureList = await read("/crm/closure-requests");
    assert.equal(closureList.statusCode, 200, closureList.body);
    assert.equal(closureList.json().data.items.length, 1);
    assert.equal(closureList.json().data.items[0].enquiryId, 1);
    const outside = (
      await sql<{ id: number }>`SELECT id FROM crm_closure_requests WHERE enquiry_id=3`.execute(
        database
      )
    ).rows[0]!.id;
    const review = await app.inject({
      method: "PATCH",
      url: `/crm/closure-requests/${outside}/review`,
      payload: { decision: "reject" }
    });
    assert.equal(review.statusCode, 403, review.body);
    await sql`INSERT INTO app_role_permissions (uuid,role_id,permission_id,status,is_protected) SELECT 'review00',r.id,p.id,'active',FALSE FROM app_roles r JOIN app_permissions p ON p.\`key\`='crm.task.closure.review' WHERE r.\`key\`='user'`.execute(
      database
    );
    const outsideTask = (
      await sql<{ id: number }>`SELECT id FROM crm_task_closure_requests WHERE task_id=3`.execute(
        database
      )
    ).rows[0]!.id;
    const taskReview = await app.inject({
      method: "POST",
      url: `/crm/tasks/closure-requests/${outsideTask}/review`,
      payload: { decision: "rejected" }
    });
    assert.equal(taskReview.statusCode, 403, taskReview.body);
    await authorizeTenantUser(
      database as never,
      "scope4@example.test",
      "core.application.records.view"
    );
    // A stale or manually added broad grant must never bypass the role ceiling.
    await sql`INSERT INTO app_role_permissions (uuid,role_id,permission_id,status,is_protected) SELECT LEFT(MD5(CONCAT(r.id,':',p.id)),8),r.id,p.id,'active',FALSE FROM app_roles r JOIN app_permissions p ON p.\`key\` IN ('crm.enquiry.view-all','crm.task.view-all') WHERE r.\`key\`='user' ON DUPLICATE KEY UPDATE status='active'`.execute(
      database
    );
    for (const permission of ["crm.enquiry.view-all", "crm.task.view-all"])
      await assert.rejects(
        authorizeTenantUser(database as never, "scope2@example.test", permission),
        /Permission .* is required/
      );
    assert.equal((await read("/crm/enquiries")).json().data.total, 2);
    await seedEnquiryModule(database as never);
    await seedTaskPermissions(database as never);
    const stale = await sql<{
      count: number;
    }>`SELECT COUNT(*) count FROM app_role_permissions rp JOIN app_roles r ON r.id=rp.role_id JOIN app_permissions p ON p.id=rp.permission_id WHERE r.\`key\` NOT IN ('admin','super-admin') AND p.\`key\` IN ('crm.enquiry.view-all','crm.task.view-all') AND rp.status='active'`.execute(
      database
    );
    assert.equal(Number(stale.rows[0]!.count), 0);
    await sql`UPDATE app_roles SET label='Service Lead' WHERE \`key\`='team-head'`.execute(
      database
    );
    await seedTenantRoleModule(database as never);
    assert.equal(
      (
        await sql<{ label: string }>`SELECT label FROM app_roles WHERE \`key\`='team-head'`.execute(
          database
        )
      ).rows[0]!.label,
      "Service Lead"
    );
    const accessContext = {
      database: database as never,
      actorEmail: "scope1@example.test",
      tenantId: "test-only",
      authorize: async () => {}
    };
    await sql`INSERT INTO app_permissions (uuid,\`key\`,label,status) VALUES ('hide3600','crm.contact-profiles.view','Contact 360','active')`.execute(
      database
    );
    await sql`INSERT INTO app_role_permissions (uuid,role_id,permission_id,status,is_protected) SELECT 'hide3601',r.id,p.id,'active',FALSE FROM app_roles r JOIN app_permissions p ON p.\`key\`='crm.contact-profiles.view' WHERE r.\`key\`='admin'`.execute(
      database
    );
    assert.equal(
      (await new TenantPermissionService(accessContext).list()).some(
        (p) => p.key === "crm.contact-profiles.view"
      ),
      false
    );
    assert.equal(
      (await new TenantRolePermissionService(accessContext).list()).some(
        (p) => p.permissionKey === "crm.contact-profiles.view"
      ),
      false
    );
    const gps = {
      latitude: 13.0827,
      longitude: 80.2707,
      accuracyMeters: 8,
      capturedAt: new Date().toISOString()
    };
    for (const path of ["comments", "open-new-call"] as const) {
      for (const [record, expected] of [[1, 200], [2, 403], [3, 403]] as const) {
        const response = await app.inject({
          method: "POST",
          url: `/crm/enquiries/${record}/${path}`,
          ...(path === "comments" ? { payload: { body: "Assigned work comment", parentId: null } } : {})
        });
        assert.equal(response.statusCode, expected, response.body);
      }
    }
    for (const [record, expected] of [
      [1, 200],
      [2, 403],
      [3, 403]
    ] as const) {
      const response = await app.inject({
        method: "POST",
        url: `/crm/enquiries/${record}/locations`,
        payload: gps
      });
      assert.equal(response.statusCode, expected, response.body);
    }
    for (const action of ["check-in", "check-out"] as const) {
      const payload = {
        ...gps,
        capturedAt: new Date(Date.now() + (action === "check-out" ? 1000 : 0)).toISOString(),
        enquiryId: 1,
        taskId: null,
        action,
        body: "Assigned user checkpoint",
        amount: null,
        requestId: randomUUID()
      };
      const response = await app.inject({ method: "POST", url: "/crm/work-reports", payload });
      assert.equal(response.statusCode, 200, response.body);
      const denied = await app.inject({
        method: "POST",
        url: "/crm/work-reports",
        payload: { ...payload, enquiryId: 2, requestId: randomUUID() }
      });
      assert.equal(denied.statusCode, 403, denied.body);
    }
    const assignedCharge = await app.inject({
      method: "POST",
      url: "/crm/work-reports",
      payload: {
        enquiryId: 1,
        taskId: null,
        action: "charge",
        body: "Assigned user charge",
        amount: 10,
        requestId: randomUUID(),
        latitude: null,
        longitude: null,
        accuracyMeters: null,
        capturedAt: null
      }
    });
    assert.equal(assignedCharge.statusCode, 200, assignedCharge.body);
    const forbiddenCharge = await app.inject({
      method: "POST", url: "/crm/work-reports",
      payload: { enquiryId: 2, taskId: null, action: "charge",
        body: "Creator cannot charge another assignee", amount: 10, requestId: randomUUID(),
        latitude: null, longitude: null, accuracyMeters: null, capturedAt: null }
    });
    assert.equal(forbiddenCharge.statusCode, 403, forbiddenCharge.body);
    await sql`UPDATE app_role_permissions rp JOIN app_roles r ON r.id=rp.role_id
      JOIN app_permissions p ON p.id=rp.permission_id SET rp.status='inactive'
      WHERE r.\`key\`='user' AND p.\`key\`='crm.enquiry.update'`.execute(database);
    await assert.rejects(
      authorizeTenantUser(database as never, "scope2@example.test", "crm.enquiry.update"),
      /Permission .* is required/
    );
    await seedEnquiryModule(database as never);
    await sql`UPDATE app_user_roles ur JOIN app_roles r ON r.id=ur.role_id SET ur.status='inactive' WHERE ur.user_id=1 AND r.\`key\`='admin'`.execute(
      database
    );
    await assert.rejects(
      authorizeTenantUser(database as never, "scope1@example.test", "crm.enquiry.view-all"),
      /Permission .* is required/
    );
  }
);
