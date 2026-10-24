import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const requestedApp = process.argv[2]?.trim();

const moduleRoots = [
  { app: "marketing-api", path: join(process.cwd(), "apps", "marketing", "api", "src", "modules") },
  { app: "tconnect-api", path: join(process.cwd(), "apps", "tconnect", "api", "src", "modules") },
  { app: "qcafe-api", path: join(process.cwd(), "apps", "qcafe", "api", "src", "modules") },
  { app: "codexsun-api", path: join(process.cwd(), "apps", "codexsun", "api", "src", "modules") },
  { app: "hrms-api", path: join(process.cwd(), "apps", "hrms", "api", "src", "modules") },
  { app: "docs-api", path: join(process.cwd(), "apps", "docs", "api", "src", "modules") },
  { app: "himsx-api", path: join(process.cwd(), "apps", "himsx", "api", "src", "modules") },
  { app: "sites-api", path: join(process.cwd(), "apps", "sites", "api", "src", "modules") },

  {
    app: "auditor-api",
    path: join(process.cwd(), "apps", "auditor", "api", "src", "modules")
  },
  {
    app: "ecommerce-api",
    path: join(process.cwd(), "apps", "ecommerce", "api", "src", "modules")
  },
  {
    app: "logicx-erp-api",
    path: join(process.cwd(), "apps", "logicx-erp", "api", "src", "modules")
  },
  {
    app: "mail-api",
    path: join(process.cwd(), "apps", "mail", "api", "src", "modules")
  },
  {
    app: "billing-api",
    path: join(process.cwd(), "apps", "billing", "api", "src", "modules")
  },
  {
    app: "core-api",
    path: join(process.cwd(), "apps", "core", "api", "src", "modules")
  },
  {
    app: "crm-api",
    path: join(process.cwd(), "apps", "crm", "api", "src", "modules")
  },
  {
    app: "frappe-api",
    path: join(process.cwd(), "apps", "frappe", "api", "src", "modules")
  },
  {
    app: "zetro-api",
    path: join(process.cwd(), "apps", "zetro", "api", "src", "modules")
  },
  {
    app: "platform-api",
    path: join(process.cwd(), "apps", "platform", "api", "src", "modules")
  },
  {
    app: "project-manager-api",
    path: join(process.cwd(), "devkits", "project-manager", "api", "src", "modules")
  },
  {
    app: "data-migration-api",
    path: join(process.cwd(), "devkits", "data-migration", "api", "src", "modules")
  },
  {
    app: "data-bridge-api",
    path: join(process.cwd(), "devkits", "data-bridge", "api", "src", "modules")
  },
  {
    app: "zuno-api",
    path: join(process.cwd(), "devkits", "zuno", "api", "src", "modules")
  },
  {
    app: "codeit-api",
    path: join(process.cwd(), "devkits", "codeit", "api", "src", "modules")
  }
];

