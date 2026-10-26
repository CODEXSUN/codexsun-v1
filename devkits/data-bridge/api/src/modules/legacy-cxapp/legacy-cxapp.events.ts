import type { LegacyPhase, LegacyPrepared } from "./legacy-cxapp.types.js";

export function legacyPreparationCompleted(phase: LegacyPhase, rows: readonly LegacyPrepared[]) {
  const own = rows.filter((row) => row.phase === phase);
  return {
    type: "data-bridge.legacy-preparation.completed" as const,
    phase, total: own.length, blocked: own.filter((row) => row.issues.length > 0).length,
    executionAuthorized: false as const
  };
}
