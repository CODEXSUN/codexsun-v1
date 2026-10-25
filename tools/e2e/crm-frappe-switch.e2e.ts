import { FrappeAvailabilityService } from "../../apps/frappe/api/src/modules/live-sync/live-sync.availability.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { createConnection } from "mysql2/promise";
import { env } from "../../apps/platform/api/src/env.js";
import { readCrmFrappeSyncAccess } from "../../apps/platform/api/src/crm-frappe-sync-access.js";
import { enqueueCrmEnquirySync } from "../../apps/platform/api/src/modules/queue-manager/crm-enquiry-sync.relay.js";
import {
  getTenantDatabase,
  closeAllTenantDatabases
} from "../../apps/platform/api/src/database/tenant-database.js";
import { EnquirySyncRepository } from "../../apps/crm/api/src/modules/enquiry/enquiry.sync.repository.js";
import { CrmFrappeSyncRepository } from "../../apps/crm/api/src/modules/frappe-sync/frappe-sync.repository.js";
import type { TenantDatabase } from "../../apps/platform/api/src/database/schema.js";
import type { QueueManagerService } from "../../apps/platform/api/src/modules/queue-manager/queue-manager.service.js";

assert.equal(env.NODE_ENV, "development", "Only disposable local databases are allowed.");

test("tenant switch gates CRM visibility and immediate queue dispatch without touching saved events", async (t) => {
  const name = `codexsun_sync_switch_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const admin = await createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD
  });
  await admin.query(`CREATE DATABASE ${name}`);
  const db = new Kysely<TenantDatabase>({
    dialect: new MysqlDialect({
      pool: createPool({
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: name,
        timezone: "Z"
      })
    })
  });
  t.after(async () => {
    await closeAllTenantDatabases();
    await db.destroy();
    await admin.query(`DROP DATABASE ${name}`);
    await admin.end();
  });
  await sql
    .raw(
      `CREATE TABLE app_module_settings (module_key VARCHAR(40), enabled BOOLEAN, status VARCHAR(24))`
    )
    .execute(db);
  await sql.raw(`INSERT INTO app_module_settings VALUES ('crm',1,'active')`).execute(db);
  // No Frappe tables: tenants without the app must not query integration storage.
  assert.deepEqual(await readCrmFrappeSyncAccess(db), { enabled: false, outbound: false });
  getTenantDatabase({
    uuid: "isolated-test",
    dbName: name,
    dbHost: env.DB_HOST,
    dbPort: env.DB_PORT,
    dbUser: env.DB_USER,
    dbSecretRef: "DB_PASSWORD"
  } as import("../../apps/platform/api/src/modules/tenant/tenant.types.js").Tenant);
  const originalReady = FrappeAvailabilityService.prototype.ready;
  FrappeAvailabilityService.prototype.ready = async () => ({
    ready: true,
    reason: null,
    retryAt: new Date().toISOString()
  });
  t.after(() => {
    FrappeAvailabilityService.prototype.ready = originalReady;
  });
  let dispatches = 0;
  const deliveries: string[] = [];
  const queue = {
    enqueue: async (input: { idempotencyKey: string }) => {
      dispatches++;
      deliveries.push(input.idempotencyKey);
      return { id: 7 };
    }
  } as unknown as QueueManagerService;
  const dispatch = () =>
    enqueueCrmEnquirySync(queue, {
      tenantId: "isolated-test",
      tenantDatabase: name,
      eventId: 1,
      actorEmail: "test@example.com"
    });
  assert.equal(await dispatch(), null);
  await sql.raw(`INSERT INTO app_module_settings VALUES ('frappe',1,'active')`).execute(db);
  await sql
    .raw(
      `CREATE TABLE frappe_connection_settings (id INT PRIMARY KEY, enabled BOOLEAN, verification_status VARCHAR(24))`
    )
    .execute(db);
  await sql.raw(`INSERT INTO frappe_connection_settings VALUES (1,1,'verified')`).execute(db);
  await sql
    .raw(
      `CREATE TABLE frappe_live_sync_settings (id INT PRIMARY KEY, enabled BOOLEAN, paused BOOLEAN, direction VARCHAR(24), schedule_minutes INT, contacts_enabled BOOLEAN, enquiries_enabled BOOLEAN, activities_enabled BOOLEAN, call_logs_enabled BOOLEAN, inbound_base_url VARCHAR(191), inbound_checkpoint_at DATETIME, last_scheduled_at DATETIME, updated_at DATETIME, updated_by VARCHAR(191))`
    )
    .execute(db);
  assert.deepEqual(await readCrmFrappeSyncAccess(db), { enabled: false, outbound: false });
  assert.equal(await dispatch(), null);
  await sql
    .raw(
      `INSERT INTO frappe_live_sync_settings VALUES (1,0,0,'bidirectional',1,1,1,1,1,NULL,NULL,NULL,UTC_TIMESTAMP(),'test')`
    )
    .execute(db);
  assert.deepEqual(await readCrmFrappeSyncAccess(db), { enabled: false, outbound: false });
  assert.equal(await dispatch(), null);
  await sql.raw(`UPDATE frappe_live_sync_settings SET enabled=1`).execute(db);
  assert.deepEqual(await readCrmFrappeSyncAccess(db), { enabled: true, outbound: true });
  await sql.raw(`UPDATE frappe_live_sync_settings SET direction='inbound'`).execute(db);
  assert.deepEqual(await readCrmFrappeSyncAccess(db), { enabled: true, outbound: false });
  assert.equal(await dispatch(), null);
  await sql
    .raw(`UPDATE frappe_live_sync_settings SET direction='bidirectional', paused=1`)
    .execute(db);
  assert.deepEqual(await readCrmFrappeSyncAccess(db), { enabled: true, outbound: false });
  assert.equal(await dispatch(), null);
  await sql.raw(`UPDATE frappe_live_sync_settings SET paused=0;`).execute(db);
  await sql.raw(`UPDATE frappe_connection_settings SET verification_status='failed'`).execute(db);
  assert.deepEqual(await readCrmFrappeSyncAccess(db), { enabled: true, outbound: false });
  await sql.raw(`UPDATE frappe_connection_settings SET enabled=0`).execute(db);
  assert.deepEqual(await readCrmFrappeSyncAccess(db), { enabled: false, outbound: false });
  assert.equal(await dispatch(), null);
  await sql.raw(`UPDATE app_module_settings SET enabled=0 WHERE module_key='frappe'`).execute(db);
  assert.deepEqual(await readCrmFrappeSyncAccess(db), { enabled: false, outbound: false });
  assert.equal(dispatches, 0);
  await sql
    .raw(
      `CREATE TABLE crm_enquiry_sync_events (id INT PRIMARY KEY, enquiry_id INT, actor_email VARCHAR(191), correlation_id VARCHAR(191), attempts INT, status VARCHAR(24), available_at DATETIME, idempotency_key VARCHAR(191), entity_id INT, last_error TEXT)`
    )
    .execute(db);
  await sql
    .raw(
      `INSERT INTO crm_enquiry_sync_events VALUES (1,10,'test@example.com','original',0,'pending',UTC_TIMESTAMP(),'stable-comment-identity',25,'Previous transport failure')`
    )
    .execute(db);
  await sql.raw(`UPDATE app_module_settings SET enabled=1 WHERE module_key='frappe'`).execute(db);
  await sql
    .raw(`UPDATE frappe_connection_settings SET enabled=1,verification_status='verified'`)
    .execute(db);
  assert.notEqual(await dispatch(), null);
  await dispatch();
  assert.equal(deliveries[0], deliveries[1], "Repeated scans reuse one delivery key.");
  const events = new EnquirySyncRepository(db as never);
  const before = await events.getEvent(1);
  await sql.raw(`UPDATE frappe_live_sync_settings SET enabled=0`).execute(db);
  assert.equal(await dispatch(), null);
  assert.equal(dispatches, 2);
  await events.deferDelivery(1);
  const deferred = await events.getEvent(1);
  assert.notEqual(deferred?.correlation_id, before?.correlation_id);
  assert.equal(deferred?.idempotency_key, before?.idempotency_key);
  assert.equal(deferred?.entity_id, before?.entity_id);
  assert.equal(deferred?.attempts, before?.attempts);
  assert.equal(deferred?.last_error, before?.last_error);
  await sql.raw(`UPDATE frappe_live_sync_settings SET enabled=1`).execute(db);
  await dispatch();
  assert.notEqual(
    deliveries[2],
    deliveries[0],
    "Resuming must not reuse a completed deferred delivery."
  );
  await sql
    .raw(
      `CREATE TABLE crm_frappe_sync_queue (id INT PRIMARY KEY, status VARCHAR(24), dispatch_revision INT, attempts INT, remote_name VARCHAR(191), last_error TEXT)`
    )
    .execute(db);
  await sql
    .raw(
      `INSERT INTO crm_frappe_sync_queue VALUES (1,'pending',3,0,'REMOTE-DUTY','Previous duty failure')`
    )
    .execute(db);
  await new CrmFrappeSyncRepository(db as never).deferDispatch(1);
  const duty = await sql<{
    dispatch_revision: number;
    remote_name: string;
    attempts: number;
    last_error: string;
  }>`SELECT * FROM crm_frappe_sync_queue WHERE id=1`.execute(db);
  assert.equal(duty.rows[0]?.dispatch_revision, 4);
  assert.equal(duty.rows[0]?.remote_name, "REMOTE-DUTY");
  assert.equal(duty.rows[0]?.attempts, 0);
  assert.equal(duty.rows[0]?.last_error, "Previous duty failure");
});