const requiredBackendRoles = [
  "module",
  "service",
  "repository",
  "routes",
  "events",
  "migration",
  "worker",
  "seed",
  "sync",
  "types"
];
const reducedPlatformBackendModules = new Set([
  "tenant-user",
  "tenant-role",
  "tenant-permission",
  "tenant-user-role",
  "tenant-role-permission"
]);
const reducedBackendRoles = [
  "module",
  "service",
  "repository",
  "routes",
  "migration",
  "seed",
  "types"
];
const shellOnlyBackendModules = new Set();
const shellOnlyBackendRoles = ["module", "routes", "types"];
const crmContact360Leaves = [
  "contact-profiles",
  "contact-people",
  "contact-communication",
  "contact-preferences",
  "contact-employments",
  "contact-roles",
  "contact-relationships",
  "contact-classifications",
  "contact-tags",
  "contact-person-tags",
  "contact-notes",
  "contact-lifecycle",
  "contact-documents"
];
const capabilityBackendRoles = new Map([
  ...[
    "association",
    "company",
    "community",
    "inquiry",
    "member",
    "product",
    "buyer",
    "requirement",
    "conversation",
    "message",
    "quotation",
    "credential"
  ].map((key) => [`tconnect-api/${key}`, reducedBackendRoles]),
  ["qcafe-api/menu", reducedBackendRoles],
  ["qcafe-api/pos", reducedBackendRoles],
  ["qcafe-api/order", reducedBackendRoles],
  ["qcafe-api/waiter", reducedBackendRoles],
  ["qcafe-api/table", reducedBackendRoles],
  ["qcafe-api/special", reducedBackendRoles],
  ["qcafe-api/settings", reducedBackendRoles],
  ["hrms-api/attendance", reducedBackendRoles],
  ["hrms-api/department", reducedBackendRoles],
  ["hrms-api/designation", reducedBackendRoles],
  ["hrms-api/employee", reducedBackendRoles],
  ["docs-api/knowledge", reducedBackendRoles],
  ["sites-api/site", reducedBackendRoles],
  ["frappe-api/crm-duty-sync", ["module", "worker", "types"]],
  ["codexsun-api/realtime", ["module", "service", "types"]],
  ["codexsun-api/requirements", reducedBackendRoles],
  ["codexsun-api/devices", reducedBackendRoles],
  ["hrms-api/overview", ["module", "service", "routes", "seed", "types"]],
  ["docs-api/overview", ["module", "service", "routes", "seed", "types"]],
  ["himsx-api/overview", ["module", "service", "routes", "seed", "types"]],
  ["sites-api/overview", ["module", "service", "routes", "seed", "types"]],
  ["platform-api/qcafe", ["module"]],

  ["auditor-api/client", ["module", "service", "repository", "routes", "migration", "types"]],
  ["ecommerce-api/catalog-data-source", ["service", "repository", "routes", "migration", "types"]],
  ["ecommerce-api/catalog-matching", [...reducedBackendRoles, "worker"]],
  ["ecommerce-api/ecommerce-composition", ["module", "migration", "seed"]],
  ["ecommerce-api/featured-card", reducedBackendRoles],
  ["ecommerce-api/product-image", reducedBackendRoles],
  ["ecommerce-api/product-information", reducedBackendRoles],
  ["ecommerce-api/product-variant", reducedBackendRoles],
  ["ecommerce-api/promotion-card", reducedBackendRoles],
  ["ecommerce-api/season-strip", reducedBackendRoles.filter((role) => role !== "seed")],
  ["ecommerce-api/storefront", ["service", "repository", "routes", "types"]],
  ["ecommerce-api/storefront-announcement", reducedBackendRoles],
  ["ecommerce-api/storefront-profile", reducedBackendRoles],
  ["ecommerce-api/storefront-organisation", reducedBackendRoles],
  ["ecommerce-api/storefront-slider", reducedBackendRoles],
  ["ecommerce-api/overview", ["module", "service", "routes", "seed", "types"]],
  ["logicx-erp-api/overview", ["module", "service", "routes", "seed", "types"]],
  ["logicx-erp-api/scheme", reducedBackendRoles],
  ["project-manager-api/platform-registry", reducedBackendRoles],
  [
    "data-migration-api/migration",
    ["module", "service", "repository", "routes", "migration", "types", "secrets"]
  ],
  // Data Bridge catalogs orchestrate migration sessions rather than own tenant business CRUD.
  ["data-bridge-api/data-bridge", ["module", "migration"]],
  ["data-bridge-api/database-connection", ["module", "routes", "service", "lock"]],
  ["data-bridge-api/common-tables", ["module", "routes", "service", "policy"]],
  ["data-bridge-api/master-tables", ["module", "routes", "service", "policy"]],
  ["data-bridge-api/billing-tables", ["module", "routes", "service", "policy"]],
  ["data-bridge-api/import-review", ["module", "service", "repository", "routes", "types"]],
  ["data-bridge-api/transfer-session", ["module", "service", "repository", "routes", "types"]],
  [
    "data-bridge-api/business-import",
    ["module", "migration", "repository", "routes", "service", "types", "worker"]
  ],
  ["data-bridge-api/report", ["module", "service", "repository", "routes", "types"]],
  ["zuno-api/diagnostics", ["module", "service", "repository", "routes", "types"]],
  ["zuno-api/cases", ["module", "service", "repository", "routes", "migration", "types"]],
  ["zuno-api/watch", ["module", "service", "repository", "routes", "types"]],
  ["zuno-api/conversations", ["module", "service", "repository", "routes", "migration", "types"]],
  [
    "project-manager-api/ideas",
    ["module", "service", "repository", "routes", "migration", "types"]
  ],
  ["billing-api/opening-balance", reducedBackendRoles],
  ["crm-api/enquiry", reducedBackendRoles],
  ["crm-api/lead", reducedBackendRoles],
  ["crm-api/contact-restriction", reducedBackendRoles],
  ["mail-api/suppression", reducedBackendRoles],
  ...["brand", "campaign", "capture", "connection", "consent"].map((name) => [
    `marketing-api/${name}`,
    reducedBackendRoles
  ]),
  ["crm-api/task", reducedBackendRoles],
  ["crm-api/scheduler", reducedBackendRoles],
  ["crm-api/sop", reducedBackendRoles],
  ["crm-api/sop-item", ["module", "service", "repository", "routes", "migration", "types"]],
  ["crm-api/duty-assignment", ["module", "service", "repository", "routes", "migration", "types"]],
  ["crm-api/duty-report", ["module", "service", "repository", "routes", "migration", "types"]],
  ["crm-api/frappe-sync", ["repository", "migration", "types"]],
  ["crm-api/activities", ["module", "service", "repository", "routes", "types"]],
  ["crm-api/closure", ["module", "routes", "migration", "seed", "types"]],
  ["crm-api/work-report", ["module", "service", "repository", "routes", "migration", "types"]],
  ["crm-api/enquiry-whatsapp", ["module", "service", "repository", "routes", "migration", "types"]],
  ["crm-api/enquiry-location", ["module", "service", "repository", "routes", "migration", "types"]],
  ["crm-api/call-log", ["module", "service", "routes", "seed", "types"]],
  ["crm-api/list-in", reducedBackendRoles],
  ["crm-api/status", reducedBackendRoles],
  ["crm-api/priority", reducedBackendRoles],
  ["crm-api/contact", ["module", "service", "routes", "types"]],
  ...crmContact360Leaves.map((name) => [`crm-api/${name}`, reducedBackendRoles]),
  [
    "frappe-api/connection",
    ["module", "service", "repository", "routes", "migration", "types", "secrets", "seed"]
  ],
  ["frappe-api/user-sync", ["module", "service", "routes", "types"]],
  ["frappe-api/enquiry-sync", ["module", "service", "routes", "types"]],
  ["frappe-api/call-log-sync", ["module", "service", "routes", "types"]],
  ["frappe-api/contact-import", ["module", "service", "routes", "types"]],
  ["frappe-api/activity-import", ["module", "service", "routes", "types"]],
  ["frappe-api/export", ["module", "service", "routes", "worker", "types"]],
  ["frappe-api/live-sync", ["module", "service", "routes", "types"]],
  ["frappe-api/user-mapping", ["module", "service", "repository", "routes", "migration", "types"]],
  ["zetro-api/chat", ["module", "service", "repository", "routes", "migration", "seed", "types"]],
  [
    "zetro-api/provider",
    ["module", "service", "repository", "routes", "migration", "seed", "types", "secrets"]
  ],
  ["codeit-api/artifact", ["module", "service", "repository", "routes", "types"]],
  ["codeit-api/conversation", ["module", "service", "repository", "routes", "types"]],
  ["codeit-api/orchestration", ["module", "service", "repository", "routes", "types"]],
  ["codeit-api/personalization", ["module", "service", "repository", "routes", "types"]],
  ["codeit-api/plugin", ["module", "service", "repository", "routes", "types"]],
  ["codeit-api/project", ["module", "service", "repository", "routes", "types"]],
  ["codeit-api/provider", ["module", "service", "routes", "types"]],
  ["codeit-api/run", ["module", "service", "repository", "routes", "types"]],
  ["codeit-api/tool", ["module", "service", "routes", "types"]],
  ["codeit-api/workspace", ["module", "routes", "types"]]
]);

