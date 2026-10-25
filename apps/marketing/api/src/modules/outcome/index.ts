export { outcomeModule } from "./outcome.module.js";
export { migrateOutcome } from "./outcome.migration.js";
export { seedOutcome } from "./outcome.seed.js";
export { OutcomeService, lookupOutcome } from "./outcome.service.js";
export { OutcomeRepository } from "./outcome.repository.js";
export {
  registerOutcomeRoutes,
  outcomeInputSchema,
  outcomeRecordSchema,
  outcomeDispositionSchema
} from "./outcome.routes.js";
export type {
  OutcomeInput,
  OutcomeRecord,
  OutcomeActivity,
  OutcomeDisposition
} from "./outcome.types.js";
