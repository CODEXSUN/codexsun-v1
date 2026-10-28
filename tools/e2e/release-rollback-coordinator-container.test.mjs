import assert from "node:assert/strict";
import test from "node:test";
import { createConnection } from "mysql2/promise";
import {
  executeReleaseRollback,
  ReleaseRollbackError,
} from "../../apps/platform/api/src/database/release-rollback-coordinator.ts";
import { fingerprintReleaseTarget } from "../../apps/platform/api/src/database/release-rollback-plan.ts";

if (
  process.env.CODEXSUN_DISPOSABLE_MIGRATION_FIXTURE !== "1" ||
  process.env.DB_MASTER_NAME !== "codexsun_rollback_coord"
)
  throw new Error("Disposable fixture required.");
const config = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};
const checksum = "a".repeat(64);

test("all-target preflight stops before mutation and reports a partial failure", async () => {
  const databases = ["codexsun_rollback_a", "codexsun_rollback_b"];
  const connections = await Promise.all(
    databases.map((database) => createConnection({ ...config, database })),
  );
  const snapshots = async () =>
    Promise.all(
      connections.map(async (connection, index) => {
        const [identity] = await connection.query(
          "SELECT @@hostname AS server, @@port AS port, DATABASE() AS database",
        );
        const [ledger] = await connection.query(
          "SELECT id,scope,batch,name,version,checksum,status FROM migration_schema ORDER BY id",
        );
        return { target: `tenant-${index}`, ...identity[0], ledger };
      }),
    );
  try {
    for (const connection of connections) {
      await connection.query(
        "CREATE TABLE migration_schema (id INT PRIMARY KEY, scope VARCHAR(80), batch INT, name VARCHAR(100), version INT, checksum CHAR(64), status VARCHAR(24))",
      );
      await connection.query(
        "INSERT INTO migration_schema VALUES (1, 'fixture', 1, 'step', 1, ?, 'applied')",
        [checksum],
      );
    }
    const initial = await snapshots();
    const steps = initial.map((target) => ({
      target: target.target,
      scope: "fixture",
      batch: 1,
      name: "step",
      version: 1,
      checksum,
    }));
    const manifest = {
      releaseId: "test",
      targets: initial.map((target) => ({
        target: target.target,
        fingerprint: fingerprintReleaseTarget(target),
      })),
      steps,
    };
    const calls = [];
    const catalog = steps.map((step, index) => ({
      ...step,
      safeDown: true,
      rollback: async () => {
        calls.push(step.target);
        await connections[index].query(
          "UPDATE migration_schema SET status=? WHERE id=1",
          [index === 0 ? "failed" : "rolled_back"],
        );
        if (index === 0) throw new Error("fixture failure");
      },
    }));
    let backups = 0;
    await assert.rejects(
      executeReleaseRollback(
        manifest,
        snapshots,
        catalog.slice(0, 1),
        async () => {
          backups += 1;
        },
      ),
      /catalog is incomplete/,
    );
    assert.deepEqual(calls, []);
    assert.equal(backups, 0);
    await assert.rejects(
      executeReleaseRollback(manifest, snapshots, catalog, async () => {
        throw new Error("backup unavailable");
      }),
      /backup unavailable/,
    );
    assert.deepEqual(calls, []);
    await assert.rejects(
      executeReleaseRollback(manifest, snapshots, catalog, async () => {
        backups += 1;
      }),
      (error) => {
        assert.ok(error instanceof ReleaseRollbackError);
        assert.deepEqual(
          error.completed.map((step) => step.target),
          ["tenant-1"],
        );
        assert.equal(error.failed.target, "tenant-0");
        return true;
      },
    );
    assert.equal(backups, 1);
    assert.deepEqual(calls, ["tenant-1", "tenant-0"]);
    const final = await snapshots();
    assert.deepEqual(
      final.map((target) => target.ledger[0].status),
      ["failed", "rolled_back"],
    );
  } finally {
    await Promise.all(connections.map((connection) => connection.end()));
  }
});