const webModuleRoots = [
  { app: "codeit-web", path: join(process.cwd(), "devkits", "codeit", "src", "modules") },
  { app: "marketing-web", path: join(process.cwd(), "apps", "marketing", "web", "src", "modules") },
  { app: "tconnect-web", path: join(process.cwd(), "apps", "tconnect", "web", "src", "modules") },
  { app: "qcafe-web", path: join(process.cwd(), "apps", "qcafe", "web", "src", "modules") },
  { app: "codexsun-web", path: join(process.cwd(), "apps", "codexsun", "web", "src", "modules") },
  { app: "hrms-web", path: join(process.cwd(), "apps", "hrms", "web", "src", "modules") },
  { app: "docs-web", path: join(process.cwd(), "apps", "docs", "web", "src", "modules") },
  { app: "himsx-web", path: join(process.cwd(), "apps", "himsx", "web", "src", "modules") },
  { app: "sites-web", path: join(process.cwd(), "apps", "sites", "web", "src", "modules") },

  {
    app: "ecommerce-storefront",
    path: join(process.cwd(), "apps", "ecommerce", "storefront", "src", "modules")
  },
  {
    app: "auditor-web",
    path: join(process.cwd(), "apps", "auditor", "web", "src", "modules")
  },
  {
    app: "ecommerce-web",
    path: join(process.cwd(), "apps", "ecommerce", "web", "src", "modules")
  },
  {
    app: "logicx-erp-web",
    path: join(process.cwd(), "apps", "logicx-erp", "web", "src", "modules")
  },
  {
    app: "crm-web",
    path: join(process.cwd(), "apps", "crm", "web", "src", "modules")
  },
  {
    app: "frappe-web",
    path: join(process.cwd(), "apps", "frappe", "web", "src", "modules")
  },
  {
    app: "zetro-web",
    path: join(process.cwd(), "apps", "zetro", "web", "src", "modules")
  },
  {
    app: "mail-web",
    path: join(process.cwd(), "apps", "mail", "web", "src", "modules")
  },
  {
    app: "billing-web",
    path: join(process.cwd(), "apps", "billing", "web", "src", "modules")
  },
  {
    app: "core-web",
    path: join(process.cwd(), "apps", "core", "web", "src", "modules")
  },
  {
    app: "platform-web",
    path: join(process.cwd(), "apps", "platform", "web", "src", "modules")
  },
  {
    app: "project-manager-web",
    path: join(process.cwd(), "devkits", "project-manager", "web", "src", "modules")
  },
  {
    app: "data-migration-web",
    path: join(process.cwd(), "devkits", "data-migration", "web", "src", "modules")
  },
  {
    app: "data-bridge-web",
    path: join(process.cwd(), "devkits", "data-bridge", "src", "modules")
  },
  {
    app: "zuno-web",
    path: join(process.cwd(), "devkits", "zuno", "web", "src", "modules")
  }
];

