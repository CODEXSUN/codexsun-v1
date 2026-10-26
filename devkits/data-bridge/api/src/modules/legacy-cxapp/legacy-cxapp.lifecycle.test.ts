import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { Connection } from "mysql2/promise";
import { LegacyPreparationRepository } from "./legacy-cxapp.repository.js";
import { LegacyPreparationService } from "./legacy-cxapp.service.js";
import { hydrateLegacyPreparation } from "./legacy-cxapp.sync.js";
import { processLegacyPreparationPhase } from "./legacy-cxapp.worker.js";
import { legacyPreparationModule } from "./legacy-cxapp.module.js";
import type { CommonTableImportHost } from "../import-review/index.js";

function repository(stage: object) {
  const forbidden = {
    query: () => {
      throw new Error("Unexpected source or target access");
    }
  };
  return new LegacyPreparationRepository(
    forbidden as unknown as Connection,
    stage as Connection,
    forbidden as unknown as Connection
  );
}

test("preparation phase dependencies fail before source or target access", async () => {
  const service = new LegacyPreparationService(repository({}));
  await assert.rejects(service.prepare("masters"), /Prepare core/);
  await assert.rejects(service.prepare("billing"), /Prepare core/);
});

test("hydration replaces prior snapshots and rejects authorized rows without changing memory", async () => {
  let authorized = 0;
  const row = {
    phase: "core",
    source_table: "source",
    source_key: "1",
    target_table: "target",
    source_json: '{"name":"Original"}',
    prepared_json: '{"name":"Proposed"}',
    issues_json: '["held"]',
    stage_id: null,
    existing_target_id: null
  };
  const repo = repository({
    query: async (statement: string) => [
      statement.includes("prepared_rows") ? [{ ...row, execution_authorized: authorized }] : []
    ]
  });
  await hydrateLegacyPreparation(repo);
  await hydrateLegacyPreparation(repo);
  assert.equal(repo.rows.length, 1);
  assert.deepEqual(repo.rows[0]?.issues, ["held"]);
  const before = structuredClone(repo.rows);
  authorized = 1;
  await assert.rejects(hydrateLegacyPreparation(repo), /execution-authorized/);
  assert.deepEqual(repo.rows, before);
});

test("worker rolls back a failed phase and clears uncommitted in-memory state", async () => {
  const calls: string[] = [];
  const repo = repository({
    beginTransaction: async () => calls.push("begin"),
    commit: async () => calls.push("commit"),
    rollback: async () => calls.push("rollback"),
    query: async () => [[]]
  });
  await assert.rejects(processLegacyPreparationPhase(repo, "billing"), /Prepare core/);
  assert.deepEqual(calls, ["begin", "rollback"]);
  assert.deepEqual(repo.rows, []);
});

test("capability route requires host authorization and exposes no customer records or import endpoint", async () => {
  const app = Fastify();
  let allowed = false;
  legacyPreparationModule.register(app, {
    authorize: async () => {
      if (!allowed) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
      return "operator";
    }
  } as unknown as CommonTableImportHost);
  try {
    assert.equal((await app.inject({ url: "/legacy-preparation/capabilities" })).statusCode, 403);
    allowed = true;
    const response = await app.inject({ url: "/legacy-preparation/capabilities" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      phases: ["core", "masters", "billing"],
      preparation: "local-only",
      executionAuthorized: false
    });
    assert.equal(
      (await app.inject({ method: "POST", url: "/legacy-preparation/capabilities" })).statusCode,
      404
    );
  } finally {
    await app.close();
  }
});
