import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { createConnection } from "mysql2/promise";
import { env } from "../../apps/platform/api/src/env.js";
import { EnquirySyncRepository } from "../../apps/crm/api/src/modules/enquiry/enquiry.sync.repository.js";
import type { EnquiryDatabase } from "../../apps/crm/api/src/modules/enquiry/enquiry.types.js";
import { EnquirySyncStateReader } from "../../apps/frappe/api/src/modules/enquiry-sync/enquiry-sync.state.js";

assert.equal(
  env.NODE_ENV,
  "development",
  "This suite provisions only a disposable local database."
);
assert.notEqual(env.DEFAULT_TENANT_DB_NAME, env.DB_MASTER_NAME);

const testDatabaseName = `codexsun_enquiry_sync_e2e_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
function openDatabase() {
  return new Kysely<EnquiryDatabase>({
    dialect: new MysqlDialect({
      pool: createPool({
        database: testDatabaseName,
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        timezone: "Z",
        connectionLimit: 2
      })
    })
  });
}

test("local enquiry changes enter the Frappe queue in order and coalesce safely", async (suite) => {
  const admin = await createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD
  });
  await admin.query(
    `CREATE DATABASE \`${testDatabaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  const database = openDatabase();
  suite.after(async () => {
    await database.destroy();
    assert.match(testDatabaseName, /^codexsun_enquiry_sync_e2e_[a-f0-9]{16}$/);
    await admin.query(`DROP DATABASE \`${testDatabaseName}\``);
    await admin.end();
  });

  await sql
    .raw(
      `CREATE TABLE crm_enquiries (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    enquiry_no INT NOT NULL,
    title VARCHAR(255) NOT NULL
  ) ENGINE=InnoDB`
    )
    .execute(database);
  await sql
    .raw(
      `CREATE TABLE crm_enquiry_sync_events (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(8) NOT NULL DEFAULT (LOWER(SUBSTRING(MD5(UUID()),1,8))),
    enquiry_id INT NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    entity_id INT NULL,
    actor_email VARCHAR(191) NOT NULL,
    correlation_id VARCHAR(191) NOT NULL,
    idempotency_key VARCHAR(191) NOT NULL UNIQUE,
    status VARCHAR(16) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remote_name VARCHAR(191) NULL,
    last_error TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY sync_pending_idx (status, available_at, id),
    KEY sync_enquiry_idx (enquiry_id, id),
    CONSTRAINT sync_enquiry_fk FOREIGN KEY (enquiry_id) REFERENCES crm_enquiries(id)
  ) ENGINE=InnoDB`
    )
    .execute(database);
  await sql
    .raw(
      `CREATE TABLE crm_enquiry_sync_validation (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(8) NOT NULL DEFAULT (LOWER(SUBSTRING(MD5(UUID()),1,8))),
    event_id INT NOT NULL,
    validation_status VARCHAR(16) NOT NULL,
    errors_json TEXT NOT NULL,
    checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY sync_validation_event_idx (event_id, id),
    CONSTRAINT sync_validation_event_fk FOREIGN KEY (event_id) REFERENCES crm_enquiry_sync_events(id)
  ) ENGINE=InnoDB`
    )
    .execute(database);
  await sql
    .raw(
      `CREATE TABLE frappe_enquiry_sync (
    enquiry_id INT PRIMARY KEY, remote_name VARCHAR(191) NOT NULL
  ) ENGINE=InnoDB`
    )
    .execute(database);
  await sql`INSERT INTO crm_enquiries (id,enquiry_no,title) VALUES
    (100,930,'Imported'),(101,931,'Local only')`.execute(database);
  await sql`INSERT INTO frappe_enquiry_sync (enquiry_id,remote_name) VALUES (100,'Q930')`.execute(
    database
  );
  const reader = new EnquirySyncStateReader(database as never);
  const importedStates = await reader.read([100, 101]);
  assert.deepEqual(importedStates.get(100), { status: "synced", error: null, remoteName: "Q930" });
  assert.deepEqual(importedStates.get(101), { status: "unlinked", error: null, remoteName: null });
  const inserted = await sql<{ id: number }>`INSERT INTO crm_enquiries (enquiry_no,title)
    VALUES (1,'Queue test')`.execute(database);
  const enquiryId = Number(inserted.insertId);

  await assert.rejects(
    database.transaction().execute(async (transaction) => {
      const queue = new EnquirySyncRepository(transaction);
      const before = await queue.listQueue("all", 1, 1);
      const failedBefore = await queue.listQueue("failed", 1, 1);
      const first = await queue.enqueue(
        {
          actorEmail: "sync-test@local.invalid",
          correlationId: randomUUID(),
          enquiryId,
          eventType: "enquiry-upsert"
        },
        transaction
      );
      const second = await queue.enqueue(
        {
          actorEmail: "sync-test@local.invalid",
          correlationId: randomUUID(),
          enquiryId,
          eventType: "comment-add",
          entityId: 1
        },
        transaction
      );
      assert.equal((await queue.listQueue("all", 1, 1)).total, before.total + 2);

      const firstDispatch = await queue.dispatchableEvents(100);
      assert.ok(firstDispatch.some((event) => event.id === first));
      assert.ok(!firstDispatch.some((event) => event.id === second));
      assert.equal(await queue.markProcessing(second), false);
      assert.equal(await queue.markProcessing(first), true);
      assert.equal(await queue.markProcessing(second), false);
      assert.equal(await queue.markProcessing(first), false);
      await queue.markSynced(first, "ENQ-TEST");

      const nextDispatch = await queue.dispatchableEvents(100);
      assert.ok(nextDispatch.some((event) => event.id === second));
      await queue.markFailed(second, 5, "Test failure");
      assert.equal((await queue.getEvent(second))?.status, "failed");
      const failed = await queue.listQueue("failed", 1, 100);
      assert.ok(failed.items.some((event) => event.id === second));
      assert.equal(failed.total, failedBefore.total + 1);
      const failedUpdate = await queue.enqueueUpsert(
        {
          actorEmail: "sync-test@local.invalid",
          correlationId: randomUUID(),
          enquiryId
        },
        transaction
      );
      assert.notEqual(failedUpdate, second);
      assert.equal((await queue.getEvent(second))?.status, "failed");
      assert.ok((await queue.dispatchableEvents(100)).some((event) => event.id === failedUpdate));
      const originalCorrelation = (await queue.getEvent(second))?.correlation_id;
      await queue.retry(second);
      const retried = await queue.getEvent(second);
      assert.equal(retried?.status, "pending");
      assert.equal(retried?.attempts, 0);
      assert.equal(retried?.last_error, "Test failure");
      assert.notEqual(retried?.correlation_id, originalCorrelation);
      const retriedDispatch = await queue.dispatchableEvents(100);
      assert.ok(retriedDispatch.some((event) => event.id === second));
      assert.ok(!retriedDispatch.some((event) => event.id === failedUpdate));
      await queue.markSynced(second, "ENQ-TEST-RETRIED");
      assert.ok((await queue.dispatchableEvents(100)).some((event) => event.id === failedUpdate));
      assert.ok(
        (await queue.listQueue("pending", 1, 100)).items.some((event) => event.id === failedUpdate)
      );
      const previousGeneration = (await queue.getEvent(failedUpdate))?.correlation_id;
      const coalesced = await queue.enqueueUpsert(
        {
          actorEmail: "sync-test@local.invalid",
          correlationId: randomUUID(),
          enquiryId
        },
        transaction
      );
      assert.equal(coalesced, failedUpdate);
      assert.notEqual((await queue.getEvent(coalesced))?.correlation_id, previousGeneration);
      assert.equal((await queue.getEvent(failedUpdate))?.event_type, "enquiry-upsert");
      const pendingComment = await queue.enqueue(
        {
          actorEmail: "sync-test@local.invalid",
          correlationId: randomUUID(),
          enquiryId,
          eventType: "comment-add",
          entityId: 2
        },
        transaction
      );
      const laterUpdate = await queue.enqueueUpsert(
        {
          actorEmail: "sync-test@local.invalid",
          correlationId: randomUUID(),
          enquiryId
        },
        transaction
      );
      assert.notEqual(laterUpdate, pendingComment);
      assert.equal((await queue.getEvent(pendingComment))?.event_type, "comment-add");
      assert.equal((await queue.getEvent(pendingComment))?.entity_id, 2);
      assert.equal((await queue.latestStatuses([enquiryId])).get(enquiryId), "pending");
      const mappingError =
        "This enquiry's Customer has no unique identity on the connected Frappe site.";
      await queue.markFailed(laterUpdate, 5, mappingError);
      const dependency = await queue.enqueue(
        {
          actorEmail: "sync-test@local.invalid",
          correlationId: randomUUID(),
          enquiryId,
          eventType: "comment-add",
          entityId: 3
        },
        transaction
      );
      await queue.markFailed(dependency, 5, "Sync the enquiry before posting its comments.");
      assert.equal((await queue.deliveryStates([enquiryId])).get(enquiryId)?.error, mappingError);
      assert.equal((await queue.latestUpsert(enquiryId))?.id, laterUpdate);
      const recovered = await queue.enqueueUpsert(
        {
          actorEmail: "sync-test@local.invalid",
          correlationId: randomUUID(),
          enquiryId
        },
        transaction
      );
      await queue.markSynced(recovered, "Q930");
      assert.equal(
        (await queue.deliveryStates([enquiryId])).get(enquiryId)?.error,
        "Sync the enquiry before posting its comments."
      );
      const pendingLinkedComment = await queue.enqueue(
        {
          actorEmail: "sync-test@local.invalid",
          correlationId: randomUUID(),
          enquiryId: 100,
          eventType: "comment-add",
          entityId: 99
        },
        transaction
      );
      const beforeDeferral = await queue.getEvent(pendingLinkedComment);
      await queue.deferDelivery(pendingLinkedComment);
      const deferred = await queue.getEvent(pendingLinkedComment);
      assert.notEqual(deferred?.correlation_id, beforeDeferral?.correlation_id);
      assert.equal(deferred?.idempotency_key, beforeDeferral?.idempotency_key);
      assert.equal(deferred?.entity_id, beforeDeferral?.entity_id);
      assert.equal(deferred?.attempts, beforeDeferral?.attempts);
      assert.equal(deferred?.last_error, beforeDeferral?.last_error);
      assert.equal(deferred?.status, "pending");
      const completedLinkedUpdate = await queue.enqueueUpsert(
        {
          actorEmail: "sync-test@local.invalid",
          correlationId: randomUUID(),
          enquiryId: 100
        },
        transaction
      );
      await queue.markSynced(completedLinkedUpdate, "Q930");
      const pendingState = (await new EnquirySyncStateReader(transaction as never).read([100])).get(
        100
      );
      assert.equal(pendingState?.status, "pending");
      assert.equal(pendingState?.remoteName, "Q930");
      assert.equal((await queue.getEvent(pendingLinkedComment))?.status, "pending");
      throw new Error("rollback sync test");
    }),
    /rollback sync test/
  );
});