const requiredFrontendRoles = ["workspace", "list", "form", "services", "hooks", "types", "schema"];
const shellOnlyFrontendModules = new Set();
const shellOnlyFrontendRoles = ["module", "workspace", "services", "hooks", "types"];
const capabilityFrontendRoles = new Map([
  ["codeit-web/overview", ["workspace"]],
  ["codeit-web/personalization", ["services", "types"]],
  ["codeit-web/plugin", ["services", "types"]],
  ["codeit-web/orchestration", ["workspace", "services", "types"]],
  ["crm-web/lead", ["workspace", "list", "show", "services", "hooks", "types"]],
  ["tconnect-web/conversation", ["workspace", "list", "services", "hooks", "types", "schema"]],
  [
    "tconnect-web/buyer",
    ["workspace", "registration", "catalog", "enquiry", "sent", "services", "types", "schema"]
  ],
  ["tconnect-web/member", ["workspace", "services", "types", "schema"]],
  ["tconnect-web/member", ["workspace", "registration", "review", "services", "types", "schema"]],
  ["tconnect-web/inquiry", ["workspace", "form", "types", "schema"]],
  ["codexsun-web/devices", ["workspace", "list", "services", "hooks", "types"]],
  ["auditor-web/overview", ["workspace"]],
  ["hrms-web/overview", ["workspace", "services", "hooks", "types"]],
  [
    "data-migration-web/migration",
    ["workspace", "settings", "list", "form", "services", "types", "schema"]
  ],
  ["data-bridge-web/database-connection", ["workspace", "services", "types", "store"]],
  ["data-bridge-web/common-tables", ["workspace", "services"]],
  ["data-bridge-web/master-tables", ["workspace", "services"]],
  ["data-bridge-web/billing-tables", ["workspace", "services"]],
  ["data-bridge-web/import-review", ["workspace", "services", "types"]],
  ["data-bridge-web/transfer-session", ["workspace", "services", "types"]],
  ["data-bridge-web/business-import", ["workspace", "services", "types", "hooks"]],
  ["data-bridge-web/report", ["workspace", "services", "types"]],
  ["data-bridge-web/transport", ["request"]],
  ["docs-web/overview", ["workspace", "services", "hooks", "types"]],
  ["himsx-web/overview", ["workspace", "services", "hooks", "types"]],
  ["sites-web/overview", ["workspace", "services", "hooks", "types"]],
  ["ecommerce-web/overview", ["workspace", "services", "hooks", "types"]],
  ["ecommerce-web/storefront", ["page", "services", "types"]],
  [
    "ecommerce-web/storefront-organisation",
    ["workspace", "form", "services", "hooks", "types", "schema"]
  ],
  [
    "ecommerce-web/storefront-profile",
    ["workspace", "form", "services", "hooks", "types", "schema"]
  ],
  [
    "ecommerce-web/season-strip",
    ["workspace", "list", "form", "services", "hooks", "types", "schema"]
  ],
  ["logicx-erp-web/overview", ["workspace", "services", "hooks", "types"]],
  ["zuno-web/diagnostics", ["workspace", "list", "form", "services", "hooks", "types", "schema"]],
  ["zuno-web/cases", ["workspace", "list", "form", "services", "hooks", "types", "schema"]],
  ["zuno-web/watch", ["workspace", "list", "services", "hooks", "types"]],
  [
    "zuno-web/conversations",
    ["workspace", "list", "form", "show", "services", "hooks", "types", "schema"]
  ],
  ["crm-web/overview", ["workspace"]],
  ["crm-web/scheduler", ["workspace", "services"]],
  ["crm-web/activities", ["workspace", "list", "services", "hooks", "types"]],
  ["crm-web/sop", ["workspace", "services"]],
  ["crm-web/duties", ["workspace", "services"]],
  ["crm-web/closure", ["workspace", "services", "types"]],
  ["crm-web/call-log", ["workspace", "list", "form", "services", "hooks", "schema", "types"]],
  [
    "crm-web/contact",
    ["workspace", "list", "form", "show", "services", "hooks", "types", "schema"]
  ],
  ["frappe-web/overview", ["workspace", "list", "services", "hooks", "types"]],
  ["frappe-web/enquiry-sync", ["workspace", "list", "services", "hooks", "types"]],
  ["frappe-web/contact-import", ["workspace", "services", "types"]],
  ["frappe-web/activity-import", ["workspace", "services", "types"]],
  ["frappe-web/call-log-import", ["workspace", "services", "types"]],
  ["frappe-web/export", ["workspace", "services", "types"]],
  ["frappe-web/live-sync", ["workspace", "services", "types"]],
  ["frappe-web/connection", ["workspace", "form", "services", "hooks", "types", "schema"]],
  ["frappe-web/user-sync", ["workspace", "list", "form", "services", "hooks", "types"]],
  [
    "frappe-web/user-mapping",
    ["workspace", "list", "form", "services", "hooks", "types", "schema"]
  ],
  ["crm-web/contact-360", ["workspace", "services", "hooks", "types"]],
  ["zetro-web/provider", ["workspace", "services", "types"]],
  ...crmContact360Leaves.map((name) => [`crm-web/${name}`, ["services", "hooks", "types"]])
]);
const backendBehaviorMarkers = {
  events: ["create"],
  migration: ["migrate"],
  module: ["register"],
  seed: ["seed"],
  sync: ["function"],
  worker: ["process"]
};
const forbiddenScaffoldPatterns = [
  /reserved\s+(worker|sync|seed|migration)\s+surface/i,
  /queues\s*:\s*\[\s*\]/,
  /export\s*\{\s*\w+\s+as\s+\w+\s*\}\s*from/
];

