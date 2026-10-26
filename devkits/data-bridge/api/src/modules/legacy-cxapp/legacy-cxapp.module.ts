import { registerLegacyPreparationRoutes } from "./legacy-cxapp.routes.js";

export const legacyPreparationModule = {
  key: "data-bridge.legacy-preparation",
  register: registerLegacyPreparationRoutes
} as const;
