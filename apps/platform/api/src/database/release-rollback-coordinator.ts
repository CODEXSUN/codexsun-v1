import { withCoordinatedMigration } from "./migration-coordination.js";
import {
  createReleaseRollbackPlan,
  type ReleaseRollbackManifest,
  type ReleaseRollbackStep,
  type ReleaseTargetSnapshot,
  type RollbackCatalogEntry,
} from "./release-rollback-plan.js";

export class ReleaseRollbackError extends Error {
  constructor(
    readonly releaseId: string,
    readonly completed: readonly ReleaseRollbackStep[],
    readonly failed: ReleaseRollbackStep,
    cause: unknown,
  ) {
    super(
      `Rollback stopped after ${completed.length} completed step(s); ${failed.target}:${failed.scope}:${failed.name} failed.`,
      { cause },
    );
  }
}

/** Catalog and backup callbacks must be trusted, module-owned and ledger-recorded. */
export async function executeReleaseRollback(
  manifest: ReleaseRollbackManifest,
  readSnapshots: () => Promise<readonly ReleaseTargetSnapshot[]>,
  catalog: readonly RollbackCatalogEntry[],
  verifyBackups: () => Promise<void>,
) {
  return withCoordinatedMigration(async () => {
    createReleaseRollbackPlan(manifest, await readSnapshots(), catalog);
    await verifyBackups();
    const plan = createReleaseRollbackPlan(
      manifest,
      await readSnapshots(),
      catalog,
    );
    const completed: ReleaseRollbackStep[] = [];
    for (const entry of plan.reverse) {
      const step: ReleaseRollbackStep = {
        target: entry.target,
        scope: entry.scope,
        batch: entry.batch,
        name: entry.name,
        version: entry.version,
        checksum: entry.checksum,
      };
      try {
        await entry.rollback!();
        completed.push(step);
      } catch (error) {
        throw new ReleaseRollbackError(
          plan.releaseId,
          Object.freeze([...completed]),
          step,
          error,
        );
      }
    }
    return { releaseId: plan.releaseId, completed };
  });
}
