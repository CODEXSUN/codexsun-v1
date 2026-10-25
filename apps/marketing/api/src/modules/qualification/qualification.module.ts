import { registerQualificationRoutes } from "./qualification.routes.js";

export const qualificationModule = {
  key: "marketing.qualification",
  capabilities: { events: false, worker: false, sync: false },
  register: registerQualificationRoutes
};
