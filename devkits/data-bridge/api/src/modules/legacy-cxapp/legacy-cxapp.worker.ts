import type { LegacyPreparationRepository } from "./legacy-cxapp.repository.js";
import { LegacyPreparationService } from "./legacy-cxapp.service.js";
import { hydrateLegacyPreparation } from "./legacy-cxapp.sync.js";
import type { LegacyPhase } from "./legacy-cxapp.types.js";

// Explicit local preparation only. This worker is never registered as a business-import job.
export async function processLegacyPreparationPhase(
  repository: LegacyPreparationRepository,
  phase: LegacyPhase
) {
  await repository.stage.beginTransaction();
  try {
    await hydrateLegacyPreparation(repository);
    const event = await new LegacyPreparationService(repository).prepare(phase);
    await repository.stage.commit();
    return event;
  } catch (error) {
    await repository.stage.rollback();
    repository.rows.splice(0);
    repository.mappings.splice(0);
    throw error;
  }
}
