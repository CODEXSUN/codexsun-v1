import { createHash } from "node:crypto";

export type ReleaseLedgerRow = {
  id: number;
  scope: string;
  batch: number;
  name: string;
  version: number;
  checksum: string;
  status: string;
};

export type ReleaseTargetSnapshot = {
  target: string;
  server: string;
  port: number;
  database: string;
  ledger: readonly ReleaseLedgerRow[];
};

export type ReleaseRollbackStep = {
  target: string;
  scope: string;
  batch: number;
  name: string;
  version: number;
  checksum: string;
};

export type ReleaseRollbackManifest = {
  releaseId: string;
  targets: readonly { target: string; fingerprint: string }[];
  steps: readonly ReleaseRollbackStep[];
};

export type RollbackCatalogEntry = ReleaseRollbackStep & {
  safeDown: boolean;
  rollback?: () => Promise<void>;
};

export type ReleaseRollbackPlan = Readonly<{
  releaseId: string;
  reverse: readonly Readonly<RollbackCatalogEntry>[];
}>;

export function fingerprintReleaseTarget(snapshot: ReleaseTargetSnapshot) {
  validateSnapshot(snapshot);
  const ledger = [...snapshot.ledger]
    .sort((a, b) => a.id - b.id)
    .map((row) => ({
      id: row.id,
      scope: row.scope,
      batch: row.batch,
      name: row.name,
      version: row.version,
      checksum: row.checksum,
      status: row.status,
    }));
  return createHash("sha256")
    .update(
      JSON.stringify({
        target: snapshot.target,
        server: snapshot.server,
        port: snapshot.port,
        database: snapshot.database,
        ledger,
      }),
    )
    .digest("hex");
}

export function createReleaseRollbackPlan(
  manifest: ReleaseRollbackManifest,
  snapshots: readonly ReleaseTargetSnapshot[],
  catalog: readonly RollbackCatalogEntry[],
): ReleaseRollbackPlan {
  if (
    !manifest.releaseId.trim() ||
    manifest.targets.length === 0 ||
    manifest.steps.length === 0
  ) {
    throw new Error(
      "Rollback requires a release identity, target snapshots and selected steps.",
    );
  }
  const expected = uniqueMap(
    manifest.targets,
    (entry) => entry.target,
    "manifest target",
  );
  const actual = uniqueMap(
    snapshots,
    (entry) => entry.target,
    "snapshot target",
  );
  if (expected.size !== actual.size)
    throw new Error("Rollback target set changed.");
  uniqueMap(
    snapshots,
    (entry) =>
      JSON.stringify([
        entry.server.trim().toLowerCase(),
        entry.port,
        entry.database.trim().toLowerCase(),
      ]),
    "physical target",
  );
  for (const [target, item] of expected) {
    const snapshot = actual.get(target);
    if (
      !snapshot ||
      !/^[a-f0-9]{64}$/u.test(item.fingerprint) ||
      fingerprintReleaseTarget(snapshot) !== item.fingerprint
    ) {
      throw new Error(`Rollback target snapshot changed: ${target}.`);
    }
  }

  const known = uniqueMap(catalog, stepKey, "catalog step");
  const selected = uniqueMap(manifest.steps, stepKey, "manifest step");
  for (const snapshot of snapshots) {
    for (const row of snapshot.ledger) {
      if (row.status === "running" || row.status === "failed") {
        throw new Error(
          `Rollback requires reconciliation of ${snapshot.target}:${row.scope}:${row.name}.`,
        );
      }
      if (row.status !== "applied") continue;
      const item = { ...row, target: snapshot.target };
      const entry = known.get(stepKey(item));
      if (
        !entry ||
        entry.version !== row.version ||
        entry.checksum !== row.checksum
      ) {
        throw new Error(
          `Rollback catalog is incomplete or changed for ${snapshot.target}:${row.scope}:${row.name}.`,
        );
      }
    }
  }

  const reverse: RollbackCatalogEntry[] = [];
  const lastInScope = new Map<string, number>();
  for (const step of manifest.steps) {
    const snapshot = actual.get(step.target);
    if (!snapshot)
      throw new Error(`Rollback step has an unknown target: ${step.target}.`);
    const row = snapshot.ledger.find(
      (item) => stepKey({ ...item, target: snapshot.target }) === stepKey(step),
    );
    const entry = known.get(stepKey(step));
    if (
      !row ||
      row.status !== "applied" ||
      row.version !== step.version ||
      row.checksum !== step.checksum ||
      !entry ||
      entry.version !== step.version ||
      entry.checksum !== step.checksum ||
      !entry.safeDown ||
      typeof entry.rollback !== "function"
    ) {
      throw new Error(
        `No verified safe reverse for ${step.target}:${step.scope}:${step.name}.`,
      );
    }
    const scopeKey = JSON.stringify([step.target, step.scope]);
    if ((lastInScope.get(scopeKey) ?? 0) >= row.id) {
      throw new Error(
        `Rollback manifest has an invalid forward order in ${step.target}:${step.scope}.`,
      );
    }
    lastInScope.set(scopeKey, row.id);
    if (
      snapshot.ledger.some(
        (later) =>
          later.scope === row.scope &&
          later.status === "applied" &&
          later.id > row.id &&
          !selected.has(stepKey({ ...later, target: snapshot.target })),
      )
    ) {
      throw new Error(
        `Rollback omits a later applied step in ${step.target}:${step.scope}.`,
      );
    }
    reverse.unshift(Object.freeze({ ...entry }));
  }
  for (const target of expected.keys()) {
    if (!manifest.steps.some((step) => step.target === target)) {
      throw new Error(
        `Rollback manifest contains an unselected target: ${target}.`,
      );
    }
  }
  return Object.freeze({
    releaseId: manifest.releaseId,
    reverse: Object.freeze(reverse),
  });
}

function validateSnapshot(snapshot: ReleaseTargetSnapshot) {
  if (
    !snapshot.target.trim() ||
    !snapshot.server.trim() ||
    !snapshot.database.trim() ||
    !Number.isInteger(snapshot.port) ||
    snapshot.port <= 0 ||
    snapshot.port > 65535
  ) {
    throw new Error("Rollback snapshot has an invalid target identity.");
  }
  const ids = new Set<number>();
  const names = new Set<string>();
  for (const row of snapshot.ledger) {
    const key = `${row.scope}\0${row.name}`;
    if (
      !Number.isSafeInteger(row.id) ||
      row.id <= 0 ||
      ids.has(row.id) ||
      names.has(key) ||
      !row.scope.trim() ||
      !row.name.trim() ||
      !Number.isInteger(row.batch) ||
      row.batch <= 0 ||
      !Number.isInteger(row.version) ||
      row.version <= 0 ||
      !/^[a-f0-9]{64}$/u.test(row.checksum) ||
      !["applied", "running", "failed", "rolled_back"].includes(row.status)
    ) {
      throw new Error(
        `Rollback snapshot contains an invalid ledger row for ${snapshot.target}.`,
      );
    }
    ids.add(row.id);
    names.add(key);
  }
}

function stepKey(
  step: Pick<ReleaseRollbackStep, "target" | "scope" | "batch" | "name">,
) {
  return JSON.stringify([step.target, step.scope, step.batch, step.name]);
}

function uniqueMap<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  label: string,
) {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = keyOf(item);
    if (!key.trim() || map.has(key))
      throw new Error(`Rollback contains a duplicate or empty ${label}.`);
    map.set(key, item);
  }
  return map;
}
