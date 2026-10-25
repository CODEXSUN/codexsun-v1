import assert from "node:assert/strict";
import test from "node:test";
import { platformAppSaveSchema, platformAppSchema } from "../apps/platform/api/src/modules/app-registry/app-registry.schemas.js";
import { platformAppRegistry, resolveEnabledApps, resolveLandingApp } from "../apps/platform/api/src/modules/app-registry/app-registry.service.js";

const retired = {
  alwaysEnabled: false,
  appId: "project-manager",
  defaultLanding: false,
  description: "Retired application row retained for data compatibility.",
  id: 1,
  label: "Project Manager",
  moduleKey: "project-manager",
  stack: "project-manager",
  uuid: "retired-row"
};

test("retired app is absent from the active catalog and cannot become a landing app", () => {
  assert.equal(platformAppRegistry.some((app) => app.appId === retired.appId), false);
  assert.equal(resolveEnabledApps([retired.moduleKey]).some((app) => app.appId === retired.appId), false);
  assert.equal(resolveLandingApp(retired.appId, [retired.moduleKey]), "application");
});

test("new app writes reject retired identifiers while existing rows remain readable", () => {
  const { id: _id, uuid: _uuid, ...input } = retired;
  assert.equal(platformAppSaveSchema.safeParse(input).success, false);
  assert.equal(platformAppSchema.safeParse(retired).success, true);
});
