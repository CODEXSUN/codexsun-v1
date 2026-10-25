import { createHmac, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createConnection } from "mysql2/promise";
import { createPool } from "mysql2";
import { Kysely, MysqlDialect, sql } from "kysely";
import { createApiApp } from "@codexsun/framework/api";
import { AppError } from "@codexsun/framework/errors";
import { env } from "../../apps/platform/api/src/env.js";
import {
  migrateMarketing,
  registerMarketing,
  marketingBrandScope,
  lookupCapture,
  lookupCampaign,
  type MarketingContext,
  type MarketingDependencies
} from "../../apps/marketing/api/src/index.js";
import {
  migrateCoreTenantDatabase,
  closeCoreDatabase
} from "../../apps/core/api/src/database/core-database.js";
import { migrateTenantRuntimeModule } from "../../apps/platform/api/src/modules/tenant/tenant.migration.js";
import {
  migrateCrmTenantDatabase,
  seedCrmTenantDatabase
} from "../../apps/crm/api/src/index.js";

function parseData<T>(res: { body: string }): T {
  const json = JSON.parse(res.body);
  return (json.data !== undefined ? json.data : json) as T;
}

test(
  "Phase 2 E16/E17: Social lead webhooks, content approvals, revisions, manual fallback, and multi-tenant isolation",
  { timeout: 180000 },
  async (suite) => {
    assert.equal(env.NODE_ENV, "development");
    assert.ok(
      ["127.0.0.1", "localhost", "::1"].includes(env.DB_HOST),
      "Marketing verification requires a local database host."
    );

    const config = {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD
    };
    const admin = await createConnection(config);
    const databases: MarketingContext["database"][] = [];
    const names: string[] = [];

    const app = await createApiApp({
      appName: "codexsun-marketing-social-e2e",
      cookieSecret: "codexsun-marketing-social-secret-1234",
      corsOrigins: [],
      environment: "development"
    });

    suite.after(async () => {
      await app.close();
      await closeCoreDatabase();
      for (const database of databases) await database.destroy();
      for (const name of names) {
        assert.match(name, /^codexsun_marketing_test_[a-f0-9]{16}$/);
        await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
      }
      await admin.end();
    });

    // 1. Setup two synthetic tenant databases with complete isolation
    for (let index = 0; index < 2; index++) {
      const name = "codexsun_marketing_test_" + randomBytes(8).toString("hex");
      await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4`);
      names.push(name);
      const database = new Kysely({
        dialect: new MysqlDialect({
          pool: createPool({ ...config, database: name, connectionLimit: 2 })
        })
      });
      databases.push(database);

      await migrateMarketing(database);
      await migrateCoreTenantDatabase(name);
      await migrateTenantRuntimeModule(database as never);
      await migrateCrmTenantDatabase(database as never);
      await seedCrmTenantDatabase(database as never);

      await sql`INSERT INTO app_users(uuid,name,email,password_hash,status) VALUES('a1b2c3d4','Marketing Owner','owner@example.test','test-only','active')`.execute(
        database
      );
    }

    let selectedTenant = 0;
    let actorEmail = "owner@example.test";
    let companyId = 1;
    let accessDenied = false;

    const context = async (): Promise<MarketingContext> => {
      const ctx: MarketingContext = {
        database: databases[selectedTenant]!,
        tenantId: selectedTenant === 0 ? "tenant-a-uuid" : "tenant-b-uuid",
        companyId,
        actorEmail,
        allBrands: false,
        allowedBrands: [],
        authorize: async () => {
          if (accessDenied) throw AppError.forbidden("Permission denied for this test operation.");
        }
      };
      ctx.allowedBrands = await marketingBrandScope(ctx);
      return ctx;
    };

    const deps: MarketingDependencies = { context };

    await registerMarketing(app, deps, {
      capture: lookupCapture,
      campaign: lookupCampaign,
      enqueue: async () => {}
    });

    // Seed Brand and Campaign in Tenant A
    selectedTenant = 0;
    companyId = 1;

    const brandARes = await app.inject({
      method: "POST",
      url: "/marketing/brands",
      payload: {
        name: "Acme Retail A",
        website: "https://acme-a.test",
        timezone: "Asia/Kolkata",
        status: "active"
      }
    });
    assert.equal(brandARes.statusCode, 200, "Brand A must be created");
    const brandA = parseData<{ uuid: string }>(brandARes);

    const campaignARes = await app.inject({
      method: "POST",
      url: "/marketing/campaigns",
      payload: {
        brandUuid: brandA.uuid,
        name: "Autumn Launch A",
        objective: "Promote new autumn collection",
        channel: "facebook",
        landingUrl: "https://acme-a.test/autumn",
        status: "active"
      }
    });
    assert.equal(campaignARes.statusCode, 200, "Campaign A must be created");
    const campaignA = parseData<{ uuid: string }>(campaignARes);

    // Seed Capture Form for inbound webhook resolution
    const captureARes = await app.inject({
      method: "POST",
      url: "/marketing/captures",
      payload: {
        brandUuid: brandA.uuid,
        campaignUuid: campaignA.uuid,
        name: "Meta Social Lead Form",
        allowedOrigin: "https://acme-a.test",
        noticeVersion: "1.0",
        consentNotice: "We use your details to contact you regarding our products.",
        status: "active"
      }
    });
    assert.equal(captureARes.statusCode, 200, "Capture A must be created");
    const captureA = parseData<{ uuid: string }>(captureARes);

    // Seed Brand in Tenant B for isolation testing
    selectedTenant = 1;
    companyId = 2;
    const brandBRes = await app.inject({
      method: "POST",
      url: "/marketing/brands",
      payload: {
        name: "Beta Logistics B",
        website: "https://beta-b.test",
        timezone: "Asia/Kolkata",
        status: "active"
      }
    });
    assert.equal(brandBRes.statusCode, 200, "Brand B must be created in Tenant B");
    const brandB = parseData<{ uuid: string }>(brandBRes);

    // Switch back to Tenant A for Gate E16 and E17
    selectedTenant = 0;
    companyId = 1;

    // =========================================================================
    // Gate E16: Social Lead Webhooks (Meta Lead Ads & Google Ads)
    // =========================================================================
    await suite.test("Gate E16: Meta Lead Ads webhook verification and signature security", async () => {
      // 1. Verification Handshake (GET /marketing/webhooks/meta-leads)
      const handshakeRes = await app.inject({
        method: "GET",
        url: "/marketing/webhooks/meta-leads?hub.mode=subscribe&hub.challenge=test_challenge_code_123"
      });
      assert.equal(handshakeRes.statusCode, 200);
      const handshakeData = parseData<{ challenge: string; status: string }>(handshakeRes);
      assert.equal(handshakeData.challenge, "test_challenge_code_123");

      // 2. Reject forged or tampered signature
      process.env.META_APP_SECRET = "test-meta-app-secret-key-32bytes";
      const leadPayload = {
        leadgen_id: "meta_lead_998877",
        form_id: captureA.uuid,
        page_id: "100200300",
        name: "Priya Sharma",
        email: "priya.sharma@example.test",
        phone: "+919876543210",
        message: "Interested in autumn catalog"
      };
      const rawPayload = JSON.stringify(leadPayload);

      const forgedRes = await app.inject({
        method: "POST",
        url: "/marketing/webhooks/meta-leads",
        headers: {
          "x-hub-signature-256": "sha256=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
        },
        payload: leadPayload
      });
      assert.equal(forgedRes.statusCode, 403, "Forged signature must be rejected with 403 Forbidden");

      // 3. Valid signature passes and ingests lead
      const validHmac = createHmac("sha256", process.env.META_APP_SECRET)
        .update(rawPayload)
        .digest("hex");

      const validRes = await app.inject({
        method: "POST",
        url: "/marketing/webhooks/meta-leads",
        headers: {
          "x-hub-signature-256": `sha256=${validHmac}`
        },
        payload: leadPayload
      });
      assert.equal(validRes.statusCode, 200);
      const validBody = parseData<{ received: boolean; submissionUuid: string; leadUuid: string }>(validRes);
      assert.equal(validBody.received, true);
      assert.ok(validBody.submissionUuid);
      assert.ok(validBody.leadUuid);

      // Verify Marketing Lead was created in marketing_leads
      const leadRow = (
        await sql<{
          uuid: string;
          name: string;
          email: string;
          phone: string;
          source: string;
          source_reference: string;
        }>`SELECT uuid, name, email, phone, source, source_reference FROM marketing_leads WHERE uuid=${validBody.leadUuid}`.execute(
          databases[0]!
        )
      ).rows[0];
      assert.ok(leadRow, "Marketing Lead must exist in marketing_leads table");
      assert.equal(leadRow.name, "Priya Sharma");
      assert.equal(leadRow.email, "priya.sharma@example.test");
      assert.equal(leadRow.source, "submission");
      assert.equal(leadRow.source_reference, "meta_meta_lead_998877");

      // 4. Test lead marker handling
      const testLeadPayload = {
        is_test: true,
        leadgen_id: "test_lead_001",
        form_id: captureA.uuid,
        name: "Test Lead User",
        email: "test.lead@example.test",
        phone: "+919999900000"
      };
      const testRawPayload = JSON.stringify(testLeadPayload);
      const testHmac = createHmac("sha256", process.env.META_APP_SECRET)
        .update(testRawPayload)
        .digest("hex");

      const testLeadRes = await app.inject({
        method: "POST",
        url: "/marketing/webhooks/meta-leads",
        headers: {
          "x-hub-signature-256": `sha256=${testHmac}`
        },
        payload: testLeadPayload
      });
      assert.equal(testLeadRes.statusCode, 200);
      const testLeadBody = parseData<{ isTest: boolean }>(testLeadRes);
      assert.equal(testLeadBody.isTest, true);

      // 5. Replay idempotency: re-sending identical payload returns existing receipt without duplicate lead
      const replayRes = await app.inject({
        method: "POST",
        url: "/marketing/webhooks/meta-leads",
        headers: {
          "x-hub-signature-256": `sha256=${validHmac}`
        },
        payload: leadPayload
      });
      assert.equal(replayRes.statusCode, 200);
      const replayBody = parseData<{ submissionUuid: string; leadUuid: string }>(replayRes);
      assert.equal(replayBody.submissionUuid, validBody.submissionUuid);
      assert.equal(replayBody.leadUuid, validBody.leadUuid);

      // Verify lead count did not duplicate
      const duplicateCount = (
        await sql<{ total: number }>`SELECT COUNT(*) AS total FROM marketing_leads WHERE source_reference='meta_meta_lead_998877'`.execute(
          databases[0]!
        )
      ).rows[0]?.total;
      assert.equal(duplicateCount, 1, "Replay must be idempotent and not create duplicate leads");
    });

    await suite.test("Gate E16: Google Ads lead webhook verification and test separation", async () => {
      process.env.GOOGLE_ADS_WEBHOOK_KEY = "test-google-ads-secret-key-456";

      // 1. Unauthorized key rejection
      const unauthRes = await app.inject({
        method: "POST",
        url: "/marketing/webhooks/google-leads?google_key=wrong-key",
        payload: {
          lead_id: "g_lead_123",
          user_column_data: [{ column_id: "FULL_NAME", string_value: "Rohan Kumar" }]
        }
      });
      assert.equal(unauthRes.statusCode, 401, "Invalid Google Ads key must return 401");

      // 2. Authorized Google Ads lead ingestion
      const authRes = await app.inject({
        method: "POST",
        url: "/marketing/webhooks/google-leads?google_key=test-google-ads-secret-key-456",
        payload: {
          lead_id: "g_lead_554433",
          form_id: captureA.uuid,
          user_column_data: [
            { column_id: "FULL_NAME", string_value: "Rohan Kumar" },
            { column_id: "EMAIL", string_value: "rohan.kumar@example.test" },
            { column_id: "PHONE_NUMBER", string_value: "+919123456789" }
          ]
        }
      });
      assert.equal(authRes.statusCode, 200);
      const authBody = parseData<{ received: boolean; leadUuid: string }>(authRes);
      assert.equal(authBody.received, true);
      assert.ok(authBody.leadUuid);

      const googleLead = (
        await sql<{
          name: string;
          email: string;
          source: string;
          source_reference: string;
        }>`SELECT name, email, source, source_reference FROM marketing_leads WHERE uuid=${authBody.leadUuid}`.execute(
          databases[0]!
        )
      ).rows[0];
      assert.ok(googleLead);
      assert.equal(googleLead.name, "Rohan Kumar");
      assert.equal(googleLead.source, "submission");
      assert.equal(googleLead.source_reference, "google_g_lead_554433");

      // 3. Test mode detection
      const googleTestRes = await app.inject({
        method: "POST",
        url: "/marketing/webhooks/google-leads?google_key=test-google-ads-secret-key-456",
        payload: {
          is_test: true,
          lead_id: "g_test_lead_99",
          user_column_data: [
            { column_id: "FULL_NAME", string_value: "Test Google User" },
            { column_id: "EMAIL", string_value: "test.google@example.test" }
          ]
        }
      });
      assert.equal(googleTestRes.statusCode, 200);
      assert.equal(parseData<{ isTest: boolean }>(googleTestRes).isTest, true);
    });

    await suite.test("Gate E16: Proof of zero CRM / Frappe writes", async () => {
      for (const database of databases) {
        const crmLeads = (
          await sql<{ total: number }>`SELECT COUNT(*) AS total FROM crm_leads`.execute(database)
        ).rows[0]?.total;
        const crmTasks = (
          await sql<{ total: number }>`SELECT COUNT(*) AS total FROM crm_tasks`.execute(database)
        ).rows[0]?.total;
        const crmEnquiries = (
          await sql<{ total: number }>`SELECT COUNT(*) AS total FROM crm_enquiries`.execute(database)
        ).rows[0]?.total;
        const crmFrappeSync = (
          await sql<{ total: number }>`SELECT COUNT(*) AS total FROM crm_frappe_sync_queue`.execute(database)
        ).rows[0]?.total;

        assert.equal(crmLeads, 0, "Zero rows in crm_leads");
        assert.equal(crmTasks, 0, "Zero rows in crm_tasks");
        assert.equal(crmEnquiries, 0, "Zero rows in crm_enquiries");
        assert.equal(crmFrappeSync, 0, "Zero rows in crm_frappe_sync_queue");
      }
    });

    // =========================================================================
    // Gate E17: Content Approval Lifecycle, Revisions & Publishing
    // =========================================================================
    await suite.test("Gate E17: Content drafts, revisions, approval lifecycle, and stale revision 409 conflict", async () => {
      // 1. Create content draft
      const draftRes = await app.inject({
        method: "POST",
        url: "/marketing/contents",
        payload: {
          brandUuid: brandA.uuid,
          campaignUuid: campaignA.uuid,
          title: "Diwali Special Offer Announcement",
          body: "Celebrate Diwali with 25% off on our entire collection! Use code DIWALI25.",
          channel: "facebook",
          publishMode: "api"
        }
      });
      assert.equal(draftRes.statusCode, 200);
      const draft = parseData<{ uuid: string; status: string; revision: number; publishMode: string }>(draftRes);
      assert.equal(draft.status, "draft");
      assert.equal(draft.revision, 1);
      assert.equal(draft.publishMode, "api");

      // 2. Submit for approval
      const submitRes = await app.inject({
        method: "POST",
        url: `/marketing/contents/${draft.uuid}/submit-approval`,
        payload: { expectedRevision: 1 }
      });
      assert.equal(submitRes.statusCode, 200);
      const pending = parseData<{ status: string; revision: number }>(submitRes);
      assert.equal(pending.status, "pending_approval");
      assert.equal(pending.revision, 2);

      // 3. Rejection workflow: rejection requires a reason
      const rejectEmptyRes = await app.inject({
        method: "POST",
        url: `/marketing/contents/${draft.uuid}/reject`,
        payload: { reason: "   ", expectedRevision: 2 }
      });
      assert.equal(rejectEmptyRes.statusCode, 400, "Empty rejection reason must return 400 Validation Error");

      const rejectValidRes = await app.inject({
        method: "POST",
        url: `/marketing/contents/${draft.uuid}/reject`,
        payload: { reason: "Tone needs to be more festive and specify end date.", expectedRevision: 2 }
      });
      assert.equal(rejectValidRes.statusCode, 200);
      const rejected = parseData<{ status: string; rejectionReason: string; revision: number }>(rejectValidRes);
      assert.equal(rejected.status, "rejected");
      assert.equal(rejected.rejectionReason, "Tone needs to be more festive and specify end date.");
      assert.equal(rejected.revision, 3);

      // 4. Stale revision conflict (409 Conflict): attempting to update with outdated revision
      const staleRes = await app.inject({
        method: "PUT",
        url: `/marketing/contents/${draft.uuid}`,
        payload: {
          brandUuid: brandA.uuid,
          campaignUuid: campaignA.uuid,
          title: "Diwali Special Festive Offer",
          body: "Updated body",
          channel: "facebook",
          expectedRevision: 1 // Stale revision! Current revision is 3
        }
      });
      assert.equal(staleRes.statusCode, 409, "Outdated revision must return 409 Conflict");

      // 5. Update with correct revision succeeds
      const updateRes = await app.inject({
        method: "PUT",
        url: `/marketing/contents/${draft.uuid}`,
        payload: {
          brandUuid: brandA.uuid,
          campaignUuid: campaignA.uuid,
          title: "Diwali Grand Festive Offer - Limited Period",
          body: "Celebrate Diwali with 25% off on our entire collection! Offer ends Nov 5. Use code DIWALI25.",
          channel: "facebook",
          expectedRevision: 3
        }
      });
      assert.equal(updateRes.statusCode, 200);
      const updated = parseData<{ title: string; revision: number }>(updateRes);
      assert.equal(updated.title, "Diwali Grand Festive Offer - Limited Period");
      assert.equal(updated.revision, 4);

      // 6. Re-submit and approve
      const resubmitRes = await app.inject({
        method: "POST",
        url: `/marketing/contents/${draft.uuid}/submit-approval`,
        payload: { expectedRevision: 4 }
      });
      assert.equal(resubmitRes.statusCode, 200);
      const resubmitted = parseData<{ status: string; revision: number }>(resubmitRes);
      assert.equal(resubmitted.status, "pending_approval");
      assert.equal(resubmitted.revision, 5);

      const approveRes = await app.inject({
        method: "POST",
        url: `/marketing/contents/${draft.uuid}/approve`,
        payload: { expectedRevision: 5 }
      });
      assert.equal(approveRes.statusCode, 200);
      const approved = parseData<{ status: string; approvedBy: string; approvedAt: string; revision: number }>(approveRes);
      assert.equal(approved.status, "approved");
      assert.equal(approved.approvedBy, "owner@example.test");
      assert.ok(approved.approvedAt);
      assert.equal(approved.revision, 6);

      // 7. Schedule content
      const scheduleTime = new Date(Date.now() + 86400000).toISOString();
      const scheduleRes = await app.inject({
        method: "POST",
        url: `/marketing/contents/${draft.uuid}/schedule`,
        payload: { scheduledAt: scheduleTime, expectedRevision: 6 }
      });
      assert.equal(scheduleRes.statusCode, 200);
      const scheduled = parseData<{ status: string; revision: number }>(scheduleRes);
      assert.equal(scheduled.status, "scheduled");
      assert.equal(scheduled.revision, 7);

      // 8. Publish Facebook API content
      const publishRes = await app.inject({
        method: "POST",
        url: `/marketing/contents/${draft.uuid}/publish`,
        payload: { expectedRevision: 7 }
      });
      assert.equal(publishRes.statusCode, 200);
      const published = parseData<{ status: string; publishedAt: string; externalPostId: string }>(publishRes);
      assert.equal(published.status, "published");
      assert.ok(published.publishedAt);
      assert.match(published.externalPostId, /^fb_post_[a-f0-9]{16}$/);

      // Verify activity audit trail
      const activityRes = await app.inject({
        method: "GET",
        url: `/marketing/contents/${draft.uuid}/activity`
      });
      assert.equal(activityRes.statusCode, 200);
      const activities = parseData<{ action: string }[]>(activityRes);
      assert.ok(activities.length >= 6);
      const actionNames = activities.map((a) => a.action);
      assert.ok(actionNames.includes("created"));
      assert.ok(actionNames.includes("submitted_for_approval"));
      assert.ok(actionNames.includes("rejected"));
      assert.ok(actionNames.includes("approved"));
      assert.ok(actionNames.includes("scheduled"));
      assert.ok(actionNames.includes("published"));
    });

    await suite.test("Gate E17: Manual publishing task fallback and completion", async () => {
      // 1. Create content with manual publishing mode (e.g. for LinkedIn company page)
      const manualContentRes = await app.inject({
        method: "POST",
        url: "/marketing/contents",
        payload: {
          brandUuid: brandA.uuid,
          title: "Quarterly Growth Insights",
          body: "Excited to share our Q3 milestone: 150% growth across key metrics.",
          channel: "linkedin",
          publishMode: "manual"
        }
      });
      assert.equal(manualContentRes.statusCode, 200);
      const manualContent = parseData<{ uuid: string }>(manualContentRes);

      // Submit and approve
      await app.inject({
        method: "POST",
        url: `/marketing/contents/${manualContent.uuid}/submit-approval`,
        payload: { expectedRevision: 1 }
      });
      const approvedManualRes = await app.inject({
        method: "POST",
        url: `/marketing/contents/${manualContent.uuid}/approve`,
        payload: { expectedRevision: 2 }
      });
      const approvedManual = parseData<{ status: string }>(approvedManualRes);
      assert.equal(approvedManual.status, "approved");

      // 2. Trigger publish -> creates manual task
      const taskTriggerRes = await app.inject({
        method: "POST",
        url: `/marketing/contents/${manualContent.uuid}/publish`,
        payload: { expectedRevision: 3 }
      });
      assert.equal(taskTriggerRes.statusCode, 200);
      const taskContent = parseData<{ status: string; publishMode: string; manualTaskNotes: string }>(taskTriggerRes);
      assert.equal(taskContent.status, "approved");
      assert.equal(taskContent.publishMode, "manual");
      assert.ok(taskContent.manualTaskNotes);

      // 3. Complete manual publish by recording native post ID and operator evidence
      const completeRes = await app.inject({
        method: "POST",
        url: `/marketing/contents/${manualContent.uuid}/complete-manual`,
        payload: {
          notes: "Published natively from company LinkedIn page.",
          expectedRevision: 4
        }
      });
      assert.equal(completeRes.statusCode, 200);
      const completed = parseData<{ status: string; manualCompletedBy: string; manualCompletedAt: string }>(completeRes);
      assert.equal(completed.status, "published");
      assert.equal(completed.manualCompletedBy, "owner@example.test");
      assert.ok(completed.manualCompletedAt);
    });

    // =========================================================================
    // Gate E11 / Multi-Tenant Isolation
    // =========================================================================
    await suite.test("Two-tenant isolation: Tenant B cannot access or modify Tenant A's content", async () => {
      // Create content in Tenant A
      selectedTenant = 0;
      companyId = 1;
      const contentARes = await app.inject({
        method: "POST",
        url: "/marketing/contents",
        payload: {
          brandUuid: brandA.uuid,
          title: "Tenant A Private Content",
          body: "Confidential roadmap update",
          channel: "x",
          publishMode: "manual"
        }
      });
      assert.equal(contentARes.statusCode, 200);
      const contentA = parseData<{ uuid: string }>(contentARes);

      // Switch context to Tenant B
      selectedTenant = 1;
      companyId = 2;

      // 1. Tenant B cannot get Tenant A's content
      const getBRes = await app.inject({
        method: "GET",
        url: `/marketing/contents/${contentA.uuid}`
      });
      assert.equal(getBRes.statusCode, 404, "Tenant B must receive 404 Not Found for Tenant A's content");

      // 2. Tenant B cannot approve Tenant A's content
      const approveBRes = await app.inject({
        method: "POST",
        url: `/marketing/contents/${contentA.uuid}/approve`,
        payload: { expectedRevision: 1 }
      });
      assert.equal(approveBRes.statusCode, 404);

      // 3. Tenant B list contents does not leak Tenant A's content
      const listBRes = await app.inject({
        method: "GET",
        url: "/marketing/contents"
      });
      assert.equal(listBRes.statusCode, 200);
      const listB = parseData<{ uuid: string }[]>(listBRes);
      const foundA = listB.find((item) => item.uuid === contentA.uuid);
      assert.equal(foundA, undefined, "Tenant B list must not include Tenant A's content");
    });
  }
);
