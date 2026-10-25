import { checkMailSuppression } from "../../apps/mail/api/src/index.js";
import { checkContactRestrictions } from "../../apps/crm/api/src/index.js";
import { contactIdsForEmailPolicy } from "../../apps/core/api/src/index.js";
import { lookupBrand } from "../../apps/marketing/api/src/index.js";
import { verifyConsentEligibility } from "./marketing-consent.e2e.js";
import {
  ProviderAccountClaims,
  migrateProviderAccountClaims
} from "../../apps/platform/api/src/modules/app-registry/app-registry.account-claims.js";
import { registerPublicCapture } from "../../apps/marketing/api/src/index.js";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
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
  type MarketingContext
} from "../../apps/marketing/api/src/index.js";
import {
  lookupCapture,
  lookupCampaign,
  processSubmissionHandoff
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
import { registerConnectionAuthorization } from "../../apps/marketing/api/src/index.js";
import { verifyMarketingLifecycle } from "./marketing-lifecycle.e2e.js";

test(
  "Marketing routes persist in separate tenant databases and reject company/brand context swaps",
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
      appName: "codexsun-marketing-isolation-test",
      cookieSecret: "codexsun-marketing-isolation-secret",
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
      await migrateMarketing(database);
      await migrateCoreTenantDatabase(name);
      await migrateTenantRuntimeModule(database as never);
      await migrateCrmTenantDatabase(database as never);
      await seedCrmTenantDatabase(database as never);
      await sql`INSERT INTO app_users(uuid,name,email,password_hash,status) VALUES('a1b2c3d4','Test owner','owner@example.test','test-only','active')`.execute(
        database
      );
    }
    await migrateProviderAccountClaims(databases[0] as never);
    const claims = new ProviderAccountClaims(databases[0] as never);
    await claims.claim("google", "collision-fixture", "a1a1a1a1", "1234abcd");
    await claims.claim("google", "collision-fixture", "a1a1a1a1", "1234abcd");
    await assert.rejects(
      claims.claim("google", "collision-fixture", "b2b2b2b2", "1234abcd"),
      /cannot be attached/
    );
    await claims.release("google", "collision-fixture", "b2b2b2b2", "1234abcd");
    await assert.rejects(
      claims.claim("google", "collision-fixture", "b2b2b2b2", "1234abcd"),
      /cannot be attached/
    );
    await claims.release("google", "collision-fixture", "a1a1a1a1", "1234abcd");
    let selected = 0;
    let actor = "owner@example.test";
    let denied = false;
    let companyId = 1;
    const context = async () => {
      const context: MarketingContext = {
        database: databases[selected]!,
        tenantId: selected === 0 ? "a1a1a1a1" : "b2b2b2b2",
        companyId,
        actorEmail: actor,
        allBrands: false,
        allowedBrands: [],
        authorize: async () => {
          if (denied) throw AppError.forbidden("Denied test grant.");
        }
      };
      context.allowedBrands = await marketingBrandScope(context);
      return context;
    };
    await registerMarketing(
      app,
      { context },
      {
        capture: lookupCapture,
        campaign: lookupCampaign,
        enqueue: async () => {
          throw new Error("Simulated queue outage");
        }
      },
      {
        brand: lookupBrand,
        crm: async (c, recipient) =>
          checkContactRestrictions(
            c,
            recipient,
            await contactIdsForEmailPolicy(names[selected]!, recipient)
          ),
        mail: checkMailSuppression
      }
    );
    await registerPublicCapture(app, context, {
      secret: "codexsun-public-capture-fixture-secret",
      resolve: async (binding) => {
        const resolved = await context();
        if (binding.tenantId !== resolved.tenantId)
          throw AppError.forbidden("Fixture tenant is suspended or unavailable.");
        return resolved;
      },
      verifyOrigin: async (_context, origin) => {
        if (origin !== "https://example.test")
          throw AppError.forbidden("Unverified fixture domain.");
      },
      submissions: {
        capture: lookupCapture,
        campaign: lookupCampaign,
        enqueue: async () => {
          throw new Error("Queue outage");
        }
      }
    });
    let sessionIdentity = "session-a";
    await registerConnectionAuthorization(app, context, async () => ({
      secret: "codexsun-test-only-secret",
      sessionIdentity,
      google: {
        authorizationUrl: (state, challenge) =>
          "https://accounts.google.com/o/oauth2/v2/auth?" +
          new URLSearchParams({ state, code_challenge: challenge }),
        exchange: async () => ({
          accessToken: "fixture-secret-token",
          refreshToken: "fixture-refresh",
          expiresAt: Date.now() + 3600000,
          scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
          accounts: [{ id: "channel-a", label: "Test channel" }]
        })
      },
      claim: async (provider, account, connection) =>
        claims.claim(provider, account, (await context()).tenantId, connection),
      release: async (provider, account, connection) =>
        claims.release(provider, account, (await context()).tenantId, connection)
    }));
    const create = async (url: string, payload: unknown) => {
      const response = await app.inject({ method: "POST", url, payload });
      assert.equal(response.statusCode, 200, response.body);
      return response.json().data;
    };
    const brand = await create("/marketing/brands", {
      name: "Tenant A",
      timezone: "Asia/Kolkata",
      website: "",
      status: "active"
    });
    const campaign = await create("/marketing/campaigns", {
      brandUuid: brand.uuid,
      name: "Spring",
      objective: "Enquiries",
      channel: "website",
      landingUrl: "",
      status: "active"
    });
    assert.equal(campaign.companyId, 1);
    const connection = await create("/marketing/connections", {
      brandUuid: brand.uuid,
      name: "Google discovery",
      provider: "google",
      externalAccountId: "",
      status: "active"
    });
    const started = await create("/marketing/connections/" + connection.uuid + "/oauth/begin", {});
    const state = new URL(started.url).searchParams.get("state")!;
    sessionIdentity = "other-session";
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/marketing/connections/" + connection.uuid + "/oauth/complete",
          payload: { state, code: "fixture-code" }
        })
      ).statusCode,
      403
    );
    sessionIdentity = "session-a";
    const authorized = await create(
      "/marketing/connections/" + connection.uuid + "/oauth/complete",
      { state, code: "fixture-code" }
    );
    assert.equal(authorized.accounts[0].id, "channel-a");
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/marketing/connections/" + connection.uuid + "/oauth/complete",
          payload: { state, code: "fixture-code" }
        })
      ).statusCode,
      403
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/marketing/connections/" + connection.uuid + "/oauth/select",
          payload: { state, accountId: "unverified-channel" }
        })
      ).statusCode,
      403
    );
    await create("/marketing/connections/" + connection.uuid + "/oauth/select", {
      state,
      accountId: "channel-a"
    });
    const health = await app.inject({
      method: "GET",
      url: "/marketing/connections/" + connection.uuid + "/health"
    });
    assert.equal(health.json().data.connected, true);
    assert.ok(!health.body.includes("fixture-secret-token"));
    const encrypted = (
      await sql<{
        grant_secret: string;
      }>`SELECT grant_secret FROM marketing_connection_grants`.execute(databases[0]!)
    ).rows[0]!.grant_secret;
    assert.ok(!encrypted.includes("fixture-secret-token"));
    await create("/marketing/connections/" + connection.uuid + "/disconnect", {});
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/marketing/connections/" + connection.uuid + "/health"
        })
      ).json().data.connected,
      false
    );
    const form = await create("/marketing/captures", {
      brandUuid: brand.uuid,
      campaignUuid: campaign.uuid,
      name: "Website form",
      allowedOrigin: "https://example.test",
      consentNotice: "Use these details to respond to this enquiry.",
      noticeVersion: "v1",
      status: "active"
    });
    const published = await create("/marketing/captures/" + form.uuid + "/publish-binding", {});
    const publicPath = published.path;
    const definition = await app.inject({ method: "GET", url: publicPath });
    assert.equal(definition.statusCode, 200, definition.body);
    assert.equal(definition.json().data.noticeVersion, "v1");
    assert.ok(!definition.body.includes("a1a1a1a1"));
    const publicPayload = {
      sourceKey: "public-source-key-0001",
      name: "Public prospect",
      email: "public@example.test",
      phone: "",
      message: "Please respond to my enquiry.",
      privacyConsent: true
    };
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: publicPath,
          headers: { origin: "https://other.test" },
          payload: publicPayload
        })
      ).statusCode,
      403
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: publicPath,
          headers: { origin: "https://example.test" },
          payload: { ...publicPayload, tenantId: "b2b2b2b2" }
        })
      ).statusCode,
      400
    );
    const publicReceipt = await app.inject({
      method: "POST",
      url: publicPath,
      headers: { origin: "https://example.test" },
      payload: publicPayload
    });
    assert.equal(publicReceipt.statusCode, 200, publicReceipt.body);
    const repeatReceipt = await app.inject({
      method: "POST",
      url: publicPath,
      headers: { origin: "https://example.test" },
      payload: publicPayload
    });
    assert.equal(publicReceipt.json().data.reference, repeatReceipt.json().data.reference);
    const badToken = publicPath.slice(0, -4) + "AAAA";
    assert.equal((await app.inject({ method: "GET", url: badToken })).statusCode, 403);
    selected = 1;
    assert.equal((await app.inject({ method: "GET", url: publicPath })).statusCode, 403);
    selected = 0;
    const brandUpdate = {
      name: brand.name,
      timezone: brand.timezone,
      website: brand.website,
      status: "inactive",
      expectedRevision: brand.revision
    };
    let changed = await app.inject({
      method: "PUT",
      url: "/marketing/brands/" + brand.uuid,
      payload: brandUpdate
    });
    assert.equal(changed.statusCode, 200, changed.body);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: publicPath,
          headers: { origin: "https://example.test" },
          payload: publicPayload
        })
      ).statusCode,
      409
    );
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: "/marketing/brands/" + brand.uuid,
          payload: brandUpdate
        })
      ).statusCode,
      409
    );
    changed = await app.inject({
      method: "PUT",
      url: "/marketing/brands/" + brand.uuid,
      payload: { ...brandUpdate, status: "active", expectedRevision: changed.json().data.revision }
    });
    assert.equal(changed.statusCode, 200, changed.body);
    assert.equal(
      (await app.inject({ method: "GET", url: "/marketing/brands/count?status=active" })).json()
        .data.total,
      1
    );
    const payload = {
      captureUuid: form.uuid,
      sourceKey: "source-key-0001",
      name: "Prospect",
      email: "prospect@example.test",
      phone: "",
      message: "Please contact me.",
      privacyConsent: true
    };
    const captured = await create("/marketing/submissions", payload);
    assert.equal(captured.status, "pending");
    assert.equal((await create("/marketing/submissions", payload)).uuid, captured.uuid);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/marketing/submissions",
          payload: { ...payload, name: "Conflicting replay" }
        })
      ).statusCode,
      409
    );
    const scope = await context();
    const first = await processSubmissionHandoff(scope, captured.uuid);
    const second = await processSubmissionHandoff(scope, captured.uuid);
    assert.equal(first.leadUuid, second.leadUuid);
    assert.equal(first.status, "delivered");
    assert.equal(second.status, "delivered");

    // PROVE submission handoff produces a Marketing Lead in marketing_leads
    const marketingLeadsCount = Number(
      (
        await sql<{ count: number }>`SELECT COUNT(*) AS count FROM marketing_leads WHERE submission_uuid = ${captured.uuid}`.execute(
          scope.database
        )
      ).rows[0]!.count
    );
    assert.equal(marketingLeadsCount, 1, "Submission handoff must produce exactly 1 Marketing Lead in marketing_leads.");

    // PROVE ZERO CRM WRITES: assert that crm_leads, crm_tasks, crm_enquiries, crm_frappe_sync_queue have 0 count
    assert.equal(
      Number(
        (
          await sql<{ count: number }>`SELECT COUNT(*) AS count FROM crm_leads`.execute(
            scope.database
          )
        ).rows[0]!.count
      ),
      0,
      "PROVE ZERO CRM WRITES: crm_leads count must be 0"
    );
    assert.equal(
      Number(
        (
          await sql<{ count: number }>`SELECT COUNT(*) AS count FROM crm_tasks`.execute(
            scope.database
          )
        ).rows[0]!.count
      ),
      0,
      "PROVE ZERO CRM WRITES: crm_tasks count must be 0"
    );
    assert.equal(
      Number(
        (
          await sql<{ count: number }>`SELECT COUNT(*) AS count FROM crm_enquiries`.execute(
            scope.database
          )
        ).rows[0]!.count
      ),
      0,
      "PROVE ZERO CRM WRITES: crm_enquiries count must be 0"
    );
    assert.equal(
      Number(
        (
          await sql<{ count: number }>`SELECT COUNT(*) AS count FROM crm_frappe_sync_queue`.execute(
            scope.database
          )
        ).rows[0]!.count
      ),
      0,
      "PROVE ZERO CRM WRITES: crm_frappe_sync_queue count must be 0"
    );

    // Verify retry via API is idempotent
    const retryRes = await app.inject({
      method: "POST",
      url: `/marketing/submissions/${captured.uuid}/retry`
    });
    assert.equal(retryRes.statusCode, 200);
    const retryHandoff = await processSubmissionHandoff(scope, captured.uuid);
    assert.equal(retryHandoff.leadUuid, first.leadUuid);
    assert.equal(
      Number(
        (
          await sql<{ count: number }>`SELECT COUNT(*) AS count FROM marketing_leads WHERE submission_uuid = ${captured.uuid}`.execute(
            scope.database
          )
        ).rows[0]!.count
      ),
      1,
      "Retrying handoff must not duplicate leads in marketing_leads"
    );
    selected = 1;
    assert.equal(
      (await app.inject({ method: "GET", url: "/marketing/brands" })).json().data.length,
      0
    );
    assert.equal(
      (await app.inject({ method: "GET", url: "/marketing/brands/" + brand.uuid })).statusCode,
      404
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/marketing/campaigns",
          payload: { brandUuid: brand.uuid, name: "Forged", objective: "x", channel: "website" }
        })
      ).statusCode,
      404
    );
    selected = 0;
    companyId = 2;
    assert.equal(
      (await app.inject({ method: "GET", url: "/marketing/brands/" + brand.uuid })).statusCode,
      404
    );
    companyId = 1;
    actor = "other@example.test";
    assert.equal(
      (await app.inject({ method: "GET", url: "/marketing/brands/" + brand.uuid })).statusCode,
      404
    );
    actor = "owner@example.test";
    denied = true;
    assert.equal((await app.inject({ method: "GET", url: "/marketing/brands" })).statusCode, 403);
    denied = false;
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/marketing/brands",
          payload: { name: "x", timezone: "bad/timezone", tenantId: names[1] }
        })
      ).statusCode,
      400
    );
    const events = await app.inject({
      method: "GET",
      url: "/marketing/brands/" + brand.uuid + "/activity"
    });
    assert.equal(events.statusCode, 200, events.body);
    assert.equal(events.json().data.at(-1).action, "created");
    assert.equal(
      Number(
        (
          await sql<{ count: number }>`SELECT COUNT(*) AS count FROM marketing_campaigns`.execute(
            databases[1]!
          )
        ).rows[0]!.count
      ),
      0
    );
    await suite.test(
      "Promotional eligibility, immutable evidence, safety blocks, tenant scope, and withdrawal races",
      async () => {
        await verifyConsentEligibility(
          app,
          context,
          names,
          (tenant, company = 1, email = "owner@example.test") => {
            selected = tenant;
            companyId = company;
            actor = email;
          }
        );
      }
    );
    await suite.test(
      "Marketing lifecycle: Lead, Qualification, Sales Conversion, Outcome, Follow-up, Restrictions, and Multi-tenant Isolation",
      async () => {
        await verifyMarketingLifecycle(
          app,
          context,
          names,
          (tenant, company = 1, email = "owner@example.test") => {
            selected = tenant;
            companyId = company;
            actor = email;
          }
        );
      }
    );
    if (process.env.CODEXSUN_MARKETING_BROWSER === "1") {
      const { verifyMarketingBrowser } = await import("./marketing-browser.mjs");
      await verifyMarketingBrowser(app);
    }
  }
);
