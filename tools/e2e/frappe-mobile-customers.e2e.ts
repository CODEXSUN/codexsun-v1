import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { createConnection } from "mysql2/promise";
import { sql, type Kysely } from "kysely";
import Fastify from "fastify";
import { migrateTenantRuntimeModule } from "../../apps/platform/api/src/modules/tenant/tenant.migration.js";
import { migrateCrmTenantDatabase } from "../../apps/crm/api/src/crm.migration.js";
import { env } from "../../apps/platform/api/src/env.js";
import {
  migrateCoreTenantDatabase,
  seedCoreTenantDatabase,
  closeCoreDatabase,
  getCoreDatabase
} from "../../apps/core/api/src/database/core-database.js";
import { ContactService } from "../../apps/core/api/src/modules/master/contact/contact.service.js";
import { runWithCoreDatabase } from "../../apps/core/api/src/database/core-database.js";
import { resolveExternalContactForDatabase } from "../../apps/core/api/src/modules/master/contact/index.js";
import {
  migrateFrappeTenantDatabase,
  type FrappeDatabase
} from "../../apps/frappe/api/src/modules/connection/index.js";
import {
  FrappeContactImportService,
  findEnquiryCustomerIdentity
} from "../../apps/frappe/api/src/modules/contact-import/contact-import.service.js";
import { frappeContactImportModule } from "../../apps/frappe/api/src/modules/contact-import/index.js";
import { FrappeConnectionRepository } from "../../apps/frappe/api/src/modules/connection/connection.repository.js";

