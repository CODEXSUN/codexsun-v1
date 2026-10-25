import { registerContentRoutes } from "./content.routes.js";

export const contentModule = {
  key: "marketing.content",
  capabilities: { events: false, worker: false, sync: false },
  register: registerContentRoutes
};