const declaredSynchronousModules = new Set([
  ...[
    "association",
    "company",
    "community",
    "inquiry",
    "member",
    "product",
    "buyer",
    "requirement",
    "conversation",
    "message",
    "quotation",
    "credential"
  ].map((key) => `tconnect-api/${key}`),
  "qcafe-api/menu",
  "qcafe-api/pos",
  "qcafe-api/order",
  "qcafe-api/table",
  "qcafe-api/special",
  "qcafe-api/settings",
  "hrms-api/attendance",
  "hrms-api/department",
  "hrms-api/designation",
  "hrms-api/employee",
  "docs-api/knowledge",
  "sites-api/site",
  "crm-api/scheduler"
]);
const missing = [];

for (const root of moduleRoots) {
  if (requestedApp && root.app !== `${requestedApp}-api`) continue;
  if (!existsSync(root.path)) {
    missing.push(`${root.app}: missing src/modules`);
    continue;
  }

  if (root.app === "core-api") {
    validateCoreBackend(root);
    continue;
  }
  const modules = readdirSync(root.path, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory()
  );
  for (const moduleDir of modules) {
    const modulePath = join(root.path, moduleDir.name);
    if (root.app === "billing-api" && moduleDir.name === "reports") {
      validateBillingReportBackend(modulePath);
      continue;
    }
    const moduleLabel = `${root.app}/${moduleDir.name}`;
    if (declaredSynchronousModules.has(moduleLabel)) {
      const definition = readFileSync(join(modulePath, `${moduleDir.name}.module.ts`), "utf8");
      if (
        !/capabilities:\s*\{\s*events:\s*false,\s*worker:\s*false,\s*sync:\s*false\s*\}/u.test(
          definition
        )
      )
        missing.push(`${moduleLabel}: reduced contract requires explicit synchronous capabilities`);
    }
    const moduleRoles =
      capabilityBackendRoles.get(moduleLabel) ??
      (shellOnlyBackendModules.has(moduleLabel)
        ? shellOnlyBackendRoles
        : root.app === "platform-api" && reducedPlatformBackendModules.has(moduleDir.name)
          ? reducedBackendRoles
          : requiredBackendRoles);
    for (const role of moduleRoles) {
      const filePath = join(modulePath, `${moduleDir.name}.${role}.ts`);
      if (!existsSync(filePath)) {
        missing.push(`${root.app}/${moduleDir.name}: missing ${moduleDir.name}.${role}.ts`);
        continue;
      }
      validateRoleFile(filePath, `${root.app}/${moduleDir.name}`, role);
    }
    if (!existsSync(join(modulePath, "index.ts"))) {
      missing.push(`${root.app}/${moduleDir.name}: missing index.ts`);
    }
  }
}