test(
  "Mobile Contact Customer imports preserve customer identities and mobile associations",
  { timeout: 120_000 },
  async (suite) => {
    assert.equal(env.NODE_ENV, "development");
    const name = `codexsun_mobile_customer_e2e_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const admin = await createConnection({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD
    });
    const originalFetch = globalThis.fetch;
    const app = Fastify({ logger: false });
    suite.after(async () => {
      globalThis.fetch = originalFetch;
      await app.close();
      await closeCoreDatabase();
      assert.match(name, /^codexsun_mobile_customer_e2e_[a-f0-9]{16}$/);
      try {
        await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
      } finally {
        await admin.end();
      }
    });
    await migrateCoreTenantDatabase(name);
    await seedCoreTenantDatabase(name);
    const db = getCoreDatabase(name) as unknown as Kysely<FrappeDatabase>;
    await migrateTenantRuntimeModule(db as never);
    await migrateCrmTenantDatabase(db as never);
    await migrateFrappeTenantDatabase(db);
    const pairs = [
      {
        name: "PAIR-A1",
        mobile_contact: "9876543210",
        customer: "C9138",
        customer_name: "Old display name"
      },
      {
        name: "PAIR-B1",
        mobile_contact: "9876543210",
        customer: "C2887",
        customer_name: "Customer B"
      },
      {
        name: "PAIR-A2",
        mobile_contact: "9123456780",
        customer: "C9138",
        customer_name: "Customer A"
      },
      {
        name: "PAIR-A3",
        mobile_contact: "9234567890",
        customer: "C9138",
        customer_name: "Customer A"
      }
    ];
    const settings = {
      baseUrl: "https://frappe.test",
      apiKey: "test-key",
      apiSecret: "test-secret",
      enabled: true
    };
    await new FrappeConnectionRepository(db).saveConnection(
      { ...settings, connectionName: "Test" },
      "test-encryption-secret"
    );
    await new FrappeConnectionRepository(db).recordVerification("verified");
    let disabled = false;
    let malformedMobile = false;
    const paths: string[] = [];
    globalThis.fetch = async (input, init) => {
      assert.equal(init?.method, "GET", "customer source must never write to Frappe");
      const url = new URL(String(input));
      const path = decodeURIComponent(url.pathname);
      paths.push(path);
      if (path === "/api/resource/Mobile Contact Customer") return Response.json({ data: pairs });
      if (path.startsWith("/api/resource/Mobile Contact Customer/"))
        return Response.json({ data: pairs.find((p) => p.name === path.split("/").at(-1)) });
      if (path.startsWith("/api/resource/Mobile Contact/")) {
        const mobile = path.split("/").at(-1);
        return Response.json({
          data: { name: mobile, mobile_number: malformedMobile ? "0000000000" : mobile }
        });
      }
      if (path.startsWith("/api/resource/Customer/")) {
        const customer = path.split("/").at(-1);
        return Response.json({
          data: {
            name: customer,
            customer_name: customer === "C9138" ? "Customer A" : "Customer B",
            disabled: disabled ? 1 : 0
          }
        });
      }
      throw new Error(`Unexpected remote path ${path}`);
    };
    const resolveContact = (input: {
      externalKey: string;
      externalCode: string;
      name: string;
      mobile: string;
      contactType?: "Customer" | "Supplier";
      existingContactId?: number;
    }) => resolveExternalContactForDatabase(name, input);
    const lookups = {
      findContactByCode: async (code: string) => {
        const row = await sql<{ id: number; code: string }>`
          SELECT id,code FROM core_contacts WHERE code=${code} AND deleted_at IS NULL LIMIT 1
        `.execute(db);
        return row.rows[0] ?? null;
      },
      findContactById: async (id: number) => {
        const row = await sql<{ id: number; code: string }>`
          SELECT id,code FROM core_contacts WHERE id=${id} AND deleted_at IS NULL LIMIT 1
        `.execute(db);
        return row.rows[0] ?? null;
      }
    };
    let deny = false;
    await frappeContactImportModule.register(
      app,
      async () => {
        if (deny) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
        return { database: db, resolveContact, ...lookups };
      },
      settings,
      "test-encryption-secret"
    );
    const service = new FrappeContactImportService(
      db,
      "test-encryption-secret",
      settings,
      resolveContact
    );
    await sql`INSERT INTO frappe_contact_imports (remote_name,local_contact_id) VALUES ('PAIR-A1',99999)`.execute(
      db
    );
    const before = await service.preview(1, lookups);
    assert.equal(before.source, "mobile-contact-customer");
    assert.equal(before.items.length, 4);
    assert.ok(
      before.items.every((row) => row.localContactId === null && row.identityStatus === "new"),
      "legacy non-association links must not be treated as existing mobile/customer imports"
    );
    malformedMobile = true;
    await assert.rejects(
      service.pull("PAIR-A1", lookups.findContactById),
      /Mobile Contact is invalid/
    );
    malformedMobile = false;
    await assert.rejects(service.pull("missing-pair", lookups.findContactById), /invalid fields/);
    const a = await service.pull("PAIR-A1", lookups.findContactById);
    await sql`INSERT INTO core_contacts_emails (parent_id,email,email_type,is_primary) VALUES (${a.localId},'retained@local.invalid','Primary',1)`.execute(
      db
    );
    await assert.rejects(
      runWithCoreDatabase(name, () =>
        new ContactService().update(String(a.localId), {
          code: "CHANGED",
          name: "Customer A",
          typeId: 1
        })
      ),
      /externally linked contact code cannot change/
    );
    const legacyKey = createHash("sha256")
      .update(
        JSON.stringify(["https://frappe.test", "Mobile Contact Customer", "customer", "C2887"])
      )
      .digest("hex");
    const customerType = await db
      .selectFrom("core_contact_types" as never)
      .select(["id" as never])
      .where("name" as never, "=", "Customer" as never)
      .where("status" as never, "=", "active" as never)
      .executeTakeFirstOrThrow();
    const legacyContact = await runWithCoreDatabase(name, () =>
      new ContactService().create({
        code: `EXT-${legacyKey.toUpperCase()}`,
        name: "Customer B old local name",
        typeId: Number(customerType.id),
        phones: [{ phone: "9876543210", phoneType: "Mobile", isPrimary: true }]
      })
    );
    const pairKey = `mobile-customer:${createHash("sha256")
      .update(JSON.stringify(["https://frappe.test", "Mobile Contact Customer", "pair", "PAIR-B1"]))
      .digest("hex")}`;
    await sql`INSERT INTO frappe_contact_imports (remote_name,local_contact_id) VALUES (${pairKey},${legacyContact.id})`.execute(
      db
    );
    const b = await service.pull("PAIR-B1", lookups.findContactById);
    assert.equal(
      b.localId,
      legacyContact.id,
      "Import must correct the existing local contact in place."
    );
    assert.equal(b.localCode, "C2887", "The local code must use Frappe's customer document ID.");
    assert.notEqual(a.localId, b.localId, "shared mobile must not merge two customers");
    const more = await Promise.all([
      service.pull("PAIR-A2", lookups.findContactById),
      service.pull("PAIR-A3", lookups.findContactById),
      service.pull("PAIR-A2", lookups.findContactById)
    ]);
    assert.ok(
      more.every((row) => row.localId === a.localId),
      "one customer with multiple mobiles must keep one Core identity"
    );
    assert.equal((await service.pull("PAIR-A1", lookups.findContactById)).status, "linked");
    const customers = await sql<{
      name: string;
      primary_phone: string;
    }>`SELECT name,primary_phone FROM core_contacts WHERE id IN (${a.localId},${b.localId}) ORDER BY name`.execute(
      db
    );
    assert.deepEqual(
      customers.rows.map((row) => row.name),
      ["Customer A", "Customer B old local name"],
      "new imports use the current Customer name and existing contacts retain local names"
    );
    const phones = await sql<{
      phone: string;
      is_primary: number;
    }>`SELECT phone,is_primary FROM core_contacts_phones WHERE parent_id=${a.localId} ORDER BY phone`.execute(
      db
    );
    const retained = await sql<{
      total: number;
    }>`SELECT COUNT(*) AS total FROM core_contacts_emails WHERE parent_id=${a.localId} AND email='retained@local.invalid'`.execute(
      db
    );
    assert.equal(
      Number(retained.rows[0]?.total),
      1,
      "adding imported mobiles preserves existing email rows"
    );
    assert.equal(phones.rows.length, 3);
    assert.equal(phones.rows.filter((row) => row.is_primary).length, 1);
    assert.ok(
      (await service.preview(1, lookups)).items.every((row) => row.identityStatus === "matched")
    );
    pairs.push({
      name: "PAIR-NAME",
      mobile_contact: "9999001234",
      customer: "Customer With Spaces",
      customer_name: "Customer With Spaces"
    });
    const named = await service.pull("PAIR-NAME", lookups.findContactById);
    await sql`UPDATE core_contacts SET code='CUSTOMER-WITH-SPACES' WHERE id=${named.localId}`.execute(
      db
    );
    const namedKey = createHash("sha256")
      .update(
        JSON.stringify([
          "https://frappe.test",
          "Mobile Contact Customer",
          "customer",
          "Customer With Spaces"
        ])
      )
      .digest("hex");
    const linkedId = await findEnquiryCustomerIdentity(db, namedKey, "Customer With Spaces");
    assert.equal(linkedId, named.localId);
    const reused = await resolveContact({
      externalKey: namedKey,
      externalCode: "Customer With Spaces",
      name: "Customer With Spaces",
      mobile: "9999001234",
      existingContactId: named.localId
    });
    assert.equal(reused.id, named.localId);
    assert.equal(reused.code, "CUSTOMER-WITH-SPACES");
    await assert.rejects(
      findEnquiryCustomerIdentity(db, "a".repeat(64), "Customer With Spaces"),
      /another source/
    );
    const namedPreview = (await service.preview(1, lookups)).items.find(
      (row) => row.name === "PAIR-NAME"
    );
    assert.equal(namedPreview?.localContactId, named.localId);
    assert.equal(namedPreview?.identityStatus, "matched");
    pairs.pop();
    const concurrent = await Promise.all([
      resolveContact({
        externalKey: "e".repeat(64),
        externalCode: "CONCURRENT",
        name: "Concurrent",
        mobile: "9345678901"
      }),
      resolveContact({
        externalKey: "e".repeat(64),
        externalCode: "CONCURRENT",
        name: "Concurrent",
        mobile: "9456789012"
      })
    ]);
    assert.equal(concurrent[0]!.id, concurrent[1]!.id);
    const inactive =
      await sql`UPDATE core_contacts SET status='suspend' WHERE id=${a.localId}`.execute(db);
    assert.ok(inactive);
    await assert.rejects(service.pull("PAIR-A1", lookups.findContactById), /inactive/);
    disabled = true;
    await assert.rejects(service.pull("PAIR-B1", lookups.findContactById), /disabled/);
    disabled = false;
    const route = await app.inject({ method: "GET", url: "/frappe/contacts/remote" });
    assert.equal(route.statusCode, 200, route.body);
    assert.equal(route.json().data.source, "mobile-contact-customer");
    deny = true;
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/frappe/contacts/pull",
          payload: { remoteName: "PAIR-B1" }
        })
      ).statusCode,
      403
    );
    assert.ok(
      paths.every((path) => !path.startsWith("/api/resource/Contact")),
      "person-level Frappe Contact must not be queried"
    );
    await new FrappeConnectionRepository(db).saveConnection(
      { ...settings, baseUrl: "https://other-frappe.test", connectionName: "Other source" },
      "test-encryption-secret"
    );
    await new FrappeConnectionRepository(db).recordVerification("verified");
    assert.ok(
      (await service.preview(1, lookups)).items.every(
        (row) => row.localContactId !== null && row.identityStatus === "mismatch"
      ),
      "the same remote document ID from another source must be marked as a mismatch"
    );
    await assert.rejects(
      service.pull("PAIR-B1", lookups.findContactById),
      /already linked from another Frappe site/,
      "a separate source identity must not create or merge another local contact"
    );
    await new FrappeConnectionRepository(db).completeImport("test-actor");
    await assert.rejects(service.preview(1, lookups), /Verify the Frappe connection/);
  }
);
