import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import {
  DummyDriver,
  Kysely,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
  type DatabaseConnection
} from "kysely";
import type { PlatformDatabase } from "../../database/schema.js";

const sqlite = new DatabaseSync(":memory:");
sqlite.function("GREATEST", { varargs: true }, (...values) => Math.max(...values.map(Number)));
sqlite.exec(`CREATE TABLE queue_jobs (
  id INTEGER PRIMARY KEY, status TEXT, attempts INTEGER, result_json TEXT,
  completed_at TEXT, updated_at TEXT, started_at TEXT, available_at TEXT, error_message TEXT
)`);
const connection: DatabaseConnection = {
  async executeQuery(query) {
    const values = query.parameters.map((value) =>
      value instanceof Date ? value.toISOString() : (value as SQLInputValue)
    );
    const result = sqlite.prepare(query.sql).run(...values);
    return { rows: [], numAffectedRows: BigInt(result.changes) };
  },
  streamQuery() {
    throw new Error("Streaming is outside this fixture");
  }
};
class FixtureDriver extends DummyDriver {
  async acquireConnection() {
    return connection;
  }
}
const database = new Kysely<PlatformDatabase>({
  dialect: {
    createAdapter: () => new MysqlAdapter(),
    createQueryCompiler: () => new MysqlQueryCompiler(),
    createIntrospector: (db) => new MysqlIntrospector(db),
    createDriver: () => new FixtureDriver()
  }
});
mock.module(new URL("../../database/platform-database.ts", import.meta.url), {
  namedExports: { getPlatformDatabase: () => database }
});
const { QueueManagerRepository } = await import("./queue-manager.repository.js");
const repository = new QueueManagerRepository();
repository.find = async () => null;

test("late completion, failure, progress, hold and retry cannot change a newer attempt", async () => {
  const actions = [
    () => repository.markCompleted(1, { late: true }, 1),
    () => repository.markFailed(1, "late", { late: true }, 1),
    () => repository.updateResult(1, { late: true }, 1),
    () => repository.hold(1, "2099-01-01T00:00:00Z", "late", true, 1),
    () => repository.retryAfter(1, 5000, 1)
  ];
  for (const status of ["running", "failed", "pending", "completed"]) {
    for (const action of actions) {
      sqlite.exec("DELETE FROM queue_jobs");
      sqlite
        .prepare("INSERT INTO queue_jobs (id,status,attempts,result_json) VALUES (1,?,2,'{}')")
        .run(status);
      await action();
      const row = sqlite.prepare("SELECT status,attempts,result_json FROM queue_jobs").get();
      assert.deepEqual({ ...row }, { status, attempts: 2, result_json: "{}" });
    }
  }
});

test("completion accepts the current running attempt but cannot revive its expired lease", async () => {
  for (const status of ["running", "failed"]) {
    sqlite.exec("DELETE FROM queue_jobs");
    sqlite
      .prepare("INSERT INTO queue_jobs (id,status,attempts,result_json) VALUES (1,?,1,'{}')")
      .run(status);
    await repository.markCompleted(1, { done: true }, 1);
    const row = sqlite.prepare("SELECT status,result_json FROM queue_jobs").get();
    assert.equal(row?.status, status === "running" ? "completed" : "failed");
    assert.equal(row?.result_json, status === "running" ? '{"done":true}' : "{}");
  }
});

test.after(async () => {
  await database.destroy();
  sqlite.close();
});
