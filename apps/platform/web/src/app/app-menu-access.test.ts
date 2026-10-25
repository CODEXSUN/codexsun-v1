import assert from "node:assert/strict";
import test from "node:test";
import { appMenuFor, appMenuItemsFor, enabledAppIds } from "./app-registry";

test("legacy Accounts entitlement remains visible in the tenant desk", () => {
  assert.equal(enabledAppIds(["accounts.accounting"]).includes("accounts"), true);
});

test("LogicX Schemes is shown only when Billing is enabled", () => {
  const select = () => {};
  const menu = (billingEnabled: boolean) =>
    appMenuItemsFor(
      "logicx-erp",
      "logicx-erp.overview",
      select,
      undefined,
      undefined,
      billingEnabled
    );
  const launcherMenu = (billingEnabled: boolean) =>
    appMenuFor("logicx-erp", "logicx-erp.overview", select, undefined, undefined, billingEnabled);

  assert.deepEqual(
    menu(false).map((item) => item.title),
    ["Overview"]
  );
  assert.deepEqual(
    menu(true).map((item) => item.title),
    ["Overview", "Schemes"]
  );
  assert.deepEqual(
    launcherMenu(false).items?.map((item) => item.title),
    ["Overview"]
  );
  assert.deepEqual(
    launcherMenu(true).items?.map((item) => item.title),
    ["Overview", "Schemes"]
  );
});

test("Frappe navigation groups import, export, and connection pages", () => {
  const selected: string[] = [];
  const menu = appMenuItemsFor("frappe", "frappe.activities", (page) => selected.push(page));

  assert.deepEqual(
    menu.map((item) => item.title),
    ["Overview", "Import", "Export", "Frappe"]
  );
  assert.equal(menu[1]?.isActive, true);
  assert.deepEqual(
    menu[1]?.items?.map((item) => item.title),
    ["Import contacts", "Import enquiries", "Import activities", "Import call logs"]
  );
  assert.deepEqual(
    menu[2]?.items?.map((item) => item.title),
    ["Export contacts", "Export enquiries", "Export activities", "Export call logs"]
  );
  assert.deepEqual(
    menu[3]?.items?.map((item) => item.title),
    [
      "Live sync",
      "Live sync queue",
      "Server availability",
      "Frappe connection",
      "Frappe users",
      "User mapping",
      "Identity audit"
    ]
  );
  assert.equal(
    menu[3]?.items?.filter((item) => item.title.toLowerCase().includes("queue")).length,
    1
  );
  menu[2]?.items?.[1]?.onSelect?.();
  menu[3]?.items?.[1]?.onSelect?.();
  menu[3]?.items?.[3]?.onSelect?.();
  assert.deepEqual(selected, [
    "frappe.export.enquiries",
    "frappe.live-sync-queue",
    "frappe.connection"
  ]);
});

test("Application access controls follow role permissions and navigate to their own page", () => {
  const selected: string[] = [];
  const menu = appMenuItemsFor("application", "application.access.controls", (page) =>
    selected.push(page)
  );
  const access = menu.find((item) => item.title === "Access Control");
  const entries = access?.items ?? [];
  const index = entries.findIndex((item) => item.title === "Role Permissions");
  assert.ok(index >= 0);
  const controls = entries[index + 1];
  assert.equal(controls?.title, "Access Control");
  assert.equal(controls?.isActive, true);
  controls?.onSelect?.();
  assert.deepEqual(selected, ["application.access.controls"]);
});
