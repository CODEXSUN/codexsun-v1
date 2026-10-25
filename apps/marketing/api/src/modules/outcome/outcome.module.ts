import { registerOutcomeRoutes } from "./outcome.routes.js";

export const outcomeModule = {
  key: "marketing.outcome",
  capabilities: { events: false, worker: false, sync: false },
  register: registerOutcomeRoutes
};
