export { consentModule } from "./consent.module.js";
export { migrateConsent } from "./consent.migration.js";
export { seedConsent } from "./consent.seed.js";
export {
  ConsentService,
  consentInputSchema,
  eligibilityInputSchema,
  contactRestrictionSchema,
  contactRestrictionChannelSchema
} from "./consent.service.js";
export { registerConsentRoutes, contactRestrictionRecordSchema } from "./consent.routes.js";
export type {
  ConsentDependencies,
  ConsentInput,
  ConsentRecord,
  EligibilityInput,
  EligibilityResult,
  ContactRestrictionChannel,
  ContactRestrictionInput,
  ContactRestrictionRecord,
  PolicyResult
} from "./consent.types.js";
