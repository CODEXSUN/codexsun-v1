import { LegacyCorePreparation } from "./legacy-cxapp.core.js";
import { LegacyMasterPreparation } from "./legacy-cxapp.masters.js";
import { LegacyBillingPreparation } from "./legacy-cxapp.billing.js";
import { legacyPreparationCompleted } from "./legacy-cxapp.events.js";
import type { LegacyPreparationRepository } from "./legacy-cxapp.repository.js";
import type { LegacyPhase } from "./legacy-cxapp.types.js";

export class LegacyPreparationService {
  constructor(private readonly repository: LegacyPreparationRepository) {}

  async prepare(phase: LegacyPhase) {
    const required = phase === "billing" ? ["core", "masters"] : phase === "masters" ? ["core"] : [];
    for (const prior of required) {
      if (!this.repository.mappings.some((mapping) => mapping.phase === prior)) {
        throw new Error(`Prepare ${prior} before ${phase}.`);
      }
    }
    const preparers = {
      core: LegacyCorePreparation,
      masters: LegacyMasterPreparation,
      billing: LegacyBillingPreparation
    };
    await new preparers[phase](this.repository).run();
    return legacyPreparationCompleted(phase,this.repository.rows);
  }
}
