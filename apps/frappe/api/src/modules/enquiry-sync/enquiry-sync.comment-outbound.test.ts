import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { scopedFrappeCommentKey } from "@codexsun/crm-api/enquiry-sync";
import { afterEach, test } from "node:test";
import type { Kysely } from "kysely";
import type { FrappeDatabase } from "../connection/index.js";
import { postEnquiryComment } from "./enquiry-sync.comment-outbound.js";
import { enquiryCommentRemoteName } from "./enquiry-sync.comment-identity.js";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const settings = {
  baseUrl: "https://frappe.example/",
  apiKey: "key",
  apiSecret: "secret",
  enabled: true
};
const event = {
  id: 10,
  enquiry_id: 42,
  entity_id: 7,
  event_type: "comment-add",
  status: "pending",
  idempotency_key: "comment-add:42:7:durable-key"
};
const comment = {
  id: 7,
  enquiry_id: 42,
  parent_id: null,
  body: "Use <safe> & clear\nnotes",
  body_format: "plain",
  request_id: "request-1"
};

function database(comments: object[] = [comment], events: object[] = [event], linked = true) {
  const tables: Record<string, object[]> = {
    crm_enquiry_sync_events: events,
    crm_enquiry_comments: comments,
    frappe_enquiry_sync: linked ? [{ enquiry_id: 42, remote_name: "Q930" }] : []
  };
  return {
    selectFrom: (table: string) => {
      const filters: Array<[string, unknown]> = [];
      const matching = () =>
        (tables[table] ?? []).filter((row) =>
          filters.every(([key, value]) => (row as Record<string, unknown>)[key] === value)
        );
      const query = {
        selectAll: () => query,
        select: () => query,
        where: (key: string, _operator: string, value: unknown) => {
          filters.push([key, value]);
          return query;
        },
        orderBy: () => query,
        execute: async () => matching(),
        executeTakeFirst: async () => matching()[0]
      };
      return query;
    }
  } as unknown as Kysely<FrappeDatabase>;
}

test("an unlinked comment reports the parent Customer mapping failure without a remote write", async () => {
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    throw new Error("Unexpected remote request");
  };
  const reason = "This enquiry's Customer has no unique identity on the connected Frappe site.";
  const upsert = {
    id: 9,
    enquiry_id: 42,
    event_type: "enquiry-upsert",
    status: "failed",
    last_error: reason
  };
  await assert.rejects(
    postEnquiryComment(database([comment], [event, upsert], false), event.id, settings),
    { message: `Enquiry export blocked: ${reason}` }
  );
  assert.equal(requests, 0);
});

test("a lost Job Comments response retries the same document name without a second insert", async () => {
  const stored: Record<string, unknown>[] = [];
  let posts = 0;
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/v2/method/frappe.client.get_list") return Response.json({ message: stored });
    assert.equal(path, "/api/v2/document/Job%20Comments");
    posts++;
    const body = JSON.parse(String(init?.body));
    assert.equal(body.name, enquiryCommentRemoteName(settings.baseUrl, event.idempotency_key));
    assert.equal(body.comment, "Use &lt;safe&gt; &amp; clear<br>notes");
    stored.push(body);
    throw new Error("Connection lost after remote commit");
  };
  await assert.rejects(postEnquiryComment(database(), event.id, settings), /could not be reached/);
  const name = await postEnquiryComment(database(), event.id, settings);
  assert.equal(name, stored[0]?.name);
  assert.equal(posts, 1);
  assert.equal(stored.length, 1);
});

test("a reused remote comment identity with different content is blocked", async () => {
  globalThis.fetch = async () =>
    Response.json({
      message: [
        {
          name: enquiryCommentRemoteName(settings.baseUrl, event.idempotency_key),
          job_type: "Enquiry",
          job_id: "Q930",
          comment: "Different remote content"
        }
      ]
    });
  await assert.rejects(postEnquiryComment(database(), event.id, settings), /different content/);
});

test("a local reply uses its synced parent Job Comments identity", async () => {
  globalThis.fetch = async (input, init) => {
    if (new URL(String(input)).pathname.endsWith("frappe.client.get_list"))
      return Response.json({
        message: [{ name: "JOBCOM-parent", job_type: "Enquiry", job_id: "Q930" }]
      });
    const body = JSON.parse(String(init?.body));
    assert.equal(body.parent_comment, "JOBCOM-parent");
    assert.equal(body.mode, "Reply");
    return Response.json({ data: body });
  };
  const db = database(
    [
      { ...comment, parent_id: 6 },
      { ...comment, id: 6 }
    ],
    [event, { ...event, id: 9, entity_id: 6, status: "synced", remote_name: "JOBCOM-parent" }]
  );
  assert.equal(
    await postEnquiryComment(db, event.id, settings),
    enquiryCommentRemoteName(settings.baseUrl, event.idempotency_key)
  );
});

test("a reply cannot use a parent from another enquiry", async () => {
  globalThis.fetch = async () => Response.json({ message: [] });
  const db = database([
    { ...comment, parent_id: 6 },
    { ...comment, id: 6, enquiry_id: 99 }
  ]);
  await assert.rejects(postEnquiryComment(db, event.id, settings), /not part of this enquiry/);
});

test("a reply resolves an imported parent with an enquiry-scoped source key", async () => {
  globalThis.fetch = async (input, init) => {
    if (new URL(String(input)).pathname.endsWith("frappe.client.get_list"))
      return Response.json({
        message: [{ name: "JC-source", job_type: "Enquiry", job_id: "Q930" }]
      });
    const body = JSON.parse(String(init?.body));
    assert.equal(body.parent_comment, "JC-source");
    return Response.json({ data: body });
  };
  const sourceKey = `frappe:${createHash("sha256").update("JC-source").digest("hex")}`;
  const db = database([
    { ...comment, parent_id: 6 },
    { ...comment, id: 6, request_id: scopedFrappeCommentKey(42, sourceKey) }
  ]);
  await postEnquiryComment(db, event.id, settings);
});