for (const root of webModuleRoots) {
  if (requestedApp && root.app !== `${requestedApp}-web`) continue;
  if (!existsSync(root.path)) continue;
  if (root.app === "core-web") {
    validateCoreFrontend(root);
    continue;
  }
  const modules = readdirSync(root.path, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory()
  );
  for (const moduleDir of modules) {
    const modulePath = join(root.path, moduleDir.name);
    if (root.app === "billing-web" && moduleDir.name === "reports") {
      validateBillingReportFrontend(modulePath);
      continue;
    }
    const moduleLabel = `${root.app}/${moduleDir.name}`;
    const moduleRoles =
      capabilityFrontendRoles.get(moduleLabel) ??
      (shellOnlyFrontendModules.has(moduleLabel) ? shellOnlyFrontendRoles : requiredFrontendRoles);
    if (
      !capabilityFrontendRoles.has(moduleLabel) &&
      !shellOnlyFrontendModules.has(moduleLabel) &&
      !existsSync(join(modulePath, `${moduleDir.name}.services.ts`))
    )
      continue;

    for (const role of moduleRoles) {
      const extension = [
        "form",
        "list",
        "show",
        "workspace",
        "settings",
        "page",
        "registration",
        "review",
        "catalog",
        "enquiry",
        "sent"
      ].includes(role)
        ? "tsx"
        : "ts";
      const publicSiteRole =
        root.app === "tconnect-web" &&
        ((["buyer", "member"].includes(moduleDir.name) && role === "registration") ||
          (moduleDir.name === "inquiry" && role === "form"));
      const filePath = publicSiteRole
        ? join(
            process.cwd(),
            "apps/sites/clients/src/clients/tirupurconnect/modules",
            moduleDir.name,
            `${moduleDir.name}.${role}.${extension}`
          )
        : join(modulePath, `${moduleDir.name}.${role}.${extension}`);
      if (!existsSync(filePath)) {
        missing.push(
          `${root.app}/${moduleDir.name}: missing ${moduleDir.name}.${role}.${extension}`
        );
        continue;
      }
      validateRoleFile(filePath, `${root.app}/${moduleDir.name}`, role);
    }
    if (!existsSync(join(modulePath, "index.ts"))) {
      missing.push(`${root.app}/${moduleDir.name}: missing index.ts`);
    }
  }
}

