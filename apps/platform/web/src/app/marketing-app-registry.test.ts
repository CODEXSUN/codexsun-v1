import assert from "node:assert/strict";
import test from "node:test";
import {
  appRootUrl,
  appWorkspaceItems,
  enabledAppIds,
  platformAppRegistry,
  appMenuItemsFor
} from "./app-registry";
import { appRegistrySchema } from "../modules/app-registry/app-registry.schema";
import {
  marketingNavigationItems,
  marketingPageFromPath
} from "../modules/marketing/marketing-navigation";

test("Marketing loader entry is tenant activated and reaches every implemented workspace", () => {
  const app = platformAppRegistry.find((item) => item.id === "marketing");
  assert(app);
  assert.equal(app.alwaysEnabled, false);
  assert.equal(enabledAppIds(["platform.application"]).includes("marketing"), false);
  const enabled = enabledAppIds(["platform.application", "marketing"]);
  assert.equal(enabled.includes("marketing"), true);
  assert.equal(appRootUrl("marketing"), "/app/marketing/brands");
  assert.equal(
    appWorkspaceItems(enabled, "marketing").find((item) => item.appId === "marketing")?.active,
    true
  );
  assert.equal(
    appRegistrySchema.safeParse({
      alwaysEnabled: false,
      appId: app.id,
      defaultLanding: false,
      description: app.description,
      label: app.label,
      moduleKey: app.moduleKey,
      stack: app.stack
    }).success,
    true
  );
  const selected: string[] = [];
  const menu = appMenuItemsFor("marketing", "marketing.brands", (page) => selected.push(page));
  for (const item of menu) item.onSelect?.();
  assert.deepEqual(selected, [
    "marketing.brands",
    "marketing.campaigns",
    "marketing.email-campaigns",
    "marketing.conversations",
    "marketing.captures",
    "marketing.submissions",
    "marketing.leads",
    "marketing.qualifications",
    "marketing.conversions",
    "marketing.outcomes",
    "marketing.followups",
    "marketing.connections",
    "marketing.consents",
    "marketing.contents"
  ]);
});

test("Marketing navigation defines all 14 workspaces including email-campaigns, conversations and content", () => {
  assert.equal(marketingNavigationItems.length, 14);
  assert.equal(marketingPageFromPath("/app/marketing/contents"), "marketing.contents");
  assert.equal(marketingPageFromPath("/app/marketing/email-campaigns"), "marketing.email-campaigns");
  assert.equal(marketingPageFromPath("/app/marketing/conversations"), "marketing.conversations");
  assert.deepEqual(
    marketingNavigationItems.map((item) => item.page),
    [
      "marketing.brands",
      "marketing.campaigns",
      "marketing.email-campaigns",
      "marketing.conversations",
      "marketing.contents",
      "marketing.captures",
      "marketing.submissions",
      "marketing.leads",
      "marketing.qualifications",
      "marketing.conversions",
      "marketing.outcomes",
      "marketing.followups",
      "marketing.connections",
      "marketing.consents"
    ]
  );
});
