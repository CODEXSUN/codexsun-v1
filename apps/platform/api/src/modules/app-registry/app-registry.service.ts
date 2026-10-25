import type {
  PlatformAppDefinition,
  PlatformAppId,
  PlatformAppSavePayload
} from "./app-registry.types.js";
import { AppRegistryRepository } from "./app-registry.repository.js";

export const defaultTenantModuleKeys = [
  "platform.application",
  "billing.sales",
  "accounts.overview",
  "mail",
  "notes",
  "chat",
  "platform.task-manager",
  "auditor",
  "crm",
  "frappe",
  "zetro",
  "logicx-erp",
  "tconnect",
  "ecommerce",
  "qcafe",
  "hrms",
  "docs",
  "himsx",
  "codexsun",
  "sites"
] as const;

export const platformAppRegistry: PlatformAppDefinition[] = [
  {
    appId: "codeit",
    id: 0,
    uuid: "",
    label: "Codeit",
    moduleKey: "codeit",
    stack: "codeit",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Standalone development workspace and runtime overview."
  },
  {
    appId: "marketing",
    id: 0,
    uuid: "",
    label: "Marketing",
    moduleKey: "marketing",
    stack: "marketing",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Tenant campaigns, capture and CRM handoff."
  },
  {
    appId: "sportsclub",
    id: 0,
    uuid: "",
    label: "Sports Club",
    moduleKey: "sportsclub",
    stack: "sportsclub",
    alwaysEnabled: false,
    defaultLanding: false,
    description:
      "Multi-tenant sports academy and club management with student, master and club admin portals."
  },
  {
    appId: "tconnect",
    id: 0,
    uuid: "",
    label: "TConnect",
    moduleKey: "tconnect",
    stack: "tconnect",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Buyer and seller discovery, branded company profiles and association communities."
  },
  {
    appId: "codexsun",
    id: 0,
    uuid: "",
    label: "CODEXSUN",
    moduleKey: "codexsun",
    stack: "codexsun",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Zuno front desk, requirements, connected workspaces and approvals."
  },
  {
    appId: "hrms",
    id: 0,
    uuid: "",
    label: "HRMS",
    moduleKey: "hrms",
    stack: "hrms",
    alwaysEnabled: false,
    defaultLanding: false,
    description:
      "Human Resource Management System. People, employment and workforce administration."
  },
  {
    appId: "docs",
    id: 0,
    uuid: "",
    label: "Docs",
    moduleKey: "docs",
    stack: "docs",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Documentation. Documentation and knowledge management."
  },
  {
    appId: "himsx",
    id: 0,
    uuid: "",
    label: "Himsx",
    moduleKey: "himsx",
    stack: "himsx",
    alwaysEnabled: false,
    defaultLanding: false,
    description:
      "Hospital Information Management System. Hospital information and administrative operations."
  },
  {
    appId: "sites",
    id: 0,
    uuid: "",
    label: "Site Studio",
    moduleKey: "sites",
    stack: "sites",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Site Studio CMS portal for multi-client portfolio websites (Wix / Shopify style)."
  },
  {
    appId: "qcafe",
    id: 0,
    label: "Q Cafe",
    moduleKey: "qcafe",
    stack: "qcafe",
    uuid: "",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Restaurant operations in the Q Cafe workspace with its own PIN login."
  },
  {
    appId: "ecommerce",
    id: 0,
    label: "Ecommerce",
    moduleKey: "ecommerce",
    stack: "ecommerce",
    uuid: "",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Tenant ecommerce operations and storefront workspace."
  },
  {
    alwaysEnabled: true,
    defaultLanding: true,
    description: "Platform workspace, tenant profile, application settings, users, and access.",
    appId: "application",
    id: 0,
    label: "Application",
    moduleKey: "platform.application",
    stack: "platform",
    uuid: ""
  },
  {
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Billing sales, core masters, invoice flow, and billing setup.",
    appId: "billing",
    id: 0,
    label: "Billing",
    moduleKey: "billing.sales",
    stack: "billing",
    uuid: ""
  },
  {
    alwaysEnabled: false,
    defaultLanding: false,
    description:
      "Tenant inbox, compose, queued SMTP delivery, sent history, failures, and settings.",
    appId: "mail",
    id: 0,
    label: "Mail",
    moduleKey: "mail",
    stack: "mail",
    uuid: ""
  },
  {
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Fast team notes with search, suspend, restore, and permanent delete.",
    appId: "notes",
    id: 0,
    label: "Notes",
    moduleKey: "notes",
    stack: "notes",
    uuid: ""
  },
  {
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Team channels, direct threads, and channel messages.",
    appId: "chat",
    id: 0,
    label: "Chat",
    moduleKey: "chat",
    stack: "chat",
    uuid: ""
  },
  {
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Chart of accounts, ledger groups, ledgers, journal, and accounting overview.",
    appId: "accounts",
    id: 0,
    label: "Accounts",
    moduleKey: "accounts.overview",
    stack: "accounts",
    uuid: ""
  },
  {
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Tenant-owned Todo planning backed by the live tenant database.",
    appId: "task-manager",
    id: 0,
    label: "Task Manager",
    moduleKey: "platform.task-manager",
    stack: "platform-task-manager",
    uuid: ""
  },
  {
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Tenant-owned articles, authors, media, SEO, discussions, and publishing.",
    appId: "blog",
    id: 0,
    label: "Blog",
    moduleKey: "blog",
    stack: "blog",
    uuid: ""
  },
  {
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Customer relationships and sales opportunities.",
    appId: "crm",
    id: 0,
    label: "CRM",
    moduleKey: "crm",
    stack: "crm",
    uuid: ""
  },
  {
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Frappe connection and outbound CRM enquiry sync.",
    appId: "frappe",
    id: 0,
    label: "Frappe",
    moduleKey: "frappe",
    stack: "frappe",
    uuid: ""
  },
  {
    alwaysEnabled: false,
    defaultLanding: false,
    description: "AI coworker with private conversation history.",
    appId: "zetro",
    id: 0,
    label: "Zetro",
    moduleKey: "zetro",
    stack: "zetro",
    uuid: ""
  },
  {
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Tenant audit planning, evidence, findings, compliance review, and sign-off.",
    appId: "auditor",
    id: 0,
    label: "Auditor",
    moduleKey: "auditor",
    stack: "auditor",
    uuid: ""
  },
  {
    alwaysEnabled: false,
    defaultLanding: false,
    description: "LogicX ERP operations workspace for the tenant desk.",
    appId: "logicx-erp",
    id: 0,
    label: "LogicX ERP",
    moduleKey: "logicx-erp",
    stack: "logicx-erp",
    uuid: ""
  }
];

