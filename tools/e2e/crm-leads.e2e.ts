import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { sql } from "kysely";
import { createConnection } from "mysql2/promise";
import { createApiApp, requireTenantAccess } from "@codexsun/framework/api";
import { AppError } from "@codexsun/framework/errors";
import { env } from "../../apps/platform/api/src/env.js";
import { signAuthToken } from "../../apps/platform/api/src/auth/jwt.js";
import { authorizeTenantUser } from "../../apps/platform/api/src/auth/tenant-access-context.js";
import { migrateTenantRuntimeModule } from "../../apps/platform/api/src/modules/tenant/tenant.migration.js";
import { seedTenantRoleModule } from "../../apps/platform/api/src/modules/tenant-role/tenant-role.seed.js";
import {
  migrateCoreTenantDatabase,
  seedCoreTenantDatabase,
  getCoreDatabase,
  closeCoreDatabase
} from "../../apps/core/api/src/database/core-database.js";
import {
  resolveOrCreateCustomerForDatabase,
  getActiveContactForDatabase,
  lookupActiveContactsForDatabase
} from "../../apps/core/api/src/index.js";
import { migrateCrmTenantDatabase } from "../../apps/crm/api/src/crm.migration.js";
import { seedStatusMaster } from "../../apps/crm/api/src/modules/status/index.js";
import { seedPriorityMaster } from "../../apps/crm/api/src/modules/priority/index.js";
import { seedEnquiryModule } from "../../apps/crm/api/src/modules/enquiry/index.js";
import { seedCrmContactPermissions } from "../../apps/crm/api/src/modules/contact/index.js";
import {
  leadModule,
  leadMigrationBatch,
  seedLead,
  migrateLead,
  acceptMarketingLead,
  type LeadContext,
  type LeadRecord
} from "../../apps/crm/api/src/modules/lead/index.js";

