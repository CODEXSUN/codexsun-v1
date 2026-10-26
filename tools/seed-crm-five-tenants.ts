import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import mysql from "mysql2/promise";
import { env } from "../apps/platform/api/src/env.ts";
import { TenantService } from "../apps/platform/api/src/modules/tenant/tenant.service.ts";
import { SubscriptionService } from "../apps/platform/api/src/modules/subscription/subscription.service.ts";
import { provisionTenantDatabase } from "../apps/platform/api/src/modules/tenant/tenant.seed.ts";
import { platformAppRegistry } from "../apps/platform/api/src/modules/app-registry/index.ts";
import { closePlatformDatabase } from "../apps/platform/api/src/database/platform-database.ts";
import { closeAllTenantDatabases } from "../apps/platform/api/src/database/tenant-database.ts";
import { closeCoreDatabase } from "../apps/core/api/src/database/core-database.ts";

assert.equal(env.DB_HOST, "127.0.0.1");
assert.equal(env.DB_MASTER_NAME, "codexsun_crm_dev_master");
assert.equal(env.CODEXSUN_TENANCY_MODE, "multi");
assert.equal(env.CODEXSUN_FRAPPE_ENABLED, "0");
assert.equal(env.CODEXSUN_QUEUE_WORKER_ENABLED, "0");
const service = new TenantService(),
  subscriptions = new SubscriptionService();
const master = await mysql.createConnection({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_MASTER_NAME
});
const out = ".codex-runtime/crm/tenancy";
mkdirSync(out, { recursive: true });
const manifestPath = `${out}/fixtures.json`;
const previous = existsSync(manifestPath)
  ? (JSON.parse(readFileSync(manifestPath, "utf8")) as Array<{
      code: string;
      dbName: string;
      tenantId: string;
    }>)
  : [];
