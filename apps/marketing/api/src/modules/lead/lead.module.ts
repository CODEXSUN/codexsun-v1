import { registerLeadRoutes } from "./lead.routes.js";

export const leadModule = {
  key: "marketing.lead",
  capabilities: { events: false, worker: false, sync: false },
  register: registerLeadRoutes
};
