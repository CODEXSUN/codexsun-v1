import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { env } from "../../apps/platform/api/src/env.js";
import {
  type Fixture,
  checked,
  login,
  request,
  results,
  snapshots
} from "./crm-five-tenant.support.js";

const output = ".codex-runtime/crm/tenancy";

const concurrentReadTimes: number[] = [];

test(
  "five real CRM tenant databases isolate reads, writes, contacts, sessions, and role scopes",
  { timeout: 180_000 },
  async (suite) => {
    assert.equal(env.NODE_ENV, "development");
    assert.equal(env.DB_HOST, "127.0.0.1");
    assert.equal(env.DB_MASTER_NAME, "codexsun_crm_dev_master");
    assert.equal(env.CODEXSUN_FRAPPE_ENABLED, "0");
    assert.equal(env.CODEXSUN_QUEUE_WORKER_ENABLED, "0");
    const fixtures = JSON.parse(readFileSync(`${output}/fixtures.json`, "utf8")) as Fixture[];
    assert.equal(fixtures.length, 5);
    const connections = new Map<string, Connection>();
    const tokens = new Map<string, string>();
    try {
      for (const fixture of fixtures) {
        assert.match(fixture.dbName, /^codexsun_crm_iso_20261026_[1-5]$/u);
        connections.set(
          fixture.code,
          await mysql.createConnection({
            host: env.DB_HOST,
            port: env.DB_PORT,
            user: env.DB_USER,
            password: env.DB_PASSWORD,
            database: fixture.dbName
          })
        );
        tokens.set(fixture.code, await login(fixture));
        await suite.test(
          `${fixture.code}: 3000 records, existing/fresh contacts and shared identifiers`,
          async () => {
            const token = tokens.get(fixture.code)!;
            const page = await checked(
              fixture,
              "list",
              "/crm/enquiries?scope=all&page=1&pageSize=100",
              token
            );
            assert.equal(page.data.total, 3000);
            assert.ok(page.data.items.every((row: any) => row.title.startsWith(fixture.code)));
            assert.equal(page.meta.tenantId, fixture.tenantId);
            const summary = await checked(
              fixture,
              "summary",
              "/crm/enquiries/summary?today=2026-10-26",
              token
            );
            assert.equal(summary.data.allCount, 3000);
            const shared = await checked(
              fixture,
              "shared mobile lookup",
              "/crm/enquiries?mobile=8100000000&page=1&pageSize=100",
              token
            );
            assert.ok(shared.data.items.length > 0);
            assert.ok(
              shared.data.items.every((row: any) => row.contactName.startsWith(fixture.code))
            );
            for (const id of [fixture.existingContactId, fixture.freshContactId]) {
              const contact = await checked(
                fixture,
                "contact detail",
                `/crm/contacts/${id}`,
                token
              );
              assert.ok(JSON.stringify(contact.data).includes(fixture.code));
            }
            const old = await checked(
              fixture,
              "existing contact enquiry",
              `/crm/enquiries/${fixture.existingRecordId}`,
              token
            );
            const fresh = await checked(
              fixture,
              "fresh contact enquiry",
              `/crm/enquiries/${fixture.freshRecordId}`,
              token
            );
            assert.equal(old.data.contactId, fixture.existingContactId);
            assert.equal(fresh.data.contactId, fixture.freshContactId);
            assert.notEqual(old.data.contactId, fresh.data.contactId);
            const readerToken = await login(fixture, true);
            const scoped = await checked(
              fixture,
              "restricted user list",
              "/crm/enquiries?scope=all&pageSize=100",
              readerToken
            );
            assert.equal(scoped.data.total, 1499);
            assert.ok(scoped.data.items.every((row: any) => row.assignedUserId === "2"));
            assert.equal((await request("/crm/enquiries/1", readerToken)).status, 403);
            const [modules] = await connections
              .get(fixture.code)!
              .query<RowDataPacket[]>(
                "SELECT module_key,enabled FROM app_module_settings WHERE enabled=1"
              );
            assert.deepEqual(modules.map((row) => row.module_key).sort(), [
              "crm",
              "platform.application"
            ]);
          }
        );
      }
      for (const actor of fixtures) {
        for (const foreign of fixtures.filter((fixture) => fixture.code !== actor.code)) {
          await suite.test(
            `${actor.code} cannot select ${foreign.code} through headers, IDs, contacts, or writes`,
            async () => {
              const token = tokens.get(actor.code)!;
              const headers = {
                "x-tenant-id": foreign.tenantId,
                "x-tenant-db": foreign.dbName,
                "x-company-id": "1"
              };
              const own = await checked(
                actor,
                "forged-header same-ID read",
                "/crm/enquiries/1",
                token,
                { headers }
              );
              assert.ok(own.data.title.startsWith(actor.code));
              assert.equal(own.meta.tenantId, actor.tenantId);
              const contacts = await checked(
                actor,
                "forged-header contacts",
                "/crm/contacts?search=8100000000",
                token,
                { headers }
              );
              assert.ok(!JSON.stringify(contacts.data).includes(foreign.code));
              const foreignSearch = await checked(
                actor,
                "foreign marker search",
                `/crm/enquiries?search=${foreign.code}`,
                token
              );
              assert.equal(foreignSearch.data.total, 0);
              const before = await snapshots(connections);
              const changed = await checked(
                actor,
                "forged-header write stays local",
                "/crm/enquiries/1/properties",
                token,
                {
                  method: "PATCH",
                  body: { dueDate: `2026-12-0${fixtures.indexOf(foreign) + 1}` },
                  headers
                }
              );
              assert.ok(changed.data.title.startsWith(actor.code));
              const after = await snapshots(connections);
              for (const other of fixtures.filter((fixture) => fixture.code !== actor.code))
                assert.deepEqual(
                  after[other.code],
                  before[other.code],
                  `${actor.code} write changed ${other.code}`
                );
              for (const [method, path, body] of [
                ["GET", `/crm/enquiries/${foreign.foreignOnlyId}`, undefined],
                [
                  "POST",
                  `/crm/mobile/enquiries/${foreign.foreignOnlyId}/comments`,
                  { body: `${actor.code} forbidden cross-tenant comment`, parentId: null }
                ],
                ["GET", `/crm/contacts/${foreign.foreignContactId}`, undefined]
              ] as const) {
                const denied = await request(path, token, { method, body, headers });
                assert.ok(
                  [403, 404].includes(denied.status),
                  `${method} ${path} returned ${denied.status}`
                );
              }
              const invalidContact = await request("/crm/enquiries/1", token, {
                method: "PUT",
                body: { ...own.data, contactId: foreign.foreignContactId },
                headers
              });
              assert.equal(invalidContact.status, 400);
              const claims = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
              claims.tenantId = foreign.tenantId;
              claims.tenantDbName = foreign.dbName;
              const forged = token.split(".");
              forged[1] = Buffer.from(JSON.stringify(claims)).toString("base64url");
              assert.equal((await request("/crm/enquiries/1", forged.join("."))).status, 401);
            }
          );
        }
      }
      await suite.test(
        "parallel tenant writes and job IDs remain inside their own databases",
        async () => {
          const comments = await Promise.all(
            fixtures.map((fixture) =>
              checked(
                fixture,
                "parallel comment",
                "/crm/mobile/enquiries/1/comments",
                tokens.get(fixture.code)!,
                {
                  method: "POST",
                  body: { body: `${fixture.code} PRIVATE ACCEPTANCE COMMENT`, parentId: null }
                }
              )
            )
          );
          assert.equal(comments.length, 5);
          for (const fixture of fixtures) {
            const [rows] = await connections
              .get(fixture.code)!
              .query<RowDataPacket[]>("SELECT body FROM crm_enquiry_comments WHERE enquiry_id=1");
            assert.ok(
              rows.some((row) => row.body === `${fixture.code} PRIVATE ACCEPTANCE COMMENT`)
            );
            assert.ok(
              rows.every((row) => !/CRMISO[1-5]/u.test(row.body) || row.body.includes(fixture.code))
            );
            const token = tokens.get(fixture.code)!;
            const start = await checked(
              fixture,
              "job start",
              "/crm/enquiries/1/jobs/start",
              token,
              { method: "POST", body: {} }
            );
            await checked(
              fixture,
              "job stop",
              `/crm/enquiries/1/jobs/${start.data.id}/stop`,
              token,
              { method: "POST", body: {} }
            );
          }
        }
      );
      await suite.test(
        "20 simultaneous readers keep tenant lists isolated across five waves",
        async () => {
          for (let wave = 0; wave < 5; wave++) {
            const reads = await Promise.all(
              fixtures.flatMap((fixture) =>
                Array.from({ length: 4 }, () =>
                  checked(
                    fixture,
                    "concurrent list",
                    "/crm/enquiries?scope=all&page=1&pageSize=20",
                    tokens.get(fixture.code)!
                  )
                )
              )
            );
            for (let index = 0; index < reads.length; index++) {
              const fixture = fixtures[Math.floor(index / 4)]!;
              const read = reads[index]!;
              assert.equal(read.data.total, 3000);
              assert.ok(read.data.items.every((row: any) => row.title.startsWith(fixture.code)));
              concurrentReadTimes.push(Math.round(read.ms));
            }
          }
          assert.equal(concurrentReadTimes.length, 100);
        }
      );
      await suite.test(
        "revoked sessions fail closed without revoking other tenant sessions",
        async () => {
          const token = await login(fixtures[0]!);
          assert.equal(
            (await request("/auth/logout", token, { method: "POST", body: {} })).status,
            200
          );
          assert.equal((await request("/crm/enquiries", token)).status, 401);
          await checked(
            fixtures[1]!,
            "other tenant session survives logout",
            "/crm/enquiries/1",
            tokens.get(fixtures[1]!.code)!
          );
        }
      );
      for (const fixture of fixtures) {
        const [[count]] = await connections
          .get(fixture.code)!
          .query<RowDataPacket[]>("SELECT COUNT(*) n FROM crm_enquiries");
        assert.equal(Number(count!.n), 3000);
        const [events] = await connections
          .get(fixture.code)!
          .query<RowDataPacket[]>("SELECT attempts,status FROM crm_enquiry_sync_events");
        assert.ok(events.every((row) => Number(row.attempts) === 0 && row.status === "pending"));
      }
      writeFileSync(
        `${output}/api-isolation-results.json`,
        JSON.stringify(
          {
            at: new Date().toISOString(),
            tenants: 5,
            recordsPerTenant: 3000,
            pairs: 20,
            concurrentReadTimes,
            results
          },
          null,
          2
        )
      );
    } finally {
      await Promise.all([...connections.values()].map((connection) => connection.end()));
    }
  }
);
