import {
  migrateChatModule,
  writeWorkMessage,
  ChatRepository
} from "../../apps/chat/api/src/index.js";
import {
  workReportModule,
  recordWorkEvent,
  seedEnquiryModule,
  seedCrmTenantDatabase,
  dutyAssignmentModule,
  taskPermissionForRequest,
  type WorkReportContext,
  type WorkReportDatabase
} from "../../apps/crm/api/src/index.js";
import type { Transaction } from "kysely";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createConnection } from "mysql2/promise";
import { createApiApp } from "@codexsun/framework/api";
import { AppError } from "@codexsun/framework/errors";
import { sql } from "kysely";
import { env } from "../../apps/platform/api/src/env.js";
import {
  migrateCoreTenantDatabase,
  seedCoreTenantDatabase,
  getCoreDatabase,
  closeCoreDatabase
} from "../../apps/core/api/src/database/core-database.js";
import {
  getActiveContactForDatabase,
  resolveOrCreateCustomerForDatabase
} from "../../apps/core/api/src/modules/master/contact/index.js";
import { migrateTenantRuntimeModule } from "../../apps/platform/api/src/modules/tenant/tenant.migration.js";
import { migrateCrmTenantDatabase } from "../../apps/crm/api/src/crm.migration.js";
import { seedStatusMaster } from "../../apps/crm/api/src/modules/status/index.js";
import { seedPriorityMaster } from "../../apps/crm/api/src/modules/priority/index.js";
import { taskModule, type TaskContext } from "../../apps/crm/api/src/modules/task/index.js";

