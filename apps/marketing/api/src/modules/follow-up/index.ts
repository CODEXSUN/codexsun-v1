export { followUpModule } from "./follow-up.module.js";
export { migrateFollowUp } from "./follow-up.migration.js";
export { seedFollowUp } from "./follow-up.seed.js";
export { FollowUpService, lookupFollowUp } from "./follow-up.service.js";
export { FollowUpRepository } from "./follow-up.repository.js";
export {
  registerFollowUpRoutes,
  followUpInputSchema,
  followUpRecordSchema,
  followUpActionTypeSchema,
  followUpStatusSchema
} from "./follow-up.routes.js";
export type {
  FollowUpInput,
  FollowUpRecord,
  FollowUpActivity,
  FollowUpActionType,
  FollowUpStatus
} from "./follow-up.types.js";
