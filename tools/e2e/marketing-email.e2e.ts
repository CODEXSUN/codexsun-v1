import { randomBytes } from "node:crypto";
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
  lookupBrand,
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
import {
  migrateMailSuppressions,
  checkMailSuppression
} from "../../apps/mail/api/src/index.js";

function parseData<T>(res: { body: string }): T {
  const json = JSON.parse(res.body);
  return (json.data !== undefined ? json.data : json) as T;
}

test(
  "Phase 3 E18/E19: Email campaigns through Mail contracts, sender verification, variable preview, audience snapshot, suppression races, one-click unsubscribe, and multi-tenant isolation",
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
      appName: "codexsun-marketing-email-e2e",
      cookieSecret: "codexsun-marketing-email-secret-1234",
      corsOrigins: [],
      environment: "development"
    });

    let currentTenantIndex = 0;
    let allowedBrandsOverride: string[] | null = null;
    let deniedGrant = false;

    const dependencies: MarketingDependencies = {
      context: async () => {
        if (deniedGrant) throw AppError.forbidden("Denied test grant.");
        const db = databases[currentTenantIndex];
        const tenantId = `tenant-${currentTenantIndex + 1}`;
        const baseContext: MarketingContext = {
          database: db!,
          tenantId,
          companyId: 1,
          actorEmail: `auditor-${tenantId}@codexsun.local`,
          allBrands: allowedBrandsOverride === null,
          allowedBrands: allowedBrandsOverride ?? (await marketingBrandScope({
            database: db!,
            tenantId,
            companyId: 1,
            actorEmail: `auditor-${tenantId}@codexsun.local`,
            allBrands: true,
            allowedBrands: [],
            authorize: async () => {}
          })),
          authorize: async () => {}
        };
        return baseContext;
      }
    };

    // Initialize 2 synthetic tenant databases
    for (let i = 0; i < 2; i++) {
      const name = `codexsun_marketing_test_${randomBytes(8).toString("hex")}`;
      await admin.query(`CREATE DATABASE \`${name}\``);
      names.push(name);

      const pool = createPool({ ...config, database: name });
      const db = new Kysely<Record<string, Record<string, unknown>>>({
        dialect: new MysqlDialect({ pool: async () => pool })
      });
      databases.push(db);

      // Migrate schemas
      await migrateTenantRuntimeModule(db);
      await migrateCoreTenantDatabase(name);
      await migrateCrmTenantDatabase(db);
      await seedCrmTenantDatabase(db);
      await migrateMarketing(db);
      await migrateMailSuppressions(db);
    }

    registerMarketing(
      app,
      dependencies,
      {
        capture: async (ctx, uuid) => lookupCapture(ctx, uuid),
        campaign: async (ctx, uuid) => lookupCampaign(ctx, uuid)
      },
      {
        brand: lookupBrand,
        mail: checkMailSuppression
      }
    );

    await app.ready();

    let brandAUuid = "";
    let brandBUuid = "";
    let senderAUuid = "";
    let campaignAUuid = "";

    try {
      // Setup Brand A on Tenant 1
      currentTenantIndex = 0;
      const brandARes = await app.inject({
        method: "POST",
        url: "/marketing/brands",
        payload: {
          name: "Acme Brand",
          timezone: "UTC",
          website: "https://acme.test",
          status: "active"
        }
      });
      assert.equal(brandARes.statusCode, 200);
      brandAUuid = parseData<{ uuid: string }>(brandARes).uuid;

      // Setup Brand B on Tenant 2
      currentTenantIndex = 1;
      const brandBRes = await app.inject({
        method: "POST",
        url: "/marketing/brands",
        payload: {
          name: "Beta Brand",
          timezone: "UTC",
          website: "https://beta.test",
          status: "active"
        }
      });
      assert.equal(brandBRes.statusCode, 200);
      brandBUuid = parseData<{ uuid: string }>(brandBRes).uuid;

      currentTenantIndex = 0;

      // -------------------------------------------------------------
      // Test 1: Sender Registration & Validation (Gate E18, Task 3.1, 3.2)
      // -------------------------------------------------------------
      await suite.test("Verified sender registration and domain validation (Gate E18)", async () => {
        // Invalid sender: domain format invalid
        const invalidDomainRes = await app.inject({
          method: "POST",
          url: "/marketing/email-senders",
          payload: {
            brandUuid: brandAUuid,
            name: "Acme Newsletter",
            email: "news@localhost",
            domain: "localhost"
          }
        });
        assert.equal(invalidDomainRes.statusCode, 400);

        // Invalid sender: email does not match domain
        const mismatchRes = await app.inject({
          method: "POST",
          url: "/marketing/email-senders",
          payload: {
            brandUuid: brandAUuid,
            name: "Acme Newsletter",
            email: "news@gmail.com",
            domain: "acme.test"
          }
        });
        assert.equal(mismatchRes.statusCode, 400);

        // Valid sender: verified domain & matching email
        const validSenderRes = await app.inject({
          method: "POST",
          url: "/marketing/email-senders",
          payload: {
            brandUuid: brandAUuid,
            name: "Acme Newsletter",
            email: "news@acme.test",
            domain: "acme.test"
          }
        });
        assert.equal(validSenderRes.statusCode, 200);
        const sender = parseData<{ uuid: string; spfStatus: string; dkimStatus: string; isVerified: boolean }>(validSenderRes);
        assert.ok(sender.uuid);
        assert.equal(sender.spfStatus, "verified");
        assert.equal(sender.dkimStatus, "verified");
        assert.equal(sender.isVerified, true);
        senderAUuid = sender.uuid;

        // List senders
        const listRes = await app.inject({
          method: "GET",
          url: `/marketing/email-senders?brandUuid=${brandAUuid}`
        });
        assert.equal(listRes.statusCode, 200);
        const senders = parseData<Array<{ uuid: string }>>(listRes);
        assert.equal(senders.length, 1);
        assert.equal(senders[0]?.uuid, senderAUuid);
      });

      // -------------------------------------------------------------
      // Test 2: Campaign Creation, Template Variables & Preview (Gate E18, Task 3.3, 3.4)
      // -------------------------------------------------------------
      await suite.test("Email campaign creation and template variable interpolation (Gate E18)", async () => {
        // Unknown variable rejection
        const badVarRes = await app.inject({
          method: "POST",
          url: "/marketing/email-campaigns",
          payload: {
            brandUuid: brandAUuid,
            senderUuid: senderAUuid,
            name: "Malicious Template",
            subject: "Welcome {{evil_var}}",
            bodyHtml: "<p>{{evil_var}}</p>",
            bodyText: "{{evil_var}}"
          }
        });
        assert.equal(badVarRes.statusCode, 400);
        assert.match(badVarRes.body, /Unknown template variables/);

        // Valid campaign creation
        const createRes = await app.inject({
          method: "POST",
          url: "/marketing/email-campaigns",
          payload: {
            brandUuid: brandAUuid,
            senderUuid: senderAUuid,
            name: "October VIP Promotion",
            subject: "Special Announcement for {{contact.name}} from {{brand.name}}",
            preheader: "Exclusive savings inside",
            bodyHtml: "<h1>Hello {{contact.name}}</h1><p>Visit us at <a href='{{unsubscribe_url}}'>Unsubscribe</a></p>",
            bodyText: "Hello {{contact.name}},\n\nUnsubscribe here: {{unsubscribe_url}}"
          }
        });
        assert.equal(createRes.statusCode, 200);
        const camp = parseData<{ uuid: string; status: string; revision: number }>(createRes);
        assert.ok(camp.uuid);
        assert.equal(camp.status, "draft");
        assert.equal(camp.revision, 1);
        campaignAUuid = camp.uuid;

        // Preview Endpoint
        const previewRes = await app.inject({
          method: "POST",
          url: `/marketing/email-campaigns/${campaignAUuid}/preview`,
          payload: {
            sampleValues: {
              "contact.name": "Alice Auditor",
              "brand.name": "Acme Brand"
            }
          }
        });
        assert.equal(previewRes.statusCode, 200);
        const preview = parseData<{ subject: string; html: string; text: string; unresolvedVariables: string[] }>(previewRes);
        assert.equal(preview.subject, "Special Announcement for Alice Auditor from Acme Brand");
        assert.match(preview.html, /Hello Alice Auditor/);
        assert.match(preview.html, /href='https:\/\/marketing\.codexsun\.local\/public\/marketing\/unsubscribe\?token=sample-preview-token'/);
        assert.equal(preview.unresolvedVariables.length, 0);
      });

      // -------------------------------------------------------------
      // Test 3: Block Implicit Shared Environment Fallback (Task 3.12, Gate E18)
      // -------------------------------------------------------------
      await suite.test("Block implicit shared environment fallback for campaign dispatch (Task 3.12)", async () => {
        // Attempt test send with an invalid or unverified sender id
        const badSenderRes = await app.inject({
          method: "POST",
          url: "/marketing/email-campaigns",
          payload: {
            brandUuid: brandAUuid,
            senderUuid: "00000000",
            name: "Unverified Fallback Campaign",
            subject: "Testing Fallback",
            bodyHtml: "<p>Hello</p>",
            bodyText: "Hello"
          }
        });
        assert.equal(badSenderRes.statusCode, 404); // Sender not found -> fail closed!

        // Test send with valid campaign and verified sender
        const testSendRes = await app.inject({
          method: "POST",
          url: `/marketing/email-campaigns/${campaignAUuid}/test-send`,
          payload: { recipient: "qa-verifier@acme.test" }
        });
        assert.equal(testSendRes.statusCode, 200);
        const testSend = parseData<{ delivered: boolean; recipient: string; subject: string }>(testSendRes);
        assert.equal(testSend.delivered, true);
        assert.equal(testSend.recipient, "qa-verifier@acme.test");
        assert.match(testSend.subject, /\[TEST\]/);
      });

      // -------------------------------------------------------------
      // Test 4: Audience Snapshot with Enqueue Suppression (Task 3.5, 3.8)
      // -------------------------------------------------------------
      let eligibleRecipientUuid = "";
      let unsubscribeToken = "";

      await suite.test("Audience snapshotting with enqueue-time consent and suppression filters (Task 3.5, 3.8)", async () => {
        // Create 3 Marketing Leads:
        // Lead 1: eligible
        const lead1Res = await app.inject({
          method: "POST",
          url: "/marketing/leads",
          payload: {
            brandUuid: brandAUuid,
            name: "Eligible Customer",
            email: "eligible@acme.test",
            phone: "+15551110001",
            source: "website",
            status: "new"
          }
        });
        assert.equal(lead1Res.statusCode, 200);

        // Lead 2: has Contact Restriction in Marketing
        const lead2Res = await app.inject({
          method: "POST",
          url: "/marketing/leads",
          payload: {
            brandUuid: brandAUuid,
            name: "Restricted Contact",
            email: "restricted@acme.test",
            phone: "+15551110002",
            source: "website",
            status: "new"
          }
        });
        assert.equal(lead2Res.statusCode, 200);

        // Record Marketing contact restriction for Lead 2
        const restrictRes = await app.inject({
          method: "POST",
          url: "/marketing/contact-restrictions",
          payload: {
            recipient: "restricted@acme.test",
            channel: "email",
            blocked: true,
            reason: "User requested do-not-email"
          }
        });
        assert.equal(restrictRes.statusCode, 200);

        // Lead 3: has Mail Suppression (Hard bounce recorded in mail app)
        const lead3Res = await app.inject({
          method: "POST",
          url: "/marketing/leads",
          payload: {
            brandUuid: brandAUuid,
            name: "Bounced Contact",
            email: "bounced@acme.test",
            phone: "+15551110003",
            source: "website",
            status: "new"
          }
        });
        assert.equal(lead3Res.statusCode, 200);

        // Insert Mail suppression directly into mail_suppressions table
        await sql`INSERT INTO mail_suppressions (
          uuid, company_id, recipient, reason, evidence, created_by, created_at, updated_at
        ) VALUES (
          'm-bounce', 1, 'bounced@acme.test', 'hard_bounce', '550 User unknown',
          'postmaster@acme.test', UTC_TIMESTAMP(), UTC_TIMESTAMP()
        )`.execute(databases[0]!);

        // Snapshot audience
        const snapshotRes = await app.inject({
          method: "POST",
          url: `/marketing/email-campaigns/${campaignAUuid}/snapshot-audience`,
          payload: {}
        });
        assert.equal(snapshotRes.statusCode, 200);
        const snapshot = parseData<{ total: number; enqueued: number; suppressed: number }>(snapshotRes);
        assert.equal(snapshot.total, 3);
        assert.equal(snapshot.enqueued, 1);
        assert.equal(snapshot.suppressed, 2);

        // Verify recipient records
        const recipientsRes = await app.inject({
          method: "GET",
          url: `/marketing/email-campaigns/${campaignAUuid}/recipients?limit=10&offset=0`
        });
        assert.equal(recipientsRes.statusCode, 200);
        const recipients = parseData<Array<{
          uuid: string;
          recipientEmail: string;
          status: string;
          suppressionReason: string | null;
          unsubscribeToken: string;
        }>>(recipientsRes);

        const eligible = recipients.find((r) => r.recipientEmail === "eligible@acme.test");
        const restricted = recipients.find((r) => r.recipientEmail === "restricted@acme.test");
        const bounced = recipients.find((r) => r.recipientEmail === "bounced@acme.test");

        assert.ok(eligible);
        assert.equal(eligible.status, "enqueued");
        assert.equal(eligible.suppressionReason, null);
        eligibleRecipientUuid = eligible.uuid;
        unsubscribeToken = eligible.unsubscribeToken;

        assert.ok(restricted);
        assert.equal(restricted.status, "suppressed");
        assert.match(restricted.suppressionReason ?? "", /marketing:/);

        assert.ok(bounced);
        assert.equal(bounced.status, "suppressed");
        assert.match(bounced.suppressionReason ?? "", /mail:hard_bounce/);
      });

      // -------------------------------------------------------------
      // Test 5: Approval Workflow & Revision Conflict (Gate E17/E18)
      // -------------------------------------------------------------
      await suite.test("Approval workflow transitions, revision guards, and rejection reasons (Gate E17/E18)", async () => {
        // Submit for approval
        const submitRes = await app.inject({
          method: "POST",
          url: `/marketing/email-campaigns/${campaignAUuid}/submit-approval`
        });
        assert.equal(submitRes.statusCode, 200);
        assert.equal(parseData<{ status: string }>(submitRes).status, "pending_approval");

        // Reject with empty reason -> 400
        const badRejectRes = await app.inject({
          method: "POST",
          url: `/marketing/email-campaigns/${campaignAUuid}/reject`,
          payload: { reason: "   " }
        });
        assert.equal(badRejectRes.statusCode, 400);

        // Reject with valid reason
        const rejectRes = await app.inject({
          method: "POST",
          url: `/marketing/email-campaigns/${campaignAUuid}/reject`,
          payload: { reason: "Please adjust preheader length." }
        });
        assert.equal(rejectRes.statusCode, 200);
        assert.equal(parseData<{ status: string; rejectionReason: string }>(rejectRes).status, "rejected");

        // Stale revision update attempt -> 409 Conflict
        const staleRes = await app.inject({
          method: "PUT",
          url: `/marketing/email-campaigns/${campaignAUuid}`,
          payload: {
            brandUuid: brandAUuid,
            senderUuid: senderAUuid,
            name: "Updated Campaign",
            subject: "Updated Subject",
            bodyHtml: "<p>Updated</p>",
            bodyText: "Updated",
            expectedRevision: 1 // Actual revision is now 3
          }
        });
        assert.equal(staleRes.statusCode, 409);

        // Update with matching revision
        const currentCamp = parseData<{ revision: number }>(await app.inject({
          method: "GET",
          url: `/marketing/email-campaigns/${campaignAUuid}`
        }));
        const updateRes = await app.inject({
          method: "PUT",
          url: `/marketing/email-campaigns/${campaignAUuid}`,
          payload: {
            brandUuid: brandAUuid,
            senderUuid: senderAUuid,
            name: "October VIP Promotion Final",
            subject: "Special Announcement for {{contact.name}} from {{brand.name}}",
            preheader: "Exclusive VIP discount inside",
            bodyHtml: "<h1>Hello {{contact.name}}</h1><p>Visit us at <a href='{{unsubscribe_url}}'>Unsubscribe</a></p>",
            bodyText: "Hello {{contact.name}},\n\nUnsubscribe here: {{unsubscribe_url}}",
            expectedRevision: currentCamp.revision
          }
        });
        assert.equal(updateRes.statusCode, 200);

        // Submit for approval again
        await app.inject({
          method: "POST",
          url: `/marketing/email-campaigns/${campaignAUuid}/submit-approval`
        });

        // Approve campaign
        const approveRes = await app.inject({
          method: "POST",
          url: `/marketing/email-campaigns/${campaignAUuid}/approve`
        });
        assert.equal(approveRes.statusCode, 200);
        assert.equal(parseData<{ status: string }>(approveRes).status, "approved");
      });

      // -------------------------------------------------------------
      // Test 6: Gate E19 Suppression Race Check at Execution Time
      // -------------------------------------------------------------
      await suite.test("Gate E19: Live suppression race check during execution batch", async () => {
        // Enqueue a 4th lead that was eligible at snapshot time
        const raceLeadRes = await app.inject({
          method: "POST",
          url: "/marketing/leads",
          payload: {
            brandUuid: brandAUuid,
            name: "Race Condition Lead",
            email: "race@acme.test",
            phone: "+15551110004",
            source: "website",
            status: "new"
          }
        });
        assert.equal(raceLeadRes.statusCode, 200);

        // Directly insert enqueued recipient into marketing_email_recipients to simulate prior snapshot
        const raceToken = randomBytes(24).toString("hex");
        await sql`INSERT INTO marketing_email_recipients (
          uuid, company_id, email_campaign_uuid, recipient_email, lead_uuid, status,
          suppression_reason, unsubscribe_token
        ) VALUES (
          'r-race01', 1, ${campaignAUuid}, 'race@acme.test',
          ${parseData<{ uuid: string }>(raceLeadRes).uuid}, 'enqueued', NULL, ${raceToken}
        )`.execute(databases[0]!);

        await sql`UPDATE marketing_email_campaigns SET total_recipients = total_recipients + 1
          WHERE uuid = ${campaignAUuid}`.execute(databases[0]!);

        // SIMULATE RACE: Between enqueue and batch dispatch, race@acme.test unsubscribes or complains in Mail!
        await sql`INSERT INTO mail_suppressions (
          uuid, company_id, recipient, reason, evidence, created_by, created_at, updated_at
        ) VALUES (
          'm-race01', 1, 'race@acme.test', 'complaint', 'Spam report received mid-flight',
          'feedback@mail.provider', UTC_TIMESTAMP(), UTC_TIMESTAMP()
        )`.execute(databases[0]!);

        // DISPATCH BATCH
        const dispatchRes = await app.inject({
          method: "POST",
          url: `/marketing/email-campaigns/${campaignAUuid}/dispatch`,
          payload: { batchSize: 50 }
        });
        assert.equal(dispatchRes.statusCode, 200);
        const result = parseData<{
          processed: number;
          sent: number;
          suppressed: number;
          remaining: number;
        }>(dispatchRes);

        // 2 pending items were processed:
        // eligible@acme.test -> sent
        // race@acme.test -> suppressed (caught by Gate E19 live re-check!)
        assert.equal(result.processed, 2);
        assert.equal(result.sent, 1);
        assert.equal(result.suppressed, 1);
        assert.equal(result.remaining, 0);

        // Inspect recipient status of race@acme.test
        const raceRecipient = parseData<Array<{ status: string; suppressionReason: string }>>(
          await app.inject({
            method: "GET",
            url: `/marketing/email-campaigns/${campaignAUuid}/recipients?status=suppressed`
          })
        ).find((r) => r.suppressionReason?.includes("mail:complaint"));

        assert.ok(raceRecipient, "Race condition recipient must be suppressed at execution time.");
        assert.equal(raceRecipient.status, "suppressed");

        // Inspect eligible@acme.test
        const sentRecipient = parseData<Array<{ uuid: string; status: string; sentAt: string }>>(
          await app.inject({
            method: "GET",
            url: `/marketing/email-campaigns/${campaignAUuid}/recipients?status=sent`
          })
        )[0];
        assert.ok(sentRecipient);
        assert.equal(sentRecipient.status, "sent");
        assert.ok(sentRecipient.sentAt);

        // Verify Campaign performance counts
        const finalCamp = parseData<{
          status: string;
          sentCount: number;
          suppressedCount: number;
          totalRecipients: number;
        }>(await app.inject({
          method: "GET",
          url: `/marketing/email-campaigns/${campaignAUuid}`
        }));
        assert.equal(finalCamp.status, "completed");
        assert.equal(finalCamp.sentCount, 1);
        assert.equal(finalCamp.suppressedCount, 3); // 2 at enqueue + 1 at execution!
      });

      // -------------------------------------------------------------
      // Test 7: Public One-Click Unsubscribe (Gate E18, Task 3.6, 3.7)
      // -------------------------------------------------------------
      await suite.test("Public one-click unsubscribe and dual suppression recording (Task 3.6, 3.7)", async () => {
        // GET unsubscribe confirmation page
        const getUnsubRes = await app.inject({
          method: "GET",
          url: `/public/marketing/unsubscribe?token=${unsubscribeToken}`
        });
        assert.equal(getUnsubRes.statusCode, 200);
        assert.match(getUnsubRes.body, /Unsubscribe Confirmed/);
        assert.match(getUnsubRes.body, /eligible@acme\.test/);

        // POST one-click unsubscribe header response
        const postUnsubRes = await app.inject({
          method: "POST",
          url: "/public/marketing/unsubscribe",
          payload: { token: unsubscribeToken }
        });
        assert.equal(postUnsubRes.statusCode, 200);
        assert.equal(postUnsubRes.headers["list-unsubscribe-post"], "List-Unsubscribe=One-Click");

        // Verify recipient status updated to unsubscribed
        const unsubRecipients = parseData<Array<{ recipientEmail: string; status: string }>>(
          await app.inject({
            method: "GET",
            url: `/marketing/email-campaigns/${campaignAUuid}/recipients?status=unsubscribed`
          })
        );
        assert.equal(unsubRecipients.length, 1);
        assert.equal(unsubRecipients[0]?.recipientEmail, "eligible@acme.test");
        assert.equal(unsubRecipients[0]?.status, "unsubscribed");

        const campRes = parseData<{ unsubscribedCount: number }>(
          await app.inject({
            method: "GET",
            url: `/marketing/email-campaigns/${campaignAUuid}`
          })
        );
        assert.equal(campRes.unsubscribedCount, 1);

        // Verify Contact Restriction was automatically recorded in Marketing
        const checkRestrictRes = await app.inject({
          method: "POST",
          url: "/marketing/contact-restrictions/check",
          payload: { recipient: "eligible@acme.test", channel: "email" }
        });
        assert.equal(checkRestrictRes.statusCode, 200);
        assert.equal(parseData<{ allowed: boolean }>(checkRestrictRes).allowed, false);

        // Verify Mail suppression was automatically recorded in Mail
        const mailRows = await sql<{ reason: string }>`SELECT reason FROM mail_suppressions
          WHERE company_id = 1 AND recipient = 'eligible@acme.test'`.execute(databases[0]!);
        assert.ok(mailRows.rows.length > 0);
        assert.equal(mailRows.rows[0]?.reason, "policy");
      });

      // -------------------------------------------------------------
      // Test 8: Bounce & Complaint Feedback Events (Task 3.7)
      // -------------------------------------------------------------
      await suite.test("Bounce and complaint feedback loop processing (Task 3.7)", async () => {
        const bounceRes = await app.inject({
          method: "POST",
          url: "/public/marketing/email/events",
          payload: {
            eventType: "bounce",
            tokenOrEmail: "post-bounce@acme.test",
            bounceType: "hard_bounce"
          }
        });
        assert.equal(bounceRes.statusCode, 200);

        const complaintRes = await app.inject({
          method: "POST",
          url: "/public/marketing/email/events",
          payload: {
            eventType: "complaint",
            tokenOrEmail: "post-complaint@acme.test"
          }
        });
        assert.equal(complaintRes.statusCode, 200);

        // Verify both are present in mail_suppressions
        const bounceCheck = (await sql<{ count: number }>`SELECT COUNT(*) as count FROM mail_suppressions
          WHERE recipient = 'post-bounce@acme.test' AND reason = 'hard_bounce'`.execute(databases[0]!)).rows[0];
        assert.equal(Number(bounceCheck?.count ?? 0), 1);

        const complaintCheck = (await sql<{ count: number }>`SELECT COUNT(*) as count FROM mail_suppressions
          WHERE recipient = 'post-complaint@acme.test' AND reason = 'complaint'`.execute(databases[0]!)).rows[0];
        assert.equal(Number(complaintCheck?.count ?? 0), 1);
      });

      // -------------------------------------------------------------
      // Test 9: Two-Tenant Database Isolation (Gate E11)
      // -------------------------------------------------------------
      await suite.test("Tenant B cannot view, dispatch, or access Tenant A's email campaigns (Gate E11)", async () => {
        currentTenantIndex = 1; // Switch to Tenant B

        // Tenant B lists email campaigns -> 0 items
        const tenantBCampListRes = await app.inject({
          method: "GET",
          url: "/marketing/email-campaigns"
        });
        assert.equal(tenantBCampListRes.statusCode, 200);
        const tenantBCamps = parseData<Array<{ uuid: string }>>(tenantBCampListRes);
        assert.equal(tenantBCamps.length, 0);

        // Tenant B attempts to read Tenant A's campaign -> 404
        const tenantBFetchA = await app.inject({
          method: "GET",
          url: `/marketing/email-campaigns/${campaignAUuid}`
        });
        assert.equal(tenantBFetchA.statusCode, 404);

        // Tenant B attempts to dispatch Tenant A's campaign -> 404
        const tenantBDispatchA = await app.inject({
          method: "POST",
          url: `/marketing/email-campaigns/${campaignAUuid}/dispatch`,
          payload: {}
        });
        assert.equal(tenantBDispatchA.statusCode, 404);

        // Database isolation proof
        const countA = (await sql<{ count: number }>`SELECT COUNT(*) as count FROM marketing_email_campaigns`.execute(databases[0]!)).rows[0];
        const countB = (await sql<{ count: number }>`SELECT COUNT(*) as count FROM marketing_email_campaigns`.execute(databases[1]!)).rows[0];

        assert.ok(Number(countA?.count ?? 0) >= 1);
        assert.equal(Number(countB?.count ?? 0), 0);
      });

      // -------------------------------------------------------------
      // Test 10: Proof of Zero CRM / Frappe Writes
      // -------------------------------------------------------------
      await suite.test("Zero new CRM or Frappe calls/writes throughout entire email campaign lifecycle (Gate E09)", async () => {
        for (let i = 0; i < 2; i++) {
          const db = databases[i]!;
          const leads = (await sql<{ count: number }>`SELECT COUNT(*) as count FROM crm_leads`.execute(db)).rows[0];
          const tasks = (await sql<{ count: number }>`SELECT COUNT(*) as count FROM crm_tasks`.execute(db)).rows[0];
          const enquiries = (await sql<{ count: number }>`SELECT COUNT(*) as count FROM crm_enquiries`.execute(db)).rows[0];
          const frappe = (await sql<{ count: number }>`SELECT COUNT(*) as count FROM crm_frappe_sync_queue`.execute(db)).rows[0];

          assert.equal(Number(leads?.count ?? 0), 0, `Tenant ${i + 1} crm_leads must be 0`);
          assert.equal(Number(tasks?.count ?? 0), 0, `Tenant ${i + 1} crm_tasks must be 0`);
          assert.equal(Number(enquiries?.count ?? 0), 0, `Tenant ${i + 1} crm_enquiries must be 0`);
          assert.equal(Number(frappe?.count ?? 0), 0, `Tenant ${i + 1} crm_frappe_sync_queue must be 0`);
        }
      });
    } finally {
      await app.close();
      for (let i = 0; i < names.length; i++) {
        await closeCoreDatabase(names[i]!);
        await admin.query(`DROP DATABASE IF EXISTS \`${names[i]}\``);
      }
      await admin.end();
    }
  }
);