test(
  "admin assignment, user GPS actions, chat delivery, retries, and isolation",
  { timeout: 60000 },
  async (suite) => {
    assert.equal(env.NODE_ENV, "development");
    const name = `codexsun_work_reports_e2e_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const admin = await createConnection({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD
    });
    const app = await createApiApp({
      appName: "codexsun-work-reports-e2e",
      cookieSecret: "codexsun-task-contact-test-secret",
      corsOrigins: [],
      environment: "development"
    });
    suite.after(async () => {
      await app.close();
      await closeCoreDatabase();
      assert.match(name, /^codexsun_work_reports_e2e_[a-f0-9]{16}$/);
      try {
        await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
      } finally {
        await admin.end();
      }
    });
    await migrateCoreTenantDatabase(name);
    await seedCoreTenantDatabase(name);
    const database = getCoreDatabase(name) as unknown as TaskContext["database"];
    await migrateTenantRuntimeModule(database as never);
    await migrateCrmTenantDatabase(database as never);
    await sql`INSERT INTO app_roles (uuid,\`key\`,label,status) VALUES ('f00d0001','admin','Admin','active'),('f00d0002','super-admin','Super Admin','active'),('f00d0003','manager','Manager','active'),('f00d0004','user','User','active')`.execute(
      database
    );
    await seedCoreTenantDatabase(name);
    const coreGrants = await sql<{
      role: string;
      permission: string;
    }>`SELECT r.\`key\` AS role,p.\`key\` AS permission FROM app_role_permissions rp JOIN app_roles r ON r.id=rp.role_id JOIN app_permissions p ON p.id=rp.permission_id WHERE p.\`key\` LIKE 'core.application.records.%' AND rp.status='active'`.execute(
      database
    );
    for (const role of ["super-admin", "manager", "user"]) {
      assert.ok(
        coreGrants.rows.some(
          (g) => g.role === role && g.permission === "core.application.records.view"
        )
      );
      assert.equal(
        coreGrants.rows.filter(
          (g) =>
            g.role === role &&
            g.permission !== "core.application.records.view" &&
            !(role === "user" && g.permission === "core.application.records.create")
        ).length,
        0,
        "Core defaults must not grant administrative master writes"
      );
    }
    assert.ok(
      coreGrants.rows.some(
        (g) => g.role === "user" && g.permission === "core.application.records.create"
      ),
      "Standard User retains the published record-create default"
    );
    await seedEnquiryModule(database as never);
    await seedEnquiryModule(database as never);
    const grants = await sql<{
      role: string;
      permission: string;
    }>`SELECT role.\`key\` AS role, permission.\`key\` AS permission FROM app_role_permissions grant_row JOIN app_roles role ON role.id=grant_row.role_id JOIN app_permissions permission ON permission.id=grant_row.permission_id WHERE permission.\`key\` LIKE 'crm.enquiry.%' AND grant_row.status='active'`.execute(
      database
    );
    for (const role of ["admin", "super-admin", "manager", "user"]) {
      for (const action of ["view", "create", "update"])
        assert.ok(
          grants.rows.some((g) => g.role === role && g.permission === "crm.enquiry." + action)
        );
    }
    assert.equal(
      grants.rows.filter((g) => g.role === "user" && g.permission === "crm.enquiry.view-all")
        .length,
      0
    );
    assert.equal(
      new Set(grants.rows.map((grant) => `${grant.role}:${grant.permission}`)).size,
      grants.rows.length,
      "repeatable role grants must not duplicate"
    );
    await seedCrmTenantDatabase(database as never);
    await seedCrmTenantDatabase(database as never);
    const managerGrants = await sql<{ permission: string }>`
      SELECT p.\`key\` AS permission FROM app_role_permissions rp
      JOIN app_roles r ON r.id=rp.role_id JOIN app_permissions p ON p.id=rp.permission_id
      WHERE r.\`key\`='manager' AND rp.status='active'
    `.execute(database);
    const managerPermissions = new Set(managerGrants.rows.map((row) => row.permission));
    assert.equal(
      managerPermissions.size,
      managerGrants.rows.length,
      "role seeds must be repeatable"
    );
    for (const permission of [
      "crm.contact.view",
      "crm.call-log.view",
      "crm.sop.view",
      "crm.duty.view.own",
      "crm.duty.view.all",
      "crm.duty-report.view.all",
      "crm.contact-profiles.view",
      "crm.contact-people.view",
      "crm.contact-tags.view"
    ])
      assert.ok(managerPermissions.has(permission), permission);
    for (const permission of [
      "crm.contact.create",
      "crm.call-log.create",
      "crm.sop.create",
      "crm.duty.assign",
      "crm.duty.manage",
      "crm.contact-profiles.update",
      "core.application.records.update"
    ])
      assert.equal(managerPermissions.has(permission), false, permission);
    await seedStatusMaster(database as never);
    await seedPriorityMaster(database as never);
    await sql`INSERT INTO app_users (uuid,name,email,password_hash,status) VALUES ('testuser','Task tester','task@example.test','test-only','active')`.execute(
      database
    );
    const actor = await database.selectFrom("app_users").select("id").executeTakeFirstOrThrow();
    const status = await database
      .selectFrom("crm_enquiry_statuses")
      .select("id")
      .where("code", "=", "new")
      .executeTakeFirstOrThrow();
    const priority = await database
      .selectFrom("crm_enquiry_priorities")
      .select("id")
      .where("code", "=", "normal")
      .executeTakeFirstOrThrow();

    await migrateChatModule(database as never);
    await sql`INSERT INTO app_users (uuid,name,email,password_hash,status) VALUES ('fieldusr','Field user','field@example.test','test-only','active'), ('outsider','Other user','other@example.test','test-only','active')`.execute(
      database
    );
    const field = await database
      .selectFrom("app_users")
      .select("id")
      .where("email", "=", "field@example.test")
      .executeTakeFirstOrThrow();
    let actorEmail = "task@example.test";
    let actorId = actor.id;
    let manager = true;
    const authorize = async (permission: string) => {
      if (
        !manager &&
        (permission.endsWith("view-all") ||
          permission.endsWith("create") ||
          (permission.endsWith("update") && permission.startsWith("crm.task")))
      )
        throw AppError.forbidden("Denied");
    };
    const workContext = (): WorkReportContext => ({
      database: database as never,
      actorEmail,
      actorUserId: actorId,
      authorize,
      sendMessage: async (trx, message) =>
        writeWorkMessage(trx as never, { ...message, actorEmail, companyId: 1 })
    });
    await taskModule.register(app, async (request) => {
      const permission = taskPermissionForRequest(request.method, request.url.split("?")[0]!);
      if (permission) await authorize(`crm.task.${permission}`);
      return {
        database,
        actorEmail,
        actorUserId: actorId,
        canViewAll: manager,
        authorize,
        workEvent: async (trx, taskId, action, body) => {
          await recordWorkEvent(
            workContext(),
            trx as unknown as Transaction<WorkReportDatabase>,
            { taskId, enquiryId: null },
            action,
            body
          );
        }
      };
    });
    await workReportModule.register(app, async () => workContext());
    let dutyRole = "manager";
    await dutyAssignmentModule.register(app, async () => ({
      database: database as never,
      actorEmail,
      actorUserId: actorId,
      authorize: async (permission) => {
        if (dutyRole !== "manager" || !managerPermissions.has(permission))
          throw AppError.forbidden("Permission required");
      }
    }));
    const send = async (
      method: "GET" | "POST" | "PUT" | "PATCH",
      url: string,
      payload?: unknown,
      statusCode = 200
    ) => {
      const response = await app.inject({
        method,
        url,
        ...(payload === undefined ? {} : { payload })
      });
      assert.equal(response.statusCode, statusCode, response.body);
      return response.json().data;
    };
    assert.ok((await send("GET", "/crm/duty-users")).length > 0);
    const dutyOptions = await send("GET", "/crm/duty-assignments/options");
    assert.equal(dutyOptions.canViewAll, true);
    assert.equal(dutyOptions.canCreate, false);
    assert.equal(dutyOptions.canEdit, false);
    await send(
      "POST",
      "/crm/duty-assignments",
      {
        sopItemId: 1,
        revisionId: 1,
        assigneeUserId: actorId,
        displayOrder: 0,
        startDate: "2026-10-17",
        endDate: null
      },
      403
    );
    dutyRole = "user";
    await send("GET", "/crm/duty-users", undefined, 403);
    dutyRole = "manager";
    const task = await send("POST", "/crm/tasks", {
      title: "Deliver office bill",
      description: "Deliver to linked customer",
      listInId: null,
      priorityId: priority.id,
      statusId: status.id,
      assignedUserId: field.id,
      dueDate: null
    });
    const openStatus = await database
      .selectFrom("crm_enquiry_statuses")
      .select("id")
      .where("code", "=", "open")
      .executeTakeFirstOrThrow();
    const taskProperties = await send("PATCH", `/crm/tasks/${task.id}/properties`, {
      priorityId: priority.id,
      statusId: openStatus.id,
      dueDate: "2026-10-20"
    });
    assert.equal(taskProperties.status, "open");
    assert.equal(taskProperties.dueDate, "2026-10-20");
    const events = await send("GET", `/crm/work-reports?taskId=${task.id}`);
    assert.equal(events.length, 3);
    assert.ok(events.some((event: { action: string }) => event.action === "created"));
    assert.ok(events.some((event: { action: string }) => event.action === "properties-updated"));
    const assignmentEvent = events.find((event: { action: string }) => event.action === "assigned");
    assert.ok(assignmentEvent);
    assert.equal(assignmentEvent.created_by_name, "Task tester");
    assert.equal(assignmentEvent.body, "Deliver to linked customer");
    await send("POST", `/crm/tasks/${task.id}/comments`, { body: "Bill acknowledged" });
    await send("POST", `/crm/tasks/${task.id}/jobs/start`);
    await send("POST", `/crm/tasks/${task.id}/jobs/stop`);
    const actionHistory = await send("GET", `/crm/work-reports?taskId=${task.id}`);
    assert.ok(actionHistory.some((row: { action: string }) => row.action === "job-stopped"));
    assert.ok(actionHistory.some((row: { action: string }) => row.action === "job-started"));
    assert.equal(
      actionHistory.filter((row: { body: string }) => row.body === "Bill acknowledged").length,
      1
    );
    const previousEvent = await database
      .selectFrom("crm_work_reports")
      .select("id")
      .where("task_id", "=", task.id)
      .orderBy("id", "desc")
      .executeTakeFirstOrThrow();
    await sql`UPDATE crm_work_reports SET action='report', body='comment: Older rich-text comment' WHERE id=${previousEvent.id}`.execute(
      database
    );
    const legacyHistory = await send("GET", `/crm/work-reports?taskId=${task.id}`);
    assert.ok(
      legacyHistory.some(
        (row: { action: string; body: string }) =>
          row.action === "comment-added" && row.body === "Older rich-text comment"
      )
    );

    const chat = new ChatRepository();
    const chatContext = () => ({
      database: database as never,
      actorEmail,
      companyId: 1,
      tenantId: "e2e",
      tenantDatabase: name,
      authorize
    });
    actorEmail = "field@example.test";
    actorId = field.id;
    manager = false;
    const conversations = await chat.listChannels(chatContext(), {});
    assert.equal(conversations.length, 1);
    const detail = await chat.channelDetail(chatContext(), conversations[0]!.uuid);
    assert.ok(detail.members.some((member) => member.userEmail === "task@example.test"));
    const payload = {
      enquiryId: null,
      taskId: task.id,
      action: "check-in",
      body: "Arrived at office",
      requestId: "codexsun-checkin-01",
      latitude: 13.082700004,
      longitude: 80.2707,
      accuracyMeters: 7.50000003,
      capturedAt: new Date().toISOString()
    };
    await send(
      "POST",
      "/crm/work-reports",
      { ...payload, action: "check-out", requestId: "codexsun-checkout-before" },
      409
    );
    assert.equal(
      (await send("GET", `/crm/work-reports/checkpoint?taskId=${task.id}`)).checkedIn,
      false
    );
    const checkin = await send("POST", "/crm/work-reports", payload);
    assert.equal(
      (await send("GET", `/crm/work-reports/checkpoint?taskId=${task.id}`)).checkedIn,
      true
    );

    const retry = await send("POST", "/crm/work-reports", payload);
    assert.equal(retry.uuid, checkin.uuid);
    await send(
      "POST",
      "/crm/work-reports",
      { ...payload, requestId: "codexsun-double-checkin" },
      409
    );
    await send("POST", "/crm/work-reports", { ...payload, body: "Different retry" }, 409);
    await send(
      "POST",
      "/crm/work-reports",
      { ...payload, latitude: null, requestId: "codexsun-no-gps" },
      400
    );
    const report = await send("POST", "/crm/work-reports", {
      enquiryId: null,
      taskId: task.id,
      action: "report",
      body: "Bill collected",
      requestId: "codexsun-report-01"
    });
    assert.equal(report.created_by, actorEmail);
    const checkout = await send("POST", "/crm/work-reports", {
      ...payload,
      action: "check-out",
      body: "Delivered bill",
      requestId: "codexsun-checkout-01"
    });
    assert.equal(
      (await send("GET", `/crm/work-reports/checkpoint?taskId=${task.id}`)).checkedIn,
      false
    );
    assert.equal(Number(checkout.latitude), 13.0827);
    assert.equal(Number(checkout.longitude), 80.2707);
    const userChannels = await chat.listChannels(chatContext(), {});
    const userChat = await chat.channelDetail(chatContext(), userChannels[0]!.uuid);
    assert.ok(userChat.messages.length >= 8);
    assert.ok(
      userChat.messages.some(
        (message) => message.body.includes("Delivered bill") && message.body.includes("GPS:")
      )
    );
    const channelId = userChannels[0]!.uuid;
    const reader = chatContext();
    assert.ok((await chat.listChannels(reader, {}))[0]!.unreadCount > 0);
    const seen = userChat.messages.at(-1)!.id;
    await chat.markRead(reader, channelId, seen);
    assert.equal((await chat.listChannels(reader, {}))[0]!.unreadCount, 0);
    const sender = { ...reader, actorEmail: "task@example.test" };
    const freshMessage = await chat.createMessage(sender, {
      channelUuid: channelId,
      body: "CODEXSUN unread after assignment read"
    });
    // A later message remains unread even when both inserts use the same second.
    assert.equal((await chat.listChannels(reader, {}))[0]!.unreadCount, 1);
    await chat.markRead(reader, channelId, seen);
    assert.equal(
      (await chat.listChannels(reader, {}))[0]!.unreadCount,
      1,
      "old read cursor must not hide a newer message"
    );
    await chat.markRead(reader, channelId, freshMessage.id);
    assert.equal((await chat.listChannels(reader, {}))[0]!.unreadCount, 0);
    const chargePayload = {
      enquiryId: null,
      taskId: task.id,
      action: "charge",
      amount: 150,
      body: "Service visit",
      requestId: "codexsun-task-charge-01"
    };
    await send("POST", "/crm/work-reports", chargePayload);
    const pendingCharges = await send(
      "GET",
      `/crm/work-reports/history?taskId=${task.id}&filter=charges`
    );
    assert.deepEqual(pendingCharges.amounts, { charges: 150, collections: 0 });
    await send(
      "POST",
      "/crm/work-reports",
      {
        ...chargePayload,
        action: "collection",
        amount: 40.5,
        body: "",
        requestId: "codexsun-task-collection-blank"
      },
      400
    );
    const collectionPayload = {
      ...chargePayload,
      action: "collection",
      amount: 40.5,
      body: "Cash received",
      requestId: "codexsun-task-collection-01"
    };
    const collection = await send("POST", "/crm/work-reports", collectionPayload);
    assert.equal(
      (await send("POST", "/crm/work-reports", collectionPayload)).uuid,
      collection.uuid
    );
    const partialCharges = await send(
      "GET",
      `/crm/work-reports/history?taskId=${task.id}&filter=charges`
    );
    assert.deepEqual(partialCharges.amounts, { charges: 150, collections: 40.5 });
    assert.ok(partialCharges.items.some((item: { body: string }) => item.body === "Cash received"));
    await send(
      "POST",
      "/crm/work-reports",
      {
        ...collectionPayload,
        amount: 110,
        requestId: "codexsun-task-collection-over"
      },
      409
    );
    await send("POST", "/crm/work-reports", {
      ...collectionPayload,
      amount: 109.5,
      requestId: "codexsun-task-collection-final"
    });
    const settledCharges = await send(
      "GET",
      `/crm/work-reports/history?taskId=${task.id}&filter=charges`
    );
    assert.deepEqual(settledCharges.amounts, { charges: 150, collections: 150 });
    actorEmail = "other@example.test";
    actorId = (
      await database
        .selectFrom("app_users")
        .select("id")
        .where("email", "=", actorEmail)
        .executeTakeFirstOrThrow()
    ).id;
    await send("GET", `/crm/work-reports?taskId=${task.id}`, undefined, 403);
    await send("POST", "/crm/work-reports", { ...payload, requestId: "codexsun-unrelated" }, 403);
    assert.equal((await chat.listChannels(chatContext(), {})).length, 0);
    actorEmail = "task@example.test";
    actorId = actor.id;
    manager = true;
    const adminReports = await send("GET", `/crm/work-reports?taskId=${task.id}`);
    assert.ok(adminReports.length >= 9);
    assert.ok(adminReports.some((row: { uuid: string }) => row.uuid.endsWith(checkout.uuid)));
    await sql`INSERT INTO crm_enquiries (title,description,enquired_at,created_by,status_id,priority_id,assigned_user_id,enquiry_no) VALUES ('Site visit','Visit customer',UTC_TIMESTAMP(),'task@example.test',${status.id},${priority.id},${field.id},1)`.execute(
      database
    );
    const enquiry = await sql<{
      id: number;
    }>`SELECT id FROM crm_enquiries WHERE enquiry_no=1`.execute(database);
    actorEmail = "field@example.test";
    actorId = field.id;
    manager = false;
    const enquiryId = enquiry.rows[0]!.id;
    const arrival = await send("POST", "/crm/work-reports", {
      ...payload,
      enquiryId,
      taskId: null,
      requestId: "codexsun-enquiry-arrival"
    });
    assert.equal(arrival.enquiry_id, enquiryId);
    await send("POST", "/crm/work-reports", {
      ...payload,
      enquiryId,
      taskId: null,
      action: "check-out",
      requestId: "codexsun-enquiry-departure"
    });
    await send("GET", "/crm/work-reports?taskId=99999", undefined, 404);
    await send("GET", `/crm/work-reports?taskId=${task.id}&enquiryId=${enquiryId}`, undefined, 400);
    // A self-created record has no other participant: route its update to active administrators.
    await sql`INSERT INTO app_roles (uuid,\`key\`,label,status) VALUES ('roleadmn','admin','Administrator','active') ON DUPLICATE KEY UPDATE status='active'`.execute(
      database
    );
    await sql`INSERT INTO app_user_roles (uuid,user_id,role_id,status) SELECT 'adminlnk',${actor.id},id,'active' FROM app_roles WHERE \`key\`='admin' ON DUPLICATE KEY UPDATE status='active'`.execute(
      database
    );
    await sql`UPDATE crm_enquiries SET created_by='field@example.test' WHERE id=${enquiryId}`.execute(
      database
    );
    await send("POST", "/crm/work-reports", {
      enquiryId,
      taskId: null,
      action: "report",
      body: "Needs administrator review",
      requestId: "codexsun-admin-fallback"
    });
    const fallbackChannels = await chat.listChannels(chatContext(), {});
    const fallback = await chat.channelDetail(
      chatContext(),
      fallbackChannels.find((channel) => channel.name.includes("Site visit"))!.uuid
    );
    assert.ok(
      fallback.members.some((member) => member.userEmail === "task@example.test"),
      "fallback delivers to admin"
    );
    // A different company cannot resolve the conversation even with the same actor.
    assert.equal((await chat.listChannels({ ...chatContext(), companyId: 2 }, {})).length, 0);
    actorEmail = "other@example.test";
    actorId = (
      await database
        .selectFrom("app_users")
        .select("id")
        .where("email", "=", actorEmail)
        .executeTakeFirstOrThrow()
    ).id;
    await assert.rejects(chat.channelDetail(chatContext(), fallback.channel.uuid));
    await assert.rejects(chat.requireMessage(chatContext(), fallback.messages[0]!.uuid));
    actorEmail = "field@example.test";
    actorId = field.id;
    await send(
      "PUT",
      `/crm/tasks/${task.id}`,
      {
        title: "Must not edit",
        description: "",
        listInId: null,
        priorityId: priority.id,
        statusId: status.id,
        assignedUserId: field.id,
        dueDate: null
      },
      403
    );
    const completion = await send("POST", `/crm/tasks/${task.id}/closure-requests`, {
      reason: "Field work completed"
    });
    assert.equal(completion.status, "pending");
    const completionRows = await send("GET", `/crm/tasks/${task.id}/closure-requests`);
    assert.equal(completionRows[0].id, completion.id);
    manager = true;
    const reviewed = await send("POST", `/crm/tasks/closure-requests/${completion.id}/review`, {
      decision: "approved",
      note: "Verified in the task workflow."
    });
    assert.equal(reviewed.reviewed, true);
    const closedTask = await send("GET", `/crm/tasks/${task.id}`);
    assert.equal(closedTask.status, "closed");
    // Failed chat delivery must roll back the action report as well.
    const before = (await send("GET", `/crm/work-reports?enquiryId=${enquiryId}`)).length;
    const failing = workContext();
    failing.sendMessage = async () => {
      throw new Error("Chat unavailable");
    };
    const { WorkReportService } =
      await import("../../apps/crm/api/src/modules/work-report/work-report.service.js");
    await assert.rejects(
      new WorkReportService(failing).create({
        ...payload,
        enquiryId,
        taskId: null,
        action: "report",
        requestId: "codexsun-rollback",
        body: "Must roll back"
      })
    );
    assert.equal((await send("GET", `/crm/work-reports?enquiryId=${enquiryId}`)).length, before);
  }
);
