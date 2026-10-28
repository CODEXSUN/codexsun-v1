import assert from "node:assert/strict";
import test from "node:test";
import {
  createReleaseRollbackPlan,
  fingerprintReleaseTarget,
  type ReleaseRollbackManifest,
  type ReleaseTargetSnapshot,
  type RollbackCatalogEntry,
} from "./release-rollback-plan.js";

const checksum = "a".repeat(64);
const rows = [
  {
    id: 1,
    scope: "module",
    batch: 1,
    name: "first",
    version: 1,
    checksum,
    status: "applied",
  },
  {
    id: 2,
    scope: "module",
    batch: 1,
    name: "second",
    version: 2,
    checksum,
    status: "applied",
  },
];
const snapshot: ReleaseTargetSnapshot = {
  target: "tenant-a",
  server: "server",
  port: 3306,
  database: "tenant_a",
  ledger: rows,
};
const steps = rows.map(({ scope, batch, name, version, checksum }) => ({
  target: snapshot.target,
  scope,
  batch,
  name,
  version,
  checksum,
}));
const catalog: RollbackCatalogEntry[] = steps.map((step) => ({
  ...step,
  safeDown: true,
  rollback: async () => {},
}));
const manifest: ReleaseRollbackManifest = {
  releaseId: "release-1",
  targets: [
    {
      target: snapshot.target,
      fingerprint: fingerprintReleaseTarget(snapshot),
    },
  ],
  steps,
};

test("plans reverse execution only after an exact target snapshot and trusted catalog match", () => {
  const plan = createReleaseRollbackPlan(manifest, [snapshot], catalog);
  assert.deepEqual(
    plan.reverse.map((entry) => entry.name),
    ["second", "first"],
  );
  assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.reverse));
});

test("rejects changed targets, missing catalogs and unapproved reversals", () => {
  assert.throws(
    () =>
      createReleaseRollbackPlan(
        manifest,
        [{ ...snapshot, database: "other" }],
        catalog,
      ),
    /snapshot changed/,
  );
  assert.throws(
    () => createReleaseRollbackPlan(manifest, [snapshot], catalog.slice(1)),
    /catalog is incomplete/,
  );
  assert.throws(
    () =>
      createReleaseRollbackPlan(
        manifest,
        [snapshot],
        catalog.map((entry) => ({ ...entry, safeDown: false })),
      ),
    /No verified safe reverse/,
  );
  assert.throws(
    () =>
      createReleaseRollbackPlan(
        { ...manifest, steps: [steps[0]!] },
        [snapshot],
        catalog,
      ),
    /omits a later applied step/,
  );
  assert.throws(
    () =>
      createReleaseRollbackPlan(
        { ...manifest, steps: [...steps].reverse() },
        [snapshot],
        catalog,
      ),
    /invalid forward order/,
  );
});

test("rejects interrupted ledgers and duplicate physical targets", () => {
  const failed = { ...snapshot, ledger: [{ ...rows[0]!, status: "failed" }] };
  const failedManifest = {
    ...manifest,
    targets: [
      { target: failed.target, fingerprint: fingerprintReleaseTarget(failed) },
    ],
  };
  assert.throws(
    () => createReleaseRollbackPlan(failedManifest, [failed], catalog),
    /requires reconciliation/,
  );
  const duplicate = { ...snapshot, target: "tenant-b" };
  const duplicateManifest = {
    ...manifest,
    targets: [
      ...manifest.targets,
      {
        target: duplicate.target,
        fingerprint: fingerprintReleaseTarget(duplicate),
      },
    ],
  };
  assert.throws(
    () =>
      createReleaseRollbackPlan(
        duplicateManifest,
        [snapshot, duplicate],
        catalog,
      ),
    /duplicate or empty physical target/,
  );
});