if (missing.length > 0) {
  console.error("Module boundary check failed:");
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Module boundary check passed.");

function validateCoreBackend(root) {
  const leafRoles = ["migration", "module", "repository", "routes", "seed", "service", "types"];
  for (const modulePath of leafDirectories(root.path)) {
    const moduleName = modulePath.split(/[\\/]/).at(-1);
    const label = `${root.app}/${relativeModule(root.path, modulePath)}`;
    for (const role of leafRoles) {
      const filePath = join(modulePath, `${moduleName}.${role}.ts`);
      if (!existsSync(filePath)) missing.push(`${label}: missing ${moduleName}.${role}.ts`);
      else validateRoleFile(filePath, label, role);
    }
    if (!existsSync(join(modulePath, "index.ts"))) missing.push(`${label}: missing index.ts`);
  }
  for (const name of ["common", "master", "organisation"]) {
    const path = join(root.path, name);
    for (const role of ["module", "migration", "seed"]) {
      if (!existsSync(join(path, `${name}.${role}.ts`)))
        missing.push(`${root.app}/${name}: missing composition ${name}.${role}.ts`);
    }
    if (!existsSync(join(path, "index.ts"))) missing.push(`${root.app}/${name}: missing index.ts`);
  }
}

function validateCoreFrontend(root) {
  for (const modulePath of leafDirectories(root.path)) {
    const moduleName = modulePath.split(/[\\/]/).at(-1);
    const label = `${root.app}/${relativeModule(root.path, modulePath)}`;
    for (const role of requiredFrontendRoles) {
      const extension = ["form", "list", "workspace"].includes(role) ? "tsx" : "ts";
      const filePath = join(modulePath, `${moduleName}.${role}.${extension}`);
      if (!existsSync(filePath))
        missing.push(`${label}: missing ${moduleName}.${role}.${extension}`);
      else validateRoleFile(filePath, label, role);
    }
    if (!existsSync(join(modulePath, "index.ts"))) missing.push(`${label}: missing index.ts`);
  }
}

function validateBillingReportBackend(reportsPath) {
  const compositionModule = join(reportsPath, "reports.module.ts");
  if (!existsSync(compositionModule))
    missing.push("billing-api/reports: missing reports.module.ts");
  else validateRoleFile(compositionModule, "billing-api/reports", "module");
  if (!existsSync(join(reportsPath, "index.ts"))) {
    missing.push("billing-api/reports: missing index.ts");
  }
  const reportRoles = ["module", "service", "repository", "routes", "types"];
  for (const reportPath of leafDirectories(reportsPath)) {
    const reportName = reportPath.split(/[\\/]/).at(-1);
    const label = `billing-api/reports/${reportName}`;
    for (const role of reportRoles) {
      const filePath = join(reportPath, `${reportName}.${role}.ts`);
      if (!existsSync(filePath)) missing.push(`${label}: missing ${reportName}.${role}.ts`);
      else validateRoleFile(filePath, label, role);
    }
    if (!existsSync(join(reportPath, "index.ts"))) missing.push(`${label}: missing index.ts`);
  }
}

function validateBillingReportFrontend(reportsPath) {
  if (!existsSync(join(reportsPath, "index.ts"))) {
    missing.push("billing-web/reports: missing index.ts");
  }
  for (const reportPath of leafDirectories(reportsPath)) {
    const reportName = reportPath.split(/[\\/]/).at(-1);
    const label = `billing-web/reports/${reportName}`;
    for (const role of requiredFrontendRoles) {
      const extension = ["form", "list", "workspace"].includes(role) ? "tsx" : "ts";
      const filePath = join(reportPath, `${reportName}.${role}.${extension}`);
      if (!existsSync(filePath))
        missing.push(`${label}: missing ${reportName}.${role}.${extension}`);
      else validateRoleFile(filePath, label, role);
    }
    if (!existsSync(join(reportPath, "index.ts"))) missing.push(`${label}: missing index.ts`);
  }
}

function leafDirectories(rootPath) {
  const result = [];
  for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(rootPath, entry.name);
    const childDirectories = readdirSync(path, { withFileTypes: true }).filter((child) =>
      child.isDirectory()
    );
    if (existsSync(join(path, "index.ts")) && childDirectories.length === 0) result.push(path);
    else result.push(...leafDirectories(path));
  }
  return result;
}

function relativeModule(rootPath, modulePath) {
  return modulePath.slice(rootPath.length + 1).replaceAll("\\", "/");
}

function validateRoleFile(filePath, moduleLabel, role) {
  const source = readFileSync(filePath, "utf8").trim();
  if (!source) {
    missing.push(`${moduleLabel}: ${role} role is empty`);
    return;
  }
  for (const pattern of forbiddenScaffoldPatterns) {
    if (pattern.test(source)) {
      missing.push(`${moduleLabel}: ${role} role is scaffold-only or alias-only`);
      return;
    }
  }
  const markers = backendBehaviorMarkers[role];
  if (markers && !markers.some((marker) => source.toLowerCase().includes(marker))) {
    missing.push(`${moduleLabel}: ${role} role has no callable ${markers.join("/")} behavior`);
  }
  if (
    ["form", "list", "workspace", "registration", "review", "catalog", "enquiry", "sent"].includes(
      role
    ) &&
    !/export\s+function\s+\w+/.test(source)
  ) {
    missing.push(`${moduleLabel}: ${role} role must export a real component`);
  }
}
