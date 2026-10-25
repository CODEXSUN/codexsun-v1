import { registerConversionRoutes } from "./conversion.routes.js";

export const conversionModule = {
  key: "marketing.conversion",
  capabilities: { events: false, worker: false, sync: false },
  register: registerConversionRoutes
};