test(
  "CRM Leads: persisted CRUD, tenant/owner isolation, atomic conversion and intake compatibility",
  { timeout: 180000 },
  async (suite) => {
    assert.equal(env.NODE_ENV, "development");
    assert.equal(env.DB_HOST, "127.0.0.1");
    const names = [1, 2, 3, 4, 5].map(
      () => `codexsun_crm_leads_e2e_${randomUUID().replaceAll("-", "").slice(0, 12)}`
    );
    const admin = await createConnection({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD
    });
    const app = await createApiApp({
      appName: "codexsun-crm-leads-test",
      cookieSecret: "local-leads-test-secret",
      corsOrigins: [],
      environment: "development"
    });
    const existingIds = new Map<string, number>();
    suite.after(async () => {
      await app.close();
      await closeCoreDatabase();
      for (const name of names) {
        assert.match(name, /^codexsun_crm_leads_e2e_[a-f0-9]{12}$/);
        await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
      }
      await admin.end();
    });
    for (const name of names) {
      await migrateCoreTenantDatabase(name);
      await seedCoreTenantDatabase(name);
      const db = getCoreDatabase(name);
      await migrateTenantRuntimeModule(db as never);
      if (name === names.at(-1)) {
        await leadMigrationBatch.steps[0]!.up(db as never);
        await sql`INSERT INTO crm_leads(uuid,company_id,submission_uuid,campaign_uuid,campaign_label,name,email,phone,message,source,assigned_to,payload_hash,created_at,updated_at)
        VALUES('face0001',1,'face1001','face2001','Legacy campaign','Legacy prospect','','9876102345','Legacy details','marketing','lead2@example.test',${"a".repeat(64)},'2026-10-20 01:02:03','2026-10-20 01:02:03')`.execute(
          db
        );
      }
      await migrateCrmTenantDatabase(db as never);
      await seedTenantRoleModule(db as never);
      await seedLead(db as never);
      await seedStatusMaster(db as never);
      await seedPriorityMaster(db as never);
      await seedEnquiryModule(db as never);
      await seedCrmContactPermissions(db as never);
      await sql`INSERT INTO core_contact_types(name,status) VALUES('Customer','active') ON DUPLICATE KEY UPDATE status='active'`.execute(
        db
      );
      for (const [id, role] of [
        [1, "admin"],
        [2, "user"],
        [3, "user"]
      ] as const) {
        await sql`INSERT INTO app_users(id,uuid,name,email,password_hash,status) VALUES(${id},${`leadu00${id}`},${role},${`lead${id}@example.test`},'test-only','active')`.execute(
          db
        );
        await sql`INSERT INTO app_user_roles(uuid,user_id,role_id,status) SELECT ${`leadr00${id}`},${id},id,'active' FROM app_roles WHERE \`key\`=${role}`.execute(
          db
        );
      }
      await sql`INSERT INTO core_contacts(uuid,code,name,primary_phone,status) VALUES('exist001','LEAD-EXIST','Existing lead contact','9876543210','active')`.execute(
        db
      );
      existingIds.set(
        name,
        Number(
          (
            await sql<{ id: number }>`SELECT id FROM core_contacts WHERE code='LEAD-EXIST'`.execute(
              db
            )
          ).rows[0]!.id
        )
      );
      // Retry migration and seed against existing data.
      await migrateLead(db as never);
      await seedLead(db as never);
    }
    const scope = (name: string, email = "lead2@example.test", companyId = 1): LeadContext => {
      const db = getCoreDatabase(name);
      return {
        database: db as never,
        companyId,
        actorEmail: email,
        authorize: (permission) => authorizeTenantUser(db as never, email, permission),
        contact: async (id) => {
          const found = await getActiveContactForDatabase(name, id);
          return found ? { id, ...found } : null;
        },
        contacts: (search) => lookupActiveContactsForDatabase(name, search),
        resolveContact: async (transaction, lead) =>
          lead.contactId ??
          (
            await resolveOrCreateCustomerForDatabase(
              name,
              { name: lead.name, mobile: lead.phone },
              transaction as never
            )
          ).id
      };
    };
    leadModule.register(app, async (request) => {
      const name = String(request.headers["x-tenant-db"] ?? "");
      if (!names.includes(name)) throw AppError.forbidden("Unknown test tenant.");
      const claims = requireTenantAccess({
        authorization: request.headers.authorization,
        secret: env.JWT_SECRET,
        tenantDatabase: name,
        tenantId: request.headers["x-tenant-id"]
      });
      const context = scope(name, claims.email, Number(request.headers["x-company-id"] ?? 1));
      try {
        await context.authorize("crm.lead.view-all");
        context.canViewAll = true;
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== "FORBIDDEN") throw error;
      }
      return context;
    });
    const token = (name = names[0]!, actor = 2) =>
      signAuthToken({
        email: `lead${actor}@example.test`,
        userId: String(actor),
        userType: "tenant",
        tenantDbName: name,
        tenantId: name
      });
    const call = async (
      method: "GET" | "POST" | "PUT",
      path: string,
      body?: object,
      status = 200,
      actor = 2,
      name = names[0]!,
      extra: Record<string, string> = {}
    ) => {
      const response = await app.inject({
        method,
        url: "/crm/leads" + path,
        headers: {
          authorization: `Bearer ${token(name, actor)}`,
          "x-tenant-db": name,
          "x-tenant-id": name,
          ...extra
        },
        ...(body ? { payload: body } : {})
      });
      assert.equal(response.statusCode, status, response.body);
      return response.json().data;
    };
    const input = {
      name: "Fresh prospect",
      email: "",
      phone: "9123456780",
      message: "Enquiry details from the lead",
      campaignLabel: "Local campaign",
      contactId: null,
      status: "review"
    };
    let fresh: LeadRecord;
    let existing: LeadRecord;
    await suite.test("v1 upgrade preserves existing Marketing receipt and timestamps", async () => {
      const legacy = await call("GET", "/face0001", undefined, 200, 2, names.at(-1));
      assert.equal(legacy.submissionUuid, "face1001");
      assert.equal(legacy.campaignUuid, "face2001");
      assert.equal(legacy.message, "Legacy details");
      assert.equal(legacy.createdAt, "2026-10-20T01:02:03.000Z");
      assert.equal(legacy.contactId, null);
      assert.equal(legacy.enquiryId, null);
      assert.equal(legacy.revision, 1);
    });
    await suite.test("create, reload, search, status and pagination", async () => {
      fresh = await call("POST", "", input);
      assert.equal(fresh.revision, 1);
      assert.equal((await call("GET", "/" + fresh.uuid)).message, input.message);
      const page = await call("GET", "/page?search=Local%20campaign&pageSize=1");
      assert.equal(page.total, 1);
      assert.equal(page.items.length, 1);
      assert.equal((await call("GET", "/page?status=qualified")).total, 0);
      assert.equal(
        (await call("GET", "/contacts?search=9876543210"))[0].name,
        "Existing lead contact"
      );
      await call("GET", "/page?pageSize=101", undefined, 400);
    });
    await suite.test(
      "campaign lookup searches saved labels and respects company and owner scope",
      async () => {
        assert.deepEqual(await call("GET", "/campaigns?search=Local"), [
          { label: "Local campaign" }
        ]);
        assert.deepEqual(await call("GET", "/campaigns?search=%25"), []);
        assert.deepEqual(await call("GET", "/campaigns?search=Local", undefined, 200, 3), []);
        assert.deepEqual(
          await call("GET", "/campaigns?search=Local", undefined, 200, 2, names.at(-1)),
          []
        );
      }
    );
    await suite.test("date range and column filters compose within record scope", async () => {
      const query = new URLSearchParams({
        status: "active",
        searchName: "Fresh",
        searchPhone: "912345",
        searchMessage: "details",
        searchCampaign: "Local",
        searchStatus: "Needs review"
      });
      assert.equal((await call("GET", "/page?" + query)).total, 1);
      query.set("searchCampaign", "different campaign");
      assert.equal((await call("GET", "/page?" + query)).total, 0);
      assert.equal((await call("GET", "/page?searchName=%25")).total, 0);
      const fromAt = fresh.createdAt;
      const toAt = new Date(Date.parse(fromAt) + 1000).toISOString();
      assert.equal((await call("GET", "/page?" + new URLSearchParams({ fromAt, toAt }))).total, 1);
      assert.equal((await call("GET", "/page?" + new URLSearchParams({ toAt: fromAt }))).total, 0);
      await call(
        "GET",
        "/page?" + new URLSearchParams({ fromAt: toAt, toAt: fromAt }),
        undefined,
        400
      );
      await call("GET", "/page?fromAt=invalid", undefined, 400);
      assert.equal((await call("GET", "/page?" + query, undefined, 200, 3)).total, 0);
      const legacyRange = new URLSearchParams({
        fromAt: "2026-10-20T00:00:00Z",
        toAt: "2026-10-21T00:00:00Z"
      });
      assert.equal(
        (await call("GET", "/page?" + legacyRange, undefined, 200, 2, names.at(-1))).total,
        1
      );
    });
    await suite.test("lead contact and enquiry details may be blank", async () => {
      const saved = await call("POST", "", {
        ...input,
        name: "",
        message: "",
        campaignLabel: "Optional fields proof"
      });
      assert.equal(saved.name, "");
      assert.equal(saved.message, "");
      const reloaded = await call("GET", "/" + saved.uuid);
      assert.equal(reloaded.name, "");
      assert.equal(reloaded.message, "");
    });
    await suite.test("required fields, malformed status, and contact validation", async () => {
      for (const changes of [
        { phone: "bad" },
        { status: "converted" },
        { enquiryId: 99 },
        { companyId: 2 }
      ])
        await call("POST", "", { ...input, ...changes }, 400);
      await call("POST", "", { ...input, contactId: 999999 }, 400);
    });
    await suite.test(
      "five tenants isolate identical lead UUIDs and contact identities",
      async () => {
        for (const [index, name] of names.entries()) {
          const lead = await call(
            "POST",
            "",
            {
              ...input,
              name: `Tenant ${index + 1} isolated prospect`,
              campaignLabel: "Isolation proof"
            },
            200,
            2,
            name
          );
          await sql`UPDATE crm_leads SET uuid='feed0001' WHERE uuid=${lead.uuid}`.execute(
            getCoreDatabase(name)
          );
        }
        for (const [index, name] of names.entries()) {
          const lead = await call("GET", "/feed0001", undefined, 200, 2, name);
          assert.equal(lead.name, `Tenant ${index + 1} isolated prospect`);
          const foreign = `Tenant ${((index + 1) % names.length) + 1} isolated prospect`;
          assert.equal(
            (
              await call(
                "GET",
                "/page?search=" + encodeURIComponent(foreign),
                undefined,
                200,
                2,
                name
              )
            ).total,
            0
          );
        }
      }
    );
    await suite.test("update optimistic revision and reject stale overwrite", async () => {
      fresh = await call("PUT", "/" + fresh.uuid, {
        ...input,
        status: "qualified",
        revision: fresh.revision
      });
      assert.equal(fresh.revision, 2);
      await call("PUT", "/" + fresh.uuid, { ...input, revision: 1 }, 409);
      assert.equal((await call("GET", "/page?status=qualified")).total, 1);
    });
    await suite.test("owner, company, cross-tenant and forged token isolation", async () => {
      await call("GET", "/" + fresh.uuid, undefined, 404, 3);
      await call("PUT", "/" + fresh.uuid, { ...input, revision: 2 }, 404, 3);
      await call("POST", "/" + fresh.uuid + "/convert", {}, 404, 3);
      await call("GET", "/" + fresh.uuid + "/activity", undefined, 404, 3);
      for (const name of names.slice(1))
        await call("GET", "/" + fresh.uuid, undefined, 404, 2, name);
      await call("GET", "/" + fresh.uuid, undefined, 404, 2, names[0], { "x-company-id": "2" });
      const forged = await app.inject({
        method: "GET",
        url: "/crm/leads/page",
        headers: {
          authorization: `Bearer ${token()}`,
          "x-tenant-db": names[1],
          "x-tenant-id": names[1]
        }
      });
      assert.equal(forged.statusCode, 403);
      const missing = await app.inject({
        method: "GET",
        url: "/crm/leads/page",
        headers: { "x-tenant-db": names[0] }
      });
      assert.equal(missing.statusCode, 401);
    });
    await suite.test("existing contact converts once under concurrent retries", async () => {
      await sql
        .raw("ALTER TABLE crm_enquiries AUTO_INCREMENT=50")
        .execute(getCoreDatabase(names[0]!));
      existing = await call("POST", "", {
        ...input,
        name: "Existing lead contact",
        phone: "9876543210",
        contactId: existingIds.get(names[0]!)
      });
      const converted = await Promise.all([
        call("POST", "/" + existing.uuid + "/convert", {}),
        call("POST", "/" + existing.uuid + "/convert", {})
      ]);
      assert.ok(converted[0].enquiryId);
      assert.equal(converted[0].enquiryId, converted[1].enquiryId);
      assert.equal(converted[0].contactId, existingIds.get(names[0]!));
      assert.equal(converted[0].status, "converted");
      await call("PUT", "/" + existing.uuid, { ...input, revision: converted[0].revision }, 409);
      const audit = await call("GET", "/" + existing.uuid + "/activity");
      assert.equal(audit.filter((row: { action: string }) => row.action === "converted").length, 1);
      assert.equal(
        audit.find((row: { action: string }) => row.action === "converted").details,
        "Converted to enquiry #1."
      );
    });
    await suite.test(
      "fresh contact conversion persists capture, assignment and durable local event",
      async () => {
        const converted = await call("POST", "/" + fresh.uuid + "/convert", {});
        const db = getCoreDatabase(names[0]!);
        const enquiry = (
          await sql<{
            source_reference: string;
            contact_id: number;
            assigned_user_id: number;
            description: string;
          }>`SELECT source_reference,contact_id,assigned_user_id,description FROM crm_enquiries WHERE id=${converted.enquiryId}`.execute(
            db
          )
        ).rows[0]!;
        assert.equal(enquiry.source_reference, fresh.uuid);
        assert.equal(enquiry.contact_id, converted.contactId);
        assert.equal(enquiry.assigned_user_id, 2);
        assert.equal(enquiry.description, input.message);
        assert.equal(
          Number(
            (
              await sql<{
                n: number;
              }>`SELECT COUNT(*) n FROM crm_enquiry_sync_events WHERE enquiry_id=${converted.enquiryId}`.execute(
                db
              )
            ).rows[0]!.n
          ),
          2
        );
        assert.equal(
          Number(
            (
              await sql<{
                n: number;
              }>`SELECT COUNT(*) n FROM core_contacts WHERE primary_phone=${input.phone}`.execute(
                db
              )
            ).rows[0]!.n
          ),
          1
        );
      }
    );
    await suite.test(
      "failed conversion rolls back contact, enquiry, event and lead state",
      async () => {
        const lead = await call("POST", "", { ...input, phone: "9123456799" });
        const db = getCoreDatabase(names[0]!);
        await admin.query(
          `CREATE TRIGGER \`${names[0]}\`.reject_lead_conversion BEFORE UPDATE ON \`${names[0]}\`.crm_leads FOR EACH ROW BEGIN IF NEW.status='converted' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test conversion rollback'; END IF; END`
        );
        await call("POST", "/" + lead.uuid + "/convert", {}, 500);
        await admin.query(`DROP TRIGGER \`${names[0]}\`.reject_lead_conversion`);
        assert.equal((await call("GET", "/" + lead.uuid)).status, "review");
        assert.equal(
          Number(
            (
              await sql<{
                n: number;
              }>`SELECT COUNT(*) n FROM crm_enquiries WHERE source_reference=${lead.uuid}`.execute(
                db
              )
            ).rows[0]!.n
          ),
          0
        );
        assert.equal(
          Number(
            (
              await sql<{
                n: number;
              }>`SELECT COUNT(*) n FROM core_contacts WHERE primary_phone='9123456799'`.execute(db)
            ).rows[0]!.n
          ),
          0
        );
      }
    );
    await suite.test(
      "lost status blocks conversion and permissions are enforced live",
      async () => {
        const lost = await call("POST", "", { ...input, status: "lost" });
        await call("POST", "/" + lost.uuid + "/convert", {}, 409);
        const db = getCoreDatabase(names[0]!);
        await sql`UPDATE app_role_permissions rp JOIN app_roles r ON r.id=rp.role_id JOIN app_permissions p ON p.id=rp.permission_id SET rp.status='inactive' WHERE r.\`key\`='user' AND p.\`key\`='crm.lead.convert'`.execute(
          db
        );
        await call("POST", "/" + lost.uuid + "/convert", {}, 403);
        assert.equal((await call("GET", "/options")).canConvert, false);
      }
    );
    await suite.test("admin can review all leads; ordinary users remain scoped", async () => {
      assert.equal((await call("GET", "/" + fresh.uuid, undefined, 200, 1)).uuid, fresh.uuid);
      assert.equal((await call("GET", "/page", undefined, 200, 3)).total, 0);
      const lead = await call("POST", "", { ...input, phone: "9123456711" }, 200, 3);
      const converted = await call("POST", "/" + lead.uuid + "/convert", {}, 200, 1);
      const row = (
        await sql<{
          assigned_user_id: number;
          created_by: string;
        }>`SELECT assigned_user_id,created_by FROM crm_enquiries WHERE id=${converted.enquiryId}`.execute(
          getCoreDatabase(names[0]!)
        )
      ).rows[0]!;
      assert.equal(row.assigned_user_id, 3);
      assert.equal(row.created_by, "lead1@example.test");
    });
    await suite.test("Marketing intake remains duplicate-safe with one follow-up", async () => {
      const context = scope(names[0]!, "lead1@example.test");
      // Intake and Task create are granted to admin by the respective owning seeds.
      const { seedTaskPermissions } = await import("../../apps/crm/api/src/modules/task/index.js");
      await seedTaskPermissions(context.database as never);
      const intake = {
        submissionUuid: "abcde123",
        campaignUuid: "abcde124",
        campaignLabel: "Marketing",
        name: "Intake prospect",
        email: "",
        phone: "9123456777",
        message: "Intake detail",
        source: "marketing"
      };
      const a = await acceptMarketingLead(context, intake);
      const b = await acceptMarketingLead(context, intake);
      assert.equal(a?.uuid, b?.uuid);
      assert.ok(a?.taskId);
      await assert.rejects(
        acceptMarketingLead(context, { ...intake, message: "Changed" }),
        /reused/
      );
    });
  }
);
