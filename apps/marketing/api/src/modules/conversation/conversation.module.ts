import { migrateConversation } from "./conversation.migration.js";
import { registerConversationRoutes } from "./conversation.routes.js";
import { seedConversation } from "./conversation.seed.js";

export const conversationModule = {
  key: "marketing.conversation",
  migrate: migrateConversation,
  seed: seedConversation,
  register: registerConversationRoutes
} as const;
