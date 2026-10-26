import assert from "node:assert/strict";
import { test } from "node:test";
import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { env } from "../../apps/platform/api/src/env.js";
import { migrateCallLogModule } from "../../apps/crm/api/src/modules/call-log/call-log.migration.js";
import { CallLogRepository } from "../../apps/crm/api/src/modules/call-log/call-log.repository.js";
import { EnquiryRepository } from "../../apps/crm/api/src/modules/enquiry/enquiry.repository.js";
import type { EnquiryDatabase } from "../../apps/crm/api/src/modules/enquiry/enquiry.types.js";

assert.equal(env.NODE_ENV, "development", "This suite uses only the local development database.");
assert.notEqual(env.DEFAULT_TENANT_DB_NAME, env.DB_MASTER_NAME);

function openDatabase() {
  return new Kysely<unknown>({
    dialect: new MysqlDialect({
      pool: createPool({
        database: env.DEFAULT_TENANT_DB_NAME,
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

test("Call Logs persist locally without an outbound Frappe event", async () => {
  const first = openDatabase();
  let id: number | null = null;
  try {
    await migrateCallLogModule(first);
    const marker = `local-test-${Date.now()}`;
    const created = await new CallLogRepository(first).create(
      {
        type: "Incoming",
        from: marker,
        to: "9000000000",
        status: "Completed",
        duration: 27,
        user: null
      },
      "system:local-test"
    );
    id = Number(created.name.slice(3));
    assert.ok(Number.isSafeInteger(id) && id > 0);
    await first.destroy();

    const reopened = openDatabase();
    try {
      const list = await new CallLogRepository(reopened).list({
        page: 1,
        pageSize: 10,
        search: marker,
        type: "Incoming",
        status: "Completed"
      });
      assert.equal(list.items.length, 1);
      assert.equal(list.items[0]?.name, created.name);
      assert.equal(list.items[0]?.duration, 27);
      const events = await sql<{
        count: number;
      }>`SELECT COUNT(*) AS count FROM crm_call_log_sync_events WHERE call_log_id=${id}`.execute(
        reopened
      );
      assert.equal(Number(events.rows[0]?.count), 0);
    } finally {
      if (id) {
        await sql`DELETE FROM crm_call_log_sync_events WHERE call_log_id=${id}`.execute(reopened);
        await sql`DELETE FROM crm_call_logs WHERE id=${id}`.execute(reopened);
      }
      await reopened.destroy();
    }
  } finally {
    await first.destroy();
  }
});

test("mobile call logs and comments persist locally without a Frappe event", async () => {
  const first = openDatabase();
  let id: number | null = null;
  try {
    await migrateCallLogModule(first);
    const marker = `mobile-call-${Date.now()}`;
    const repository = new CallLogRepository(first);
    const input = {
      type: "Incoming" as const,
      from: "9000000000",
      to: "mobile-device",
      status: "Completed",
      duration: 31,
      user: null,
      sourceReference: marker,
      occurredAt: "2026-10-13T10:30:00.000Z"
    };
    const created = await repository.create(input, "mobile-test@local.invalid");
    id = Number(created.name.slice(3));
    assert.ok(Number.isSafeInteger(id) && id > 0);
    assert.equal((await repository.create(input, "mobile-test@local.invalid")).name, created.name);
    const comment = await repository.addComment(
      id,
      "Saved from the mobile call log.",
      "mobile-test@local.invalid"
    );
    assert.equal(comment.callLogId, id);
    await first.destroy();

    const reopened = openDatabase();
    try {
      const comments = await new CallLogRepository(reopened).listComments(id);
      assert.equal(comments.length, 1);
      assert.equal(comments[0]?.body, "Saved from the mobile call log.");
      const events = await sql<{ count: number }>`SELECT COUNT(*) AS count
        FROM crm_call_log_sync_events WHERE call_log_id=${id}`.execute(reopened);
      assert.equal(Number(events.rows[0]?.count), 0);
    } finally {
      if (id) {
        await sql`DELETE FROM crm_call_log_comments WHERE call_log_id=${id}`.execute(reopened);
        await sql`DELETE FROM crm_call_logs WHERE id=${id}`.execute(reopened);
      }
      await reopened.destroy();
    }
  } finally {
    await first.destroy();
  }
});

test("mobile enquiries retain durable pending events without Frappe delivery", async () => {
  const database = openDatabase() as unknown as Kysely<EnquiryDatabase>;
  let id: number | null = null;
  try {
    const [list, status, priority] = await Promise.all([
      sql<{
        id: number;
      }>`SELECT id FROM crm_enquiry_lists WHERE status='active' ORDER BY id LIMIT 1`.execute(
        database
      ),
      sql<{
        id: number;
      }>`SELECT id FROM crm_enquiry_statuses WHERE code='new' AND status='active' LIMIT 1`.execute(
        database
      ),
      sql<{
        id: number;
      }>`SELECT id FROM crm_enquiry_priorities WHERE code='normal' AND status='active' LIMIT 1`.execute(
        database
      )
    ]);
    const marker = `mobile-enquiry-${Date.now()}`;
    const created = await new EnquiryRepository(database).create(
      {
        title: marker,
        description: "Created through the mobile CRM path.",
        contactId: null,
        capturedName: "Mobile test contact",
        capturedEmail: null,
        capturedPhone: "9000000000",
        source: "mobile",
        sourceReference: marker,
        listInId: list.rows[0]?.id ?? null,
        statusId: status.rows[0]!.id,
        priorityId: priority.rows[0]!.id,
        assignedUserId: null,
        enquiredAt: "2026-10-13T10:30:00.000Z",
        dueDate: null,
        closedReason: null
      },
      "mobile-test@local.invalid",
      undefined
    );
    id = created?.id ?? null;
    assert.ok(id);
    const [activities, events] = await Promise.all([
      sql<{
        count: number;
      }>`SELECT COUNT(*) AS count FROM crm_enquiry_activity WHERE enquiry_id=${id}`.execute(
        database
      ),
      sql<{
        count: number;
      }>`SELECT COUNT(*) AS count FROM crm_enquiry_sync_events WHERE enquiry_id=${id}`.execute(
        database
      )
    ]);
    assert.equal(Number(activities.rows[0]?.count), 1);
    assert.equal(Number(events.rows[0]?.count), 2);
    const attempts = await sql<{ attempts: number; status: string }>`
      SELECT attempts,status FROM crm_enquiry_sync_events WHERE enquiry_id=${id}
    `.execute(database);
    assert.ok(attempts.rows.every((event) => event.attempts === 0 && event.status === "pending"));
  } finally {
    try {
      if (id) {
        await sql`DELETE FROM crm_enquiry_sync_validation WHERE event_id IN
          (SELECT id FROM crm_enquiry_sync_events WHERE enquiry_id=${id})`.execute(database);
        await sql`DELETE FROM crm_enquiry_sync_events WHERE enquiry_id=${id}`.execute(database);
        await sql`DELETE FROM crm_enquiry_activity WHERE enquiry_id=${id}`.execute(database);
        await sql`DELETE FROM crm_enquiry_comments WHERE enquiry_id=${id}`.execute(database);
        await sql`DELETE FROM crm_enquiries WHERE id=${id}`.execute(database);
      }
    } finally {
      await database.destroy();
    }
  }
});
