import { registerFollowUpRoutes } from "./follow-up.routes.js";

export const followUpModule = {
  key: "marketing.follow-up",
  capabilities: { events: false, worker: false, sync: false },
  register: registerFollowUpRoutes
};
