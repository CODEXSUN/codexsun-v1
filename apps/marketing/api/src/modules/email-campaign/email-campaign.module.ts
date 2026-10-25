import { migrateEmailCampaign } from "./email-campaign.migration.js";
import { registerEmailCampaignRoutes } from "./email-campaign.routes.js";
import { seedEmailCampaign } from "./email-campaign.seed.js";

export const emailCampaignModule = {
  key: "marketing.email-campaign",
  migrate: migrateEmailCampaign,
  seed: seedEmailCampaign,
  register: registerEmailCampaignRoutes
} as const;