const fixtures: any[] = [];
try {
  for (let index = 1; index <= 5; index++) {
    const code = `CRMISO${index}`,
      dbName = `codexsun_crm_iso_20261026_${index}`;
    let tenant = await service.getTenant(code);
    if (tenant) {
      const fixture = previous.find((item) => item.code === code);
      assert.equal(tenant.dbName, dbName);
      assert.equal(
        (tenant.payloadSettings.seed as { source?: string } | undefined)?.source,
        "crm-five-tenant-isolation-20261026"
      );
      assert.equal(fixture?.tenantId, tenant.uuid, `${code} needs its original fixture manifest`);
      const existing = await mysql.createConnection({
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: dbName
      });
      try {
        const [[count]] = await existing.query<any[]>("SELECT COUNT(*) n FROM crm_enquiries");
        assert.equal(Number(count.n), 3000, `${code} must retain exactly 3000 records`);
      } finally {
        await existing.end();
      }
      fixtures.push(fixture);
      continue;
    } else {
      const [schemas] = await master.execute<any[]>(
        "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?",
        [dbName]
      );
      assert.equal(schemas.length, 0, "Fresh test database must not already exist");
      tenant = await service.createTenant({
        corporateId: code,
        tenantCode: code,
        tenantName: `CRM Isolation Tenant ${index}`,
        slug: code.toLowerCase(),
        dbName,
        dbHost: env.DB_HOST,
        dbPort: env.DB_PORT,
        dbUser: env.DB_USER,
        dbSecretRef: "DB_PASSWORD",
        dbType: env.DB_DRIVER,
        status: "active",
        mobile: null,
        defaultLandingApp: "crm",
        enabledModuleKeys: ["platform.application", "crm"],
        primaryDomain: `${code.toLowerCase()}.localhost`,
        payloadSettings: {
          seed: { source: "crm-five-tenant-isolation-20261026" },
          apps: {
            disabled: platformAppRegistry
              .map((a) => a.moduleKey)
              .filter((key) => !["platform.application", "crm"].includes(key))
          }
        }
      });
      await subscriptions.createSubscription({
        tenantId: tenant.id,
        planId: 1,
        status: "active",
        billingCycle: "monthly",
        startsOn: "2026-10-26",
        endsOn: null
      });
      tenant = (await service.getTenant(code))!;
    }
    assert.deepEqual([...tenant.enabledModuleKeys].sort(), ["crm", "platform.application"]);
    await provisionTenantDatabase(tenant);
    const db = await mysql.createConnection({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: dbName
    });
    try {
      const [[prior]] = await db.query<any[]>("SELECT COUNT(*) n FROM crm_enquiries");
      assert.equal(Number(prior.n), 0, "Do not overwrite an existing test dataset");
      await db.beginTransaction();
      const [[type]] = await db.query<any[]>(
        "SELECT id FROM core_contact_types WHERE name='Customer' AND status='active' LIMIT 1"
      );
      assert.ok(type);
      const [[admin]] = await db.query<any[]>(
        "SELECT id,email,password_hash FROM app_users ORDER BY id LIMIT 1"
      );
      await db.execute(
        "INSERT INTO app_users (name,email,password_hash,role,status,created_by) VALUES(?,?,?,'user','active','crm-isolation-test')",
        [`${code} Restricted User`, "crm-isolation-user@example.invalid", admin.password_hash]
      );
      const [[reader]] = await db.query<any[]>(
        "SELECT id FROM app_users WHERE email='crm-isolation-user@example.invalid'"
      );
      await db.execute(
        "INSERT INTO app_user_roles(user_id,role_id,created_by) SELECT ?,id,'crm-isolation-test' FROM app_roles WHERE `key`='user'",
        [reader.id]
      );
      const contacts = [];
      for (let n = 0; n < 1599; n++)
        contacts.push([
          `${code}-${n < 100 ? "EXISTING" : "FRESH"}-${n}`,
          `${code} ${n < 100 ? "EXISTING" : "FRESH"} CONTACT ${n}`,
          type.id,
          "Customer",
          String(8100000000 + n),
          `shared-${n}@example.invalid`,
          "crm-isolation-test"
        ]);
      await db.query(
        "INSERT INTO core_contacts(code,name,type_id,type_name,primary_phone,primary_email,created_by) VALUES ?",
        [contacts]
      );
      const [savedContacts] = await db.query<any[]>(
        "SELECT id,code,name,primary_phone FROM core_contacts WHERE created_by='crm-isolation-test' ORDER BY id"
      );
      assert.equal(savedContacts.length, 1599);
      const [statuses] = await db.query<any[]>(
        "SELECT id,code FROM crm_enquiry_statuses ORDER BY id"
      );
      const [priorities] = await db.query<any[]>(
        "SELECT id,code FROM crm_enquiry_priorities ORDER BY id"
      );
      const [lists] = await db.query<any[]>("SELECT id FROM crm_enquiry_lists ORDER BY id");
      for (let batch = 0; batch < 6; batch++) {
        const rows = [];
        for (let n = batch * 500; n < Math.min(2998, (batch + 1) * 500); n++) {
          const contact = savedContacts[n < 1499 ? n % 100 : 100 + n - 1499],
            status = statuses[n % statuses.length],
            priority = priorities[n % priorities.length];
          rows.push([
            n === 2997 ? 9000 + index : n + 1,
            n + 1,
            `${code} RECORD ${n + 1} ${n % 7 === 0 ? "தமிழ் சேவை" : "ISOLATED"}`,
            `${code} private enquiry ${n}; ` + "local details ".repeat(n % 9 === 0 ? 80 : 2),
            contact.id,
            contact.name,
            contact.primary_phone,
            status.id,
            status.code,
            priority.id,
            priority.code,
            n % 2 === 0 ? admin.id : reader.id,
            new Date(Date.UTC(2026, 9, 26) - (n % 180) * 86400000),
            n % 5 === 0 ? null : "2026-11-01",
            lists[n % lists.length].id,
            admin.email,
            `crm-isolation:${code}:${n}`
          ]);
        }
        await db.query(
          "INSERT INTO crm_enquiries(id,enquiry_no,title,description,contact_id,captured_name,captured_phone,status_id,status,priority_id,priority,assigned_user_id,enquired_at,due_date,list_in_id,created_by,source_reference) VALUES ?",
          [rows]
        );
      }
      await db.query("UPDATE crm_enquiry_number_sequence SET next_no=2999 WHERE id=1");
      await db.commit();
      const signed = await api("/auth/login", undefined, {
        desk: "tenant",
        corporateId: code,
        email: env.DEFAULT_TENANT_ADMIN_EMAIL,
        password: env.DEFAULT_TENANT_ADMIN_PASSWORD
      });
      assert.equal(signed.status, 200);
      const token = signed.data.accessToken;
      const base = {
        title: `${code} API EXISTING`,
        description: `${code} existing contact acceptance`,
        contactId: null,
        capturedName: null,
        capturedEmail: null,
        capturedPhone: savedContacts[0].primary_phone,
        source: "manual",
        sourceReference: null,
        listInId: String(lists[0].id),
        statusId: "2",
        priorityId: "2",
        assignedUserId: String(admin.id),
        enquiredAt: "2026-10-26T06:00:00.000Z",
        dueDate: null,
        closedReason: null
      };
      const existing = await api("/crm/enquiries", token, base);
      assert.equal(existing.status, 200, existing.error);
      assert.equal(existing.data.contactId, savedContacts[0].id);
      const fresh = await api("/crm/enquiries", token, {
        ...base,
        title: `${code} API FRESH`,
        description: `${code} fresh contact acceptance`,
        capturedName: `${code} API FRESH CONTACT`,
        capturedPhone: "8119990001"
      });
      assert.equal(fresh.status, 200, fresh.error);
      assert.notEqual(fresh.data.contactId, existing.data.contactId);
      const foreignOnlyId = index * 10000;
      const foreignContactId = index * 20000;
      await db.execute("UPDATE crm_enquiries SET id=? WHERE source_reference=? AND id=?", [
        foreignOnlyId,
        `crm-isolation:${code}:2997`,
        9000 + index
      ]);
      await db.execute(
        "INSERT INTO core_contacts(id,code,name,primary_phone,created_by) VALUES(?,?,?,?, 'crm-isolation-test')",
        [
          foreignContactId,
          `${code}-SENTINEL`,
          `${code} PRIVATE SENTINEL CONTACT`,
          `812000000${index}`
        ]
      );
      const [[count]] = await db.query<any[]>("SELECT COUNT(*) n FROM crm_enquiries");
      assert.equal(Number(count.n), 3000);
      const [[contactCount]] = await db.query<any[]>("SELECT COUNT(*) n FROM core_contacts");
      fixtures.push({
        code,
        dbName,
        tenantId: tenant.uuid,
        registryId: tenant.id,
        adminEmail: admin.email,
        readerEmail: "crm-isolation-user@example.invalid",
        existingContactId: existing.data.contactId,
        freshContactId: fresh.data.contactId,
        existingRecordId: existing.data.id,
        freshRecordId: fresh.data.id,
        foreignOnlyId,
        foreignContactId,
        contacts: Number(contactCount.n),
        records: 3000
      });
      writeFileSync(`${out}/fixtures.json`, JSON.stringify(fixtures, null, 2));
      console.log(
        `${code}: 3000 records, ${contactCount.n} contacts; existing contact reused, fresh contact created through API`
      );
    } finally {
      await db.end();
    }
  }
} finally {
  await master.end();
  await closeAllTenantDatabases();
  await closeCoreDatabase();
  await closePlatformDatabase();
}

async function api(path: string, token?: string, body?: unknown) {
  const response = await fetch(`http://127.0.0.1:17210${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      "x-auth-token-delivery": "bearer",
      "x-company-id": "1",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const json = (await response.json()) as any;
  return { status: response.status, ...json };
}