export function resolveEnabledApps(enabledModuleKeys: string[]) {
  const enabled = new Set(["platform.application", ...enabledModuleKeys]);
  if (enabled.has("accounts.accounting")) enabled.add("accounts.overview");
  return platformAppRegistry.map((app) => ({
    ...app,
    enabled:
      (app.appId !== "frappe" || enabled.has("crm")) &&
      (app.alwaysEnabled || enabled.has(app.moduleKey))
  }));
}

export function resolveLandingApp(value: unknown, enabledModuleKeys: string[]): PlatformAppId {
  const enabledApps = resolveEnabledApps(enabledModuleKeys).filter((app) => app.enabled);
  const requested = typeof value === "string" ? value : "";
  if (enabledApps.some((app) => app.appId === requested)) {
    return requested as PlatformAppId;
  }
  return "application";
}

export class AppRegistryService {
  constructor(private readonly repository = new AppRegistryRepository()) {}
  listApps() {
    return this.repository.list();
  }
  createApp(input: PlatformAppSavePayload) {
    validateApp(input);
    return this.repository.create(input);
  }
  updateApp(id: string, input: PlatformAppSavePayload) {
    validateApp(input);
    return this.repository.update(Number(id), input);
  }
}

function validateApp(input: PlatformAppSavePayload) {
  if (!input.label.trim() || !input.moduleKey.trim())
    throw new Error("App label and module key are required.");
}
