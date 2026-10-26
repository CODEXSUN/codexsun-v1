import {
  Code2Icon,
  UserRoundPlusIcon,
  ListTodoIcon,
  BookOpenCheckIcon,
  BriefcaseBusinessIcon,
  AlertTriangleIcon,
  ArchiveIcon,
  BadgePercentIcon,
  BellIcon,
  BarChart3Icon,
  BoxesIcon,
  Building2Icon,
  CircleGaugeIcon,
  CoffeeIcon,
  CalendarDaysIcon,
  UtensilsCrossedIcon,
  ShoppingBagIcon,
  Clock3Icon,
  CreditCardIcon,
  FileTextIcon,
  Globe2Icon,
  InboxIcon,
  LandmarkIcon,
  LayersIcon,
  MailIcon,
  MapPinnedIcon,
  MessageCircleIcon,
  MessagesSquareIcon,
  NotebookPenIcon,
  PackageIcon,
  PanelsTopLeftIcon,
  PhoneCallIcon,
  Settings2Icon,
  UsersIcon,
  ClipboardListIcon,
  ContactRoundIcon,
  RefreshCwIcon,
  LayoutDashboardIcon,
  LogsIcon,
  ReceiptTextIcon,
  SendIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Trash2Icon,
  TrophyIcon,
  type LucideIcon
} from "lucide-react";
import { CrmBrandIcon } from "./crm-brand-icon";
import type {
  SidemenuItem,
  SidemenuSubItem
} from "@codexsun/ui/blocks/menu/sidemenu/sub/sidemenu-section";

export type PlatformAppId =
  | "application"
  | "billing"
  | "accounts"
  | "devkit"
  | "project-manager"
  | "mail"
  | "notes"
  | "chat"
  | "task-manager"
  | "blog"
  | "auditor"
  | "marketing"
  | "crm"
  | "frappe"
  | "zetro"
  | "logicx-erp"
  | "tconnect"
  | "sportsclub"
  | "ecommerce"
  | "qcafe"
  | "hrms"
  | "docs"
  | "codeit"
  | "himsx"
  | "codexsun"
  | "sites";

export type PlatformAppRootPage =
  | "codeit.overview"
  | "application.overview"
  | "billing.overview"
  | "accounts.overview"
  | "mail.inbox"
  | "notes.overview"
  | "chat.overview"
  | "chat.direct"
  | "task-manager.overview"
  | "blog.overview"
  | "auditor.overview"
  | "auditor.clients"
  | "marketing.consents"
  | "marketing.contents"
  | "marketing.email-campaigns"
  | "marketing.conversations"
  | "marketing.submissions"
  | "marketing.brands"
  | "marketing.campaigns"
  | "marketing.captures"
  | "marketing.connections"
  | "marketing.leads"
  | "marketing.qualifications"
  | "marketing.conversions"
  | "marketing.outcomes"
  | "marketing.followups"
  | "crm.overview"
  | "crm.sops"
  | "crm.leads"
  | "crm.tasks"
  | "frappe.overview"
  | "zetro.chat"
  | "logicx-erp.overview"
  | "tconnect.overview"
  | "sportsclub.overview"
  | "sportsclub.members"
  | "sportsclub.masters"
  | "sportsclub.programs"
  | "sportsclub.sessions"
  | "sportsclub.attendance"
  | "sportsclub.progress"
  | "sportsclub.events"
  | "sportsclub.enquiries"
  | "ecommerce.overview"
  | "qcafe.dashboard"
  | "qcafe.overview"
  | "qcafe.menu"
  | "qcafe.settings"
  | "qcafe.kot"
  | "qcafe.take-away"
  | "qcafe.booking"
  | "qcafe.kitchen"
  | "hrms.overview"
  | "hrms.employees"
  | "docs.overview"
  | "himsx.overview"
  | "codexsun.frontdesk"
  | "sites.overview"
  | "sites.studio"
  | "sites.sites"
  | "sites.guide";

export type BillingNavigationFeatures = {
  exportSales: boolean;
  quotation: boolean;
};

export type CrmNavigationCounts = {
  assigned: number;
  created: number;
  all: number;
  leads?: number;
  reminders?: number;
};

export type ChatNavigationCounts = {
  direct?: number;
  groups?: number;
  channels?: number;
  broadcast?: number;
  total?: number;
};

export type PlatformAppDefinition = {
  accentClass: string;
  alwaysEnabled: boolean;
  defaultLanding: boolean;
  description: string;
  id: PlatformAppId;
  icon: LucideIcon;
  iconSrc?: string;
  label: string;
  moduleKey: string;
  stack:
    | "platform"
    | "billing"
    | "accounts"
    | "devkit"
    | "project-manager"
    | "mail"
    | "notes"
    | "chat"
    | "platform-task-manager"
    | "blog"
    | "auditor"
    | "marketing"
    | "crm"
    | "frappe"
    | "zetro"
    | "logicx-erp"
    | "tconnect"
    | "sportsclub"
    | "ecommerce"
    | "qcafe"
    | "hrms"
    | "docs"
    | "codeit"
    | "himsx"
    | "codexsun"
    | "sites";
};

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
    id: "codeit",
    label: "Codeit",
    moduleKey: "codeit",
    stack: "codeit",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Standalone development workspace and runtime overview.",
    icon: Code2Icon,
    accentClass: "bg-slate-700"
  },
  {
    id: "marketing",
    label: "Marketing",
    moduleKey: "marketing",
    stack: "marketing",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Tenant campaigns and lead capture.",
    icon: Globe2Icon,
    accentClass: "bg-sky-600"
  },
  {
    id: "codexsun",
    label: "CODEXSUN",
    moduleKey: "codexsun",
    stack: "codexsun",
    icon: SparklesIcon,
    accentClass: "bg-indigo-600",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Zuno front desk, requirements, connected workspaces and approvals."
  },
  {
    id: "hrms",
    label: "HRMS",
    moduleKey: "hrms",
    stack: "hrms",
    icon: UsersIcon,
    accentClass: "bg-teal-700",
    alwaysEnabled: false,
    defaultLanding: false,
    description:
      "Human Resource Management System. People, employment and workforce administration."
  },
  {
    id: "docs",
    label: "Docs",
    moduleKey: "docs",
    stack: "docs",
    icon: FileTextIcon,
    accentClass: "bg-sky-700",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Documentation. Documentation and knowledge management."
  },
  {
    id: "himsx",
    label: "Himsx",
    moduleKey: "himsx",
    stack: "himsx",
    icon: Building2Icon,
    accentClass: "bg-rose-700",
    alwaysEnabled: false,
    defaultLanding: false,
    description:
      "Hospital Information Management System. Hospital information and administrative operations."
  },
  {
    id: "sites",
    label: "Site Studio",
    moduleKey: "sites",
    stack: "sites",
    icon: Globe2Icon,
    accentClass: "bg-sky-600",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Site Studio CMS portal for multi-client portfolio websites (Wix / Shopify style)."
  },
  {
    id: "qcafe",
    label: "QCafe",
    moduleKey: "qcafe",
    stack: "qcafe",
    icon: CoffeeIcon,
    accentClass: "bg-amber-700",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Restaurant operations with a separate Q Cafe PIN login."
  },
  {
    id: "tconnect",
    label: "TConnect",
    moduleKey: "tconnect",
    stack: "tconnect",
    icon: UsersIcon,
    accentClass: "bg-emerald-700",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Business discovery and association communities."
  },
  {
    id: "sportsclub",
    label: "Sports Club",
    moduleKey: "sportsclub",
    stack: "sportsclub",
    icon: TrophyIcon,
    accentClass: "bg-orange-700",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Sports club management, student enrollments, batches, and training programs."
  },
  {
    id: "ecommerce",
    label: "Ecommerce",
    moduleKey: "ecommerce",
    stack: "ecommerce",
    icon: PackageIcon,
    accentClass: "bg-indigo-600",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Tenant ecommerce operations workspace."
  },
  {
    accentClass: "bg-slate-950",
    alwaysEnabled: true,
    defaultLanding: true,
    description: "Platform workspace, tenant profile, application settings, users, and access.",
    icon: LayoutDashboardIcon,
    id: "application",
    label: "Application",
    moduleKey: "platform.application",
    stack: "platform"
  },
  {
    accentClass: "bg-emerald-600",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Sales, purchase, receipt, payment, report, master, common, and billing settings.",
    icon: ReceiptTextIcon,
    id: "billing",
    label: "Billing",
    moduleKey: "billing.sales",
    stack: "billing"
  },
  {
    accentClass: "bg-sky-600",
    alwaysEnabled: false,
    defaultLanding: false,
    description:
      "Tenant inbox, rich compose, SMTP delivery, drafts, sent history, failures, and provider settings.",
    icon: MailIcon,
    id: "mail",
    label: "Mail",
    moduleKey: "mail",
    stack: "mail"
  },
  {
    accentClass: "bg-amber-500",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Fast team notes with search, suspend, restore, and permanent delete.",
    icon: NotebookPenIcon,
    id: "notes",
    label: "Notes",
    moduleKey: "notes",
    stack: "notes"
  },
  {
    accentClass: "bg-emerald-600",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Team channels, direct threads, and channel messages.",
    icon: MessagesSquareIcon,
    id: "chat",
    label: "Chat",
    moduleKey: "chat",
    stack: "chat"
  },
  {
    accentClass: "bg-cyan-600",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Chart of accounts, ledger groups, ledgers, journal, and accounting overview.",
    icon: LayersIcon,
    id: "accounts",
    label: "Accounts",
    moduleKey: "accounts.overview",
    stack: "accounts"
  },
  {
    accentClass: "bg-violet-600",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Tenant-owned Todo planning backed by the live tenant database.",
    icon: ClipboardListIcon,
    id: "task-manager",
    label: "Task Manager",
    moduleKey: "platform.task-manager",
    stack: "platform-task-manager"
  },
  {
    accentClass: "bg-amber-600",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Tenant-owned articles, authors, media, SEO, discussions, and publishing.",
    icon: FileTextIcon,
    id: "blog",
    label: "Blog",
    moduleKey: "blog",
    stack: "blog"
  },
  {
    accentClass: "bg-rose-600",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Customer relationships and sales opportunities.",
    icon: CrmBrandIcon,
    iconSrc: "/logo/app-icon.png",
    id: "crm",
    label: "CRM",
    moduleKey: "crm",
    stack: "crm"
  },
  {
    accentClass: "bg-teal-600",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Frappe connection and manual CRM enquiry sync.",
    icon: RefreshCwIcon,
    id: "frappe",
    label: "Frappe",
    moduleKey: "frappe",
    stack: "frappe"
  },
  {
    accentClass: "bg-fuchsia-600",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "AI coworker with private conversation history.",
    icon: SparklesIcon,
    id: "zetro",
    label: "Zetro",
    moduleKey: "zetro",
    stack: "zetro"
  },
  {
    accentClass: "bg-indigo-600",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "Tenant audit planning, evidence, findings, compliance review, and sign-off.",
    icon: ShieldCheckIcon,
    id: "auditor",
    label: "Auditor",
    moduleKey: "auditor",
    stack: "auditor"
  },
  {
    accentClass: "bg-orange-600",
    alwaysEnabled: false,
    defaultLanding: false,
    description: "LogicX ERP operations workspace for the tenant desk.",
    icon: BoxesIcon,
    id: "logicx-erp",
    label: "LogicX ERP",
    moduleKey: "logicx-erp",
    stack: "logicx-erp"
  }
];

function ecommerceMenuItems(activePage: string, onSelect: (page: string) => void): SidemenuItem[] {
  const leaf = (title: string, page: string): SidemenuSubItem => ({
    title,
    isActive: activePage === page,
    onSelect: () => onSelect(page)
  });
  const catalog = [
    leaf("Items", "ecommerce.product-information"),
    leaf("Attributes", "ecommerce.product-attributes"),
    leaf("Specifications", "ecommerce.product-specifications"),
    leaf("Collections", "ecommerce.product-collections"),
    leaf("Categories", "ecommerce.categories"),
    leaf("Products", "ecommerce.products"),
    leaf("Variants", "ecommerce.product-variants"),
    leaf("Product Images", "ecommerce.product-images")
  ];
  const storefront = [
    leaf("Home Slider", "ecommerce.storefront-sliders"),
    leaf("Trusted Strip", "ecommerce.trusted-strip"),
    leaf("Promotion Cards", "ecommerce.promotions"),
    leaf("Brands Strip", "ecommerce.brands-strip"),
    leaf("Featured Cards", "ecommerce.featured-cards"),
    leaf("Season Strip", "ecommerce.season-strips"),
    leaf("Campaign Events", "ecommerce.campaign-events"),
    leaf("Service Banner", "ecommerce.service-banner")
  ];
  const settings = [
    leaf("Organisation", "ecommerce.organisation"),
    leaf("Storefront Profile", "ecommerce.storefront"),
    leaf("Data Source", "ecommerce.catalog-data-source")
  ];
  return [
    { ...leaf("Overview", "ecommerce.overview"), icon: LayoutDashboardIcon },
    {
      title: "Catalog",
      icon: PackageIcon,
      isActive: catalog.some((item) => item.isActive),
      items: catalog
    },
    {
      title: "Storefront UX",
      icon: PanelsTopLeftIcon,
      isActive: storefront.some((item) => item.isActive),
      items: storefront
    },
    {
      title: "Settings",
      icon: Settings2Icon,
      isActive: settings.some((item) => item.isActive),
      items: settings
    }
  ];
}

export function normalizeModuleKeys(moduleKeys: string[]) {
  return Array.from(
    new Set([
      "platform.application",
      ...moduleKeys.map((key) => {
        if (key === "platform.tenant") return "platform.application";
        if (key === "accounts.accounting") return "accounts.overview";
        return key;
      })
    ])
  );
}

export function enabledAppIds(moduleKeys: string[]) {
  const enabled = new Set(normalizeModuleKeys(moduleKeys));
  return platformAppRegistry
    .filter(
      (app) =>
        app.id !== "devkit" &&
        app.id !== "project-manager" &&
        (app.id !== "frappe" || enabled.has("crm")) &&
        (app.alwaysEnabled || enabled.has(app.moduleKey))
    )
    .map((app) => app.id);
}

export function defaultLandingApp(value: unknown, moduleKeys: string[]): PlatformAppId {
  const requested = typeof value === "string" ? value : "";
  const enabled = enabledAppIds(moduleKeys);
  return enabled.includes(requested as PlatformAppId)
    ? (requested as PlatformAppId)
    : "application";
}

export function appRootPage(appId: PlatformAppId): PlatformAppRootPage {
  if (appId === "codeit") return "codeit.overview";
  if (appId === "codexsun") return "codexsun.frontdesk";
  if (appId === "marketing") return "marketing.brands";
  if (appId === "sites") return "sites.overview";
  if (appId === "himsx") return "himsx.overview";
  if (appId === "docs") return "docs.overview";
  if (appId === "hrms") return "hrms.overview";
  if (appId === "qcafe") return "qcafe.overview";
  if (appId === "tconnect") return "tconnect.overview";
  if (appId === "sportsclub") return "sportsclub.overview";
  if (appId === "ecommerce") return "ecommerce.overview";
  if (appId === "logicx-erp") return "logicx-erp.overview";
  if (appId === "zetro") return "zetro.chat";
  if (appId === "frappe") return "frappe.overview";
  if (appId === "crm") return "crm.overview";
  if (appId === "blog") return "blog.overview";
  if (appId === "auditor") return "auditor.overview";
  if (appId === "task-manager") return "task-manager.overview";
  if (appId === "mail") return "mail.inbox";
  if (appId === "notes") return "notes.overview";
  if (appId === "chat") return "chat.direct";
  if (appId === "accounts") return "accounts.overview";
  if (appId === "billing") return "billing.overview";
  return "application.overview";
}

export function appRootUrl(appId: PlatformAppId) {
  if (appId === "qcafe") return "/app/qcafe";
  if (appId === "ecommerce") return "/app/ecommerce";
  return `/app/${appRootPage(appId).replaceAll(".", "/")}`;
}

export function appMenuFor(
  appId: PlatformAppId,
  activePage: string,
  onSelect: (page: string) => void,
  billingFeatures?: BillingNavigationFeatures,
  crmCounts?: CrmNavigationCounts,
  billingEnabled = false,
  chatCounts?: ChatNavigationCounts
): SidemenuItem {
  if (appId === "codeit")
    return {
      icon: Code2Icon,
      title: "Codeit",
      isActive: activePage.startsWith("codeit."),
      items: codeitMenuItems(activePage, onSelect)
    };
  if (appId === "codexsun")
    return {
      icon: SparklesIcon,
      title: "CODEXSUN",
      isActive: activePage.startsWith("codexsun."),
      items: codexsunMenuItems(activePage, onSelect)
    };
  if (appId === "hrms")
    return {
      icon: UsersIcon,
      title: "HRMS",
      isActive: activePage.startsWith("hrms."),
      items: [
        {
          icon: LayoutDashboardIcon,
          title: "Overview",
          isActive: activePage === "hrms.overview",
          onSelect: () => onSelect("hrms.overview")
        },
        {
          icon: UsersIcon,
          title: "Employees",
          isActive: activePage === "hrms.employees",
          onSelect: () => onSelect("hrms.employees")
        },
        {
          icon: ClipboardListIcon,
          title: "Attendance",
          isActive: activePage === "hrms.attendance",
          onSelect: () => onSelect("hrms.attendance")
        }
      ]
    };
  if (appId === "docs")
    return {
      icon: FileTextIcon,
      title: "Docs",
      isActive: activePage.startsWith("docs."),
      items: [
        {
          icon: LayoutDashboardIcon,
          title: "Overview",
          isActive: activePage === "docs.overview",
          onSelect: () => onSelect("docs.overview")
        },
        {
          icon: FileTextIcon,
          title: "Developer Library",
          isActive: activePage === "docs.library",
          onSelect: () => onSelect("docs.library")
        },
        {
          icon: FileTextIcon,
          title: "Getting Started",
          isActive: activePage === "docs.guide",
          onSelect: () => onSelect("docs.guide")
        }
      ]
    };
  if (appId === "himsx")
    return {
      icon: Building2Icon,
      title: "Himsx",
      isActive: activePage.startsWith("himsx."),
      items: [
        {
          icon: LayoutDashboardIcon,
          title: "Overview",
          isActive: activePage === "himsx.overview",
          onSelect: () => onSelect("himsx.overview")
        },
        {
          icon: FileTextIcon,
          title: "Getting Started",
          isActive: activePage === "himsx.guide",
          onSelect: () => onSelect("himsx.guide")
        }
      ]
    };
  if (appId === "sites")
    return {
      icon: Globe2Icon,
      title: "Site Studio",
      isActive: activePage.startsWith("sites."),
      items: [
        {
          icon: LayoutDashboardIcon,
          title: "Studio Dashboard",
          isActive: activePage === "sites.overview" || activePage === "sites.studio",
          onSelect: () => onSelect("sites.overview")
        },
        {
          icon: Globe2Icon,
          title: "Client Portfolios",
          isActive: activePage === "sites.sites",
          onSelect: () => onSelect("sites.sites")
        },
        {
          icon: FileTextIcon,
          title: "Guide",
          isActive: activePage === "sites.guide",
          onSelect: () => onSelect("sites.guide")
        }
      ]
    };
  if (appId === "qcafe") {
    return {
      icon: CoffeeIcon,
      title: "QCafe",
      isActive: activePage.startsWith("qcafe."),
      items: [
        {
          icon: CoffeeIcon,
          title: "Overview",
          isActive: activePage === "qcafe.dashboard",
          onSelect: () => onSelect("qcafe.dashboard")
        },
        {
          icon: CoffeeIcon,
          title: "POS",
          isActive: activePage === "qcafe.overview",
          onSelect: () => onSelect("qcafe.overview")
        },
        {
          icon: ReceiptTextIcon,
          title: "KOT",
          isActive: activePage === "qcafe.kot",
          onSelect: () => onSelect("qcafe.kot")
        },
        {
          icon: ShoppingBagIcon,
          title: "Parcel - Take away",
          isActive: activePage === "qcafe.take-away",
          onSelect: () => onSelect("qcafe.take-away")
        },
        {
          icon: CalendarDaysIcon,
          title: "Booking",
          isActive: activePage === "qcafe.booking",
          onSelect: () => onSelect("qcafe.booking")
        },
        {
          icon: UtensilsCrossedIcon,
          title: "Kitchen",
          isActive: activePage === "qcafe.kitchen",
          onSelect: () => onSelect("qcafe.kitchen")
        },
        {
          icon: UtensilsCrossedIcon,
          title: "Master",
          isActive: activePage === "qcafe.menu",
          onSelect: () => onSelect("qcafe.menu")
        }
      ]
    };
  }
  if (appId === "tconnect")
    return {
      icon: UsersIcon,
      title: "TConnect",
      isActive: activePage.startsWith("tconnect."),
      items: [
        {
          icon: UsersIcon,
          title: "Business network",
          isActive: activePage === "tconnect.overview",
          onSelect: () => onSelect("tconnect.overview")
        }
      ]
    };
  if (appId === "sportsclub")
    return {
      icon: TrophyIcon,
      title: "Sports Club",
      isActive: activePage.startsWith("sportsclub."),
      items: [
        {
          icon: LayoutDashboardIcon,
          title: "Overview",
          isActive: activePage === "sportsclub.overview",
          onSelect: () => onSelect("sportsclub.overview")
        },
        {
          icon: UsersIcon,
          title: "Students",
          isActive: activePage === "sportsclub.members",
          onSelect: () => onSelect("sportsclub.members")
        },
        {
          icon: ContactRoundIcon,
          title: "Masters",
          isActive: activePage === "sportsclub.masters",
          onSelect: () => onSelect("sportsclub.masters")
        },
        {
          icon: NotebookPenIcon,
          title: "Curriculum",
          isActive: activePage === "sportsclub.programs",
          onSelect: () => onSelect("sportsclub.programs")
        },
        {
          icon: CalendarDaysIcon,
          title: "Batches",
          isActive: activePage === "sportsclub.sessions",
          onSelect: () => onSelect("sportsclub.sessions")
        },
        {
          icon: ClipboardListIcon,
          title: "Attendance",
          isActive: activePage === "sportsclub.attendance",
          onSelect: () => onSelect("sportsclub.attendance")
        },
        {
          icon: SparklesIcon,
          title: "Assessments",
          isActive: activePage === "sportsclub.progress",
          onSelect: () => onSelect("sportsclub.progress")
        },
        {
          icon: TrophyIcon,
          title: "Events",
          isActive: activePage === "sportsclub.events",
          onSelect: () => onSelect("sportsclub.events")
        },
        {
          icon: MessageCircleIcon,
          title: "Admissions",
          isActive: activePage === "sportsclub.enquiries",
          onSelect: () => onSelect("sportsclub.enquiries")
        }
      ]
    };
  if (appId === "ecommerce") {
    return {
      icon: PackageIcon,
      title: "Ecommerce",
      isActive: activePage.startsWith("ecommerce"),
      items: ecommerceMenuItems(activePage, onSelect)
    };
  }
  if (appId === "logicx-erp") {
    return {
      icon: BoxesIcon,
      isActive: activePage.startsWith("logicx-erp"),
      title: "LogicX ERP",
      items: [
        {
          title: "Overview",
          isActive: activePage === "logicx-erp.overview",
          onSelect: () => onSelect("logicx-erp.overview")
        },
        ...(billingEnabled
          ? [
              {
                title: "Schemes",
                isActive: activePage === "logicx-erp.schemes",
                onSelect: () => onSelect("logicx-erp.schemes")
              }
            ]
          : [])
      ]
    };
  }
  if (appId === "zetro") {
    return {
      icon: SparklesIcon,
      isActive: activePage === "zetro.chat",
      onSelect: () => onSelect("zetro.chat"),
      title: "Zetro"
    };
  }
  if (appId === "frappe") {
    return {
      icon: RefreshCwIcon,
      isActive: activePage.startsWith("frappe"),
      onSelect: () => onSelect("frappe.overview"),
      title: "Frappe"
    };
  }
  if (appId === "crm") {
    return {
      icon: ContactRoundIcon,
      isActive: activePage.startsWith("crm"),
      title: "CRM",
      items: [
        {
          title: "Overview",
          isActive: activePage === "crm.overview",
          onSelect: () => onSelect("crm.overview")
        },
        {
          title: "My Job",
          count: crmCounts?.assigned,
          isActive: activePage === "crm.my-job",
          onSelect: () => onSelect("crm.my-job")
        },
        {
          title: "My Calls",
          count: crmCounts?.created,
          isActive: activePage === "crm.my-calls",
          onSelect: () => onSelect("crm.my-calls")
        },
        {
          title: "Leads",
          count: crmCounts?.leads,
          isActive: activePage === "crm.leads",
          onSelect: () => onSelect("crm.leads")
        },
        {
          title: "All Enquiries",
          count: crmCounts?.all,
          isActive: activePage === "crm.enquiries",
          onSelect: () => onSelect("crm.enquiries")
        },
        {
          title: "Tasks",
          isActive: activePage === "crm.tasks",
          onSelect: () => onSelect("crm.tasks")
        },
        {
          title: "Reminder",
          count: crmCounts?.reminders,
          isActive: activePage === "crm.reminders",
          onSelect: () => onSelect("crm.reminders")
        },
        {
          title: "Call Logs",
          isActive: activePage === "crm.call-logs",
          onSelect: () => onSelect("crm.call-logs")
        },
        {
          title: "Activities",
          isActive: activePage === "crm.activities",
          onSelect: () => onSelect("crm.activities")
        },
        {
          title: "SOPs",
          isActive: activePage === "crm.sops",
          onSelect: () => onSelect("crm.sops")
        },
        {
          title: "Duties",
          isActive: activePage === "crm.duties",
          onSelect: () => onSelect("crm.duties")
        },
        {
          title: "Duty Reporting",
          isActive: activePage === "crm.duty-reporting",
          onSelect: () => onSelect("crm.duty-reporting")
        },
        {
          title: "Reports",
          isActive: activePage === "crm.reports",
          onSelect: () => onSelect("crm.reports")
        },
        {
          title: "Contacts",
          isActive: activePage === "crm.contacts",
          onSelect: () => onSelect("crm.contacts")
        },
        {
          title: "Contact 360",
          isActive: activePage === "crm.contact-360",
          onSelect: () => onSelect("crm.contact-360")
        },
        {
          title: "Common",
          isActive:
            activePage === "crm.list-in" ||
            activePage === "crm.status" ||
            activePage === "crm.priority",
          items: [
            {
              title: "List In",
              isActive: activePage === "crm.list-in",
              onSelect: () => onSelect("crm.list-in")
            },
            {
              title: "Status",
              isActive: activePage === "crm.status",
              onSelect: () => onSelect("crm.status")
            },
            {
              title: "Priority",
              isActive: activePage === "crm.priority",
              onSelect: () => onSelect("crm.priority")
            }
          ]
        }
      ]
    };
  }
  if (appId === "blog") {
    return {
      icon: FileTextIcon,
      isActive: activePage.startsWith("blog"),
      title: "Blog",
      items: [
        {
          title: "Dashboard",
          isActive: activePage === "blog.overview",
          onSelect: () => onSelect("blog.overview")
        },
        {
          title: "Articles",
          isActive: activePage === "blog.articles",
          onSelect: () => onSelect("blog.articles")
        }
      ]
    };
  }
  if (appId === "auditor") {
    return {
      icon: ShieldCheckIcon,
      isActive: activePage.startsWith("auditor"),
      title: "Auditor",
      items: [
        {
          title: "Overview",
          isActive: activePage === "auditor.overview",
          onSelect: () => onSelect("auditor.overview")
        },
        {
          title: "Clients",
          isActive: activePage === "auditor.clients",
          onSelect: () => onSelect("auditor.clients")
        }
      ]
    };
  }
  if (appId === "mail") {
    return {
      icon: MailIcon,
      isActive: activePage.startsWith("mail"),
      onSelect: () => onSelect("mail.inbox"),
      title: "Mail"
    };
  }
  if (appId === "notes") {
    return {
      icon: NotebookPenIcon,
      isActive: activePage.startsWith("notes"),
      onSelect: () => onSelect("notes.overview"),
      title: "Notes"
    };
  }
  if (appId === "chat") {
    const unread = chatCounts?.total ?? chatCounts?.direct;
    return {
      icon: MessagesSquareIcon,
      isActive: activePage.startsWith("chat"),
      onSelect: () => onSelect("chat.direct"),
      title: "Chat",
      count: unread && unread > 0 ? unread : undefined
    };
  }
  if (appId === "accounts") {
    return {
      icon: LayersIcon,
      isActive: activePage.startsWith("accounts"),
      title: "Accounts",
      items: [
        {
          title: "Overview",
          isActive: activePage === "accounts.overview",
          onSelect: () => onSelect("accounts.overview")
        },
        {
          title: "Cash Book",
          isActive: activePage === "accounts.cash-book",
          onSelect: () => onSelect("accounts.cash-book")
        },
        {
          title: "Bank Book",
          isActive: activePage === "accounts.bank-book",
          onSelect: () => onSelect("accounts.bank-book")
        },
        {
          title: "Journals",
          isActive: activePage === "accounts.journal",
          onSelect: () => onSelect("accounts.journal")
        }
      ]
    };
  }
  if (appId === "billing") {
    return {
      icon: ReceiptTextIcon,
      isActive: activePage.startsWith("billing") || activePage.startsWith("core"),
      title: "Billing",
      items: [
        {
          title: "Overview",
          isActive: activePage === "billing.overview",
          onSelect: () => onSelect("billing.overview")
        },
        ...(billingFeatures?.quotation !== false
          ? [
              {
                title: "Quotation",
                isActive: activePage === "billing.quotation",
                onSelect: () => onSelect("billing.quotation")
              }
            ]
          : []),
        {
          title: "Sales",
          isActive: activePage === "billing.sales",
          onSelect: () => onSelect("billing.sales")
        },
        {
          title: "Purchase",
          isActive: activePage === "billing.purchase",
          onSelect: () => onSelect("billing.purchase")
        },
        ...(billingFeatures?.exportSales !== false
          ? [
              {
                title: "Export Sales",
                isActive: activePage === "billing.export-sales",
                onSelect: () => onSelect("billing.export-sales")
              }
            ]
          : []),
        {
          title: "Payment",
          isActive: activePage === "billing.payment",
          onSelect: () => onSelect("billing.payment")
        },
        {
          title: "Receipt",
          isActive: activePage === "billing.receipt",
          onSelect: () => onSelect("billing.receipt")
        },
        {
          icon: PackageIcon,
          title: "Master",
          isActive:
            activePage === "core.master.contact" ||
            activePage === "core.master.product" ||
            activePage === "core.master.work-order",
          items: [
            {
              title: "Contact",
              isActive: activePage === "core.master.contact",
              onSelect: () => onSelect("core.master.contact")
            },
            {
              title: "Product",
              isActive: activePage === "core.master.product",
              onSelect: () => onSelect("core.master.product")
            },
            {
              title: "Work Order",
              isActive: activePage === "core.master.work-order",
              onSelect: () => onSelect("core.master.work-order")
            }
          ]
        },
        {
          title: "Common",
          isActive: activePage.startsWith("core.common"),
          items: [
            {
              icon: MapPinnedIcon,
              title: "Location",
              isActive: activePage.startsWith("core.common.location"),
              items: [
                {
                  title: "Countries",
                  isActive: activePage === "core.common.location.countries",
                  onSelect: () => onSelect("core.common.location.countries")
                },
                {
                  title: "States",
                  isActive: activePage === "core.common.location.states",
                  onSelect: () => onSelect("core.common.location.states")
                },
                {
                  title: "Districts",
                  isActive: activePage === "core.common.location.districts",
                  onSelect: () => onSelect("core.common.location.districts")
                },
                {
                  title: "Cities",
                  isActive: activePage === "core.common.location.cities",
                  onSelect: () => onSelect("core.common.location.cities")
                },
                {
                  title: "Pincodes",
                  isActive: activePage === "core.common.location.pincodes",
                  onSelect: () => onSelect("core.common.location.pincodes")
                }
              ]
            },
            ...commonMasterMenuGroups(activePage, onSelect)
          ]
        },
        {
          title: "Billing Settings",
          isActive: activePage === "billing.settings",
          onSelect: () => onSelect("billing.settings")
        },
        {
          title: "Document Settings",
          isActive: activePage === "billing.document-settings",
          onSelect: () => onSelect("billing.document-settings")
        }
      ]
    };
  }

  return {
    icon: Building2Icon,
    isActive: activePage.startsWith("application") || activePage.startsWith("core.organisation"),
    title: "Application",
    items: [
      {
        title: "Overview",
        isActive: activePage === "application.overview",
        onSelect: () => onSelect("application.overview")
      },
      {
        title: "Application",
        isActive: activePage === "application.landing" || activePage === "application.profile",
        items: [
          {
            title: "Landing Desk",
            isActive: activePage === "application.landing",
            onSelect: () => onSelect("application.landing")
          },
          {
            title: "Platform Profile",
            isActive: activePage === "application.profile",
            onSelect: () => onSelect("application.profile")
          }
        ]
      },
      {
        icon: ShieldCheckIcon,
        title: "Access Control",
        isActive: activePage.startsWith("application.access"),
        items: [
          {
            title: "Users",
            isActive: activePage === "application.access.users",
            onSelect: () => onSelect("application.access.users")
          },
          {
            title: "Roles",
            isActive: activePage === "application.access.roles",
            onSelect: () => onSelect("application.access.roles")
          },
          {
            title: "Permissions",
            isActive: activePage === "application.access.permissions",
            onSelect: () => onSelect("application.access.permissions")
          },
          {
            title: "User Roles",
            isActive: activePage === "application.access.user-roles",
            onSelect: () => onSelect("application.access.user-roles")
          },
          {
            title: "Role Permissions",
            isActive: activePage === "application.access.role-permissions",
            onSelect: () => onSelect("application.access.role-permissions")
          },
          {
            title: "Access Control",
            isActive: activePage === "application.access.controls",
            onSelect: () => onSelect("application.access.controls")
          }
        ]
      },
      {
        icon: Building2Icon,
        title: "Organisation",
        isActive: activePage.startsWith("core.organisation"),
        items: [
          {
            title: "Company",
            isActive: activePage === "core.organisation.company",
            onSelect: () => onSelect("core.organisation.company")
          },
          {
            title: "Financial Years",
            isActive: activePage === "core.organisation.financial-year",
            onSelect: () => onSelect("core.organisation.financial-year")
          },
          {
            title: "Default Company",
            isActive: activePage === "core.organisation.default-company",
            onSelect: () => onSelect("core.organisation.default-company")
          }
        ]
      }
    ]
  };
}

export function appMenuItemsFor(
  appId: PlatformAppId,
  activePage: string,
  onSelect: (page: string) => void,
  billingFeatures?: BillingNavigationFeatures,
  crmCounts?: CrmNavigationCounts,
  billingEnabled = false,
  chatCounts?: ChatNavigationCounts,
  crmTaskCount = 0
): SidemenuItem[] {
  if (appId === "marketing")
    return [
      "brands",
      "campaigns",
      "email-campaigns",
      "conversations",
      "captures",
      "submissions",
      "leads",
      "qualifications",
      "conversions",
      "outcomes",
      "followups",
      "connections",
      "consents",
      "contents"
    ].map((key) => ({
      icon: Globe2Icon,
      title: key[0]!.toUpperCase() + key.slice(1),
      isActive: activePage === `marketing.${key}`,
      onSelect: () => onSelect(`marketing.${key}`)
    }));
  if (appId === "codeit") return codeitMenuItems(activePage, onSelect);
  if (appId === "codexsun") return codexsunMenuItems(activePage, onSelect);
  if (appId === "hrms")
    return [
      {
        icon: LayoutDashboardIcon,
        title: "Overview",
        isActive: activePage === "hrms.overview",
        onSelect: () => onSelect("hrms.overview")
      },
      {
        icon: UsersIcon,
        title: "Employees",
        isActive: activePage === "hrms.employees",
        onSelect: () => onSelect("hrms.employees")
      },
      {
        icon: ClipboardListIcon,
        title: "Attendance",
        isActive: activePage === "hrms.attendance",
        onSelect: () => onSelect("hrms.attendance")
      }
    ];
  if (appId === "docs")
    return [
      {
        icon: LayoutDashboardIcon,
        title: "Overview",
        isActive: activePage === "docs.overview",
        onSelect: () => onSelect("docs.overview")
      },
      {
        icon: FileTextIcon,
        title: "Developer Library",
        isActive: activePage === "docs.library",
        onSelect: () => onSelect("docs.library")
      },
      {
        icon: FileTextIcon,
        title: "Getting Started",
        isActive: activePage === "docs.guide",
        onSelect: () => onSelect("docs.guide")
      }
    ];
  if (appId === "himsx")
    return [
      {
        icon: LayoutDashboardIcon,
        title: "Overview",
        isActive: activePage === "himsx.overview",
        onSelect: () => onSelect("himsx.overview")
      },
      {
        icon: FileTextIcon,
        title: "Getting Started",
        isActive: activePage === "himsx.guide",
        onSelect: () => onSelect("himsx.guide")
      }
    ];
  if (appId === "sites")
    return [
      {
        icon: LayoutDashboardIcon,
        title: "Studio Dashboard",
        isActive: activePage === "sites.overview" || activePage === "sites.studio",
        onSelect: () => onSelect("sites.overview")
      },
      {
        icon: Globe2Icon,
        title: "Client Portfolios",
        isActive: activePage === "sites.sites",
        onSelect: () => onSelect("sites.sites")
      },
      {
        icon: FileTextIcon,
        title: "Guide",
        isActive: activePage === "sites.guide",
        onSelect: () => onSelect("sites.guide")
      }
    ];
  if (appId === "qcafe") {
    return [
      {
        icon: CoffeeIcon,
        title: "Overview",
        isActive: activePage === "qcafe.dashboard",
        onSelect: () => onSelect("qcafe.dashboard")
      },
      {
        icon: CoffeeIcon,
        title: "POS",
        isActive: activePage === "qcafe.overview",
        onSelect: () => onSelect("qcafe.overview")
      },
      {
        icon: ReceiptTextIcon,
        title: "KOT",
        isActive: activePage === "qcafe.kot",
        onSelect: () => onSelect("qcafe.kot")
      },
      {
        icon: ShoppingBagIcon,
        title: "Parcel - Take away",
        isActive: activePage === "qcafe.take-away",
        onSelect: () => onSelect("qcafe.take-away")
      },
      {
        icon: CalendarDaysIcon,
        title: "Booking",
        isActive: activePage === "qcafe.booking",
        onSelect: () => onSelect("qcafe.booking")
      },
      {
        icon: UtensilsCrossedIcon,
        title: "Kitchen",
        isActive: activePage === "qcafe.kitchen",
        onSelect: () => onSelect("qcafe.kitchen")
      },
      {
        icon: UtensilsCrossedIcon,
        title: "Master",
        isActive: activePage === "qcafe.menu",
        onSelect: () => onSelect("qcafe.menu")
      }
    ];
  }
  if (appId === "tconnect")
    return [
      {
        icon: UsersIcon,
        title: "Business network",
        isActive: activePage === "tconnect.overview",
        onSelect: () => onSelect("tconnect.overview")
      }
    ];
  if (appId === "sportsclub")
    return [
      {
        icon: LayoutDashboardIcon,
        title: "Overview",
        isActive: activePage === "sportsclub.overview",
        onSelect: () => onSelect("sportsclub.overview")
      },
      {
        icon: UsersIcon,
        title: "Students",
        isActive: activePage === "sportsclub.members",
        onSelect: () => onSelect("sportsclub.members")
      },
      {
        icon: ContactRoundIcon,
        title: "Masters",
        isActive: activePage === "sportsclub.masters",
        onSelect: () => onSelect("sportsclub.masters")
      },
      {
        icon: NotebookPenIcon,
        title: "Curriculum",
        isActive: activePage === "sportsclub.programs",
        onSelect: () => onSelect("sportsclub.programs")
      },
      {
        icon: CalendarDaysIcon,
        title: "Batches",
        isActive: activePage === "sportsclub.sessions",
        onSelect: () => onSelect("sportsclub.sessions")
      },
      {
        icon: ClipboardListIcon,
        title: "Attendance",
        isActive: activePage === "sportsclub.attendance",
        onSelect: () => onSelect("sportsclub.attendance")
      },
      {
        icon: SparklesIcon,
        title: "Assessments",
        isActive: activePage === "sportsclub.progress",
        onSelect: () => onSelect("sportsclub.progress")
      },
      {
        icon: TrophyIcon,
        title: "Events",
        isActive: activePage === "sportsclub.events",
        onSelect: () => onSelect("sportsclub.events")
      },
      {
        icon: MessageCircleIcon,
        title: "Admissions",
        isActive: activePage === "sportsclub.enquiries",
        onSelect: () => onSelect("sportsclub.enquiries")
      }
    ];
  if (appId === "ecommerce") {
    return ecommerceMenuItems(activePage, onSelect);
  }
  if (appId === "logicx-erp") {
    return [
      {
        icon: BoxesIcon,
        isActive: activePage === "logicx-erp.overview",
        onSelect: () => onSelect("logicx-erp.overview"),
        title: "Overview"
      },
      ...(billingEnabled
        ? [
            {
              icon: BadgePercentIcon,
              isActive: activePage === "logicx-erp.schemes",
              onSelect: () => onSelect("logicx-erp.schemes"),
              title: "Schemes"
            }
          ]
        : [])
    ];
  }
  if (appId === "zetro") {
    return [
      {
        icon: SparklesIcon,
        isActive: activePage === "zetro.chat",
        onSelect: () => onSelect("zetro.chat"),
        title: "Chat"
      }
    ];
  }
  if (appId === "frappe") {
    return [
      {
        icon: RefreshCwIcon,
        isActive: activePage === "frappe.overview",
        onSelect: () => onSelect("frappe.overview"),
        title: "Overview"
      },
      {
        icon: InboxIcon,
        isActive: [
          "frappe.contacts",
          "frappe.enquiries",
          "frappe.activities",
          "frappe.call-logs"
        ].includes(activePage),
        title: "Import",
        items: [
          {
            icon: ContactRoundIcon,
            isActive: activePage === "frappe.contacts",
            onSelect: () => onSelect("frappe.contacts"),
            title: "Import contacts"
          },
          {
            icon: ClipboardListIcon,
            isActive: activePage === "frappe.enquiries",
            onSelect: () => onSelect("frappe.enquiries"),
            title: "Import enquiries"
          },
          {
            icon: LogsIcon,
            isActive: activePage === "frappe.activities",
            onSelect: () => onSelect("frappe.activities"),
            title: "Import activities"
          },
          {
            icon: PhoneCallIcon,
            isActive: activePage === "frappe.call-logs",
            onSelect: () => onSelect("frappe.call-logs"),
            title: "Import call logs"
          }
        ]
      },
      {
        icon: SendIcon,
        isActive: [
          "frappe.export.contacts",
          "frappe.export.enquiries",
          "frappe.export.activities",
          "frappe.export.call-logs"
        ].includes(activePage),
        title: "Export",
        items: [
          {
            icon: ContactRoundIcon,
            isActive: activePage === "frappe.export.contacts",
            onSelect: () => onSelect("frappe.export.contacts"),
            title: "Export contacts"
          },
          {
            icon: ClipboardListIcon,
            isActive: activePage === "frappe.export.enquiries",
            onSelect: () => onSelect("frappe.export.enquiries"),
            title: "Export enquiries"
          },
          {
            icon: LogsIcon,
            isActive: activePage === "frappe.export.activities",
            onSelect: () => onSelect("frappe.export.activities"),
            title: "Export activities"
          },
          {
            icon: PhoneCallIcon,
            isActive: activePage === "frappe.export.call-logs",
            onSelect: () => onSelect("frappe.export.call-logs"),
            title: "Export call logs"
          }
        ]
      },
      {
        icon: Settings2Icon,
        isActive: [
          "frappe.availability",
          "frappe.live-sync",
          "frappe.live-sync-queue",
          "frappe.connection",
          "frappe.users",
          "frappe.user-mapping",
          "frappe.identity-audit"
        ].includes(activePage),
        title: "Frappe",
        items: [
          {
            icon: RefreshCwIcon,
            isActive: activePage === "frappe.live-sync",
            onSelect: () => onSelect("frappe.live-sync"),
            title: "Live sync"
          },
          {
            icon: LogsIcon,
            isActive: activePage === "frappe.live-sync-queue",
            onSelect: () => onSelect("frappe.live-sync-queue"),
            title: "Live sync queue"
          },
          {
            icon: Settings2Icon,
            isActive: activePage === "frappe.availability",
            onSelect: () => onSelect("frappe.availability"),
            title: "Server availability"
          },
          {
            icon: Settings2Icon,
            isActive: activePage === "frappe.connection",
            onSelect: () => onSelect("frappe.connection"),
            title: "Frappe connection"
          },
          {
            icon: UsersIcon,
            isActive: activePage === "frappe.users",
            onSelect: () => onSelect("frappe.users"),
            title: "Frappe users"
          },
          {
            icon: ContactRoundIcon,
            isActive: activePage === "frappe.user-mapping",
            onSelect: () => onSelect("frappe.user-mapping"),
            title: "User mapping"
          },
          {
            icon: ShieldCheckIcon,
            isActive: activePage === "frappe.identity-audit",
            onSelect: () => onSelect("frappe.identity-audit"),
            title: "Identity audit"
          }
        ]
      }
    ];
  }
  if (appId === "crm") {
    return [
      {
        icon: CircleGaugeIcon,
        isActive: activePage === "crm.overview",
        onSelect: () => onSelect("crm.overview"),
        title: "Overview"
      },
      {
        icon: ContactRoundIcon,
        isActive: activePage === "crm.contacts",
        onSelect: () => onSelect("crm.contacts"),
        title: "Contact"
      },
      {
        icon: UserRoundPlusIcon,
        title: "Leads",
        count: crmCounts?.leads,
        isActive: activePage === "crm.leads",
        onSelect: () => onSelect("crm.leads")
      },
      {
        icon: ClipboardListIcon,
        isActive: activePage === "crm.enquiries",
        onSelect: () => onSelect("crm.enquiries"),
        title: "Enquiries",
        count: crmCounts?.all
      },
      {
        icon: ListTodoIcon,
        isActive: activePage === "crm.tasks",
        onSelect: () => onSelect("crm.tasks"),
        title: "Tasks",
        count: crmTaskCount
      },
      {
        icon: BellIcon,
        isActive: activePage === "crm.reminders",
        onSelect: () => onSelect("crm.reminders"),
        title: "Reminder",
        count: crmCounts?.reminders
      },
      {
        icon: PhoneCallIcon,
        isActive: activePage === "crm.call-logs",
        onSelect: () => onSelect("crm.call-logs"),
        title: "Call Logs"
      },
      {
        icon: BarChart3Icon,
        isActive: activePage === "crm.reports",
        onSelect: () => onSelect("crm.reports"),
        title: "List in"
      },
      {
        icon: LogsIcon,
        isActive: activePage === "crm.activities",
        onSelect: () => onSelect("crm.activities"),
        title: "Activities"
      },
      {
        icon: BookOpenCheckIcon,
        isActive: activePage === "crm.sops",
        onSelect: () => onSelect("crm.sops"),
        title: "SOPs"
      },
      {
        icon: BriefcaseBusinessIcon,
        isActive: activePage === "crm.duties",
        onSelect: () => onSelect("crm.duties"),
        title: "Duties"
      },
      {
        icon: BarChart3Icon,
        isActive: activePage === "crm.duty-reporting",
        onSelect: () => onSelect("crm.duty-reporting"),
        title: "Duty Reporting"
      }
    ];
  }
  if (appId === "auditor") {
    return [
      {
        icon: ShieldCheckIcon,
        isActive: activePage === "auditor.overview",
        onSelect: () => onSelect("auditor.overview"),
        title: "Overview"
      },
      {
        icon: ContactRoundIcon,
        isActive: activePage === "auditor.clients",
        onSelect: () => onSelect("auditor.clients"),
        title: "Clients"
      }
    ];
  }
  if (appId === "task-manager") {
    return [
      {
        icon: CircleGaugeIcon,
        isActive: activePage === "task-manager.overview",
        onSelect: () => onSelect("task-manager.overview"),
        title: "Overview"
      },
      {
        icon: ClipboardListIcon,
        isActive: activePage === "task-manager.todos",
        onSelect: () => onSelect("task-manager.todos"),
        title: "Todo"
      }
    ];
  }
  if (appId === "mail") {
    return [
      {
        icon: InboxIcon,
        isActive: activePage === "mail.inbox" || activePage === "mail.overview",
        onSelect: () => onSelect("mail.inbox"),
        title: "Inbox"
      },
      {
        icon: SendIcon,
        isActive: activePage === "mail.outbox",
        onSelect: () => onSelect("mail.outbox"),
        title: "Outbox"
      },
      {
        icon: FileTextIcon,
        isActive: activePage === "mail.drafts",
        onSelect: () => onSelect("mail.drafts"),
        title: "Drafts"
      },
      {
        icon: Clock3Icon,
        isActive: activePage === "mail.scheduled",
        onSelect: () => onSelect("mail.scheduled"),
        title: "Scheduled"
      },
      {
        icon: ArchiveIcon,
        isActive: activePage === "mail.sent",
        onSelect: () => onSelect("mail.sent"),
        title: "Sent"
      },
      {
        icon: AlertTriangleIcon,
        isActive: activePage === "mail.failed",
        onSelect: () => onSelect("mail.failed"),
        title: "Failed"
      },
      {
        icon: Trash2Icon,
        isActive: activePage === "mail.trash",
        onSelect: () => onSelect("mail.trash"),
        title: "Trash"
      }
    ];
  }
  if (appId === "notes") {
    return [
      {
        icon: NotebookPenIcon,
        isActive: activePage === "notes.overview",
        onSelect: () => onSelect("notes.overview"),
        title: "Notes"
      }
    ];
  }
  if (appId === "chat") {
    const unread = chatCounts?.total ?? chatCounts?.direct;
    return [
      {
        icon: MessageCircleIcon,
        isActive: activePage.startsWith("chat"),
        onSelect: () => onSelect("chat.direct"),
        title: "Chat",
        count: unread && unread > 0 ? unread : undefined
      }
    ];
  }
  if (appId === "accounts") {
    return [
      {
        icon: CircleGaugeIcon,
        isActive: activePage === "accounts.overview",
        onSelect: () => onSelect("accounts.overview"),
        title: "Overview"
      },
      {
        icon: LandmarkIcon,
        isActive:
          activePage === "accounts.journal" ||
          activePage === "accounts.cash-book" ||
          activePage === "accounts.bank-book",
        title: "Accounting",
        items: [
          {
            title: "Cash Book",
            isActive: activePage === "accounts.cash-book",
            onSelect: () => onSelect("accounts.cash-book")
          },
          {
            title: "Bank Book",
            isActive: activePage === "accounts.bank-book",
            onSelect: () => onSelect("accounts.bank-book")
          },
          {
            title: "Journals",
            isActive: activePage === "accounts.journal",
            onSelect: () => onSelect("accounts.journal")
          }
        ]
      }
    ];
  }
  if (appId === "billing") {
    return [
      {
        icon: CircleGaugeIcon,
        isActive: activePage === "billing.overview",
        onSelect: () => onSelect("billing.overview"),
        title: "Overview"
      },
      {
        icon: ReceiptTextIcon,
        isActive:
          activePage === "billing.quotation" ||
          activePage === "billing.sales" ||
          activePage === "billing.purchase" ||
          activePage === "billing.export-sales" ||
          activePage === "billing.payment" ||
          activePage === "billing.receipt",
        title: "Billing",
        items: [
          ...(billingFeatures?.quotation !== false
            ? [
                {
                  title: "Quotation",
                  isActive: activePage === "billing.quotation",
                  onSelect: () => onSelect("billing.quotation")
                }
              ]
            : []),
          {
            title: "Sales",
            isActive: activePage === "billing.sales",
            onSelect: () => onSelect("billing.sales")
          },
          {
            title: "Purchase",
            isActive: activePage === "billing.purchase",
            onSelect: () => onSelect("billing.purchase")
          },
          ...(billingFeatures?.exportSales !== false
            ? [
                {
                  title: "Export Sales",
                  isActive: activePage === "billing.export-sales",
                  onSelect: () => onSelect("billing.export-sales")
                }
              ]
            : []),
          {
            title: "Payment",
            isActive: activePage === "billing.payment",
            onSelect: () => onSelect("billing.payment")
          },
          {
            title: "Receipt",
            isActive: activePage === "billing.receipt",
            onSelect: () => onSelect("billing.receipt")
          }
        ]
      },
      {
        icon: BarChart3Icon,
        isActive: activePage.startsWith("billing.reports."),
        title: "Report",
        items: [
          {
            title: "Customer Statement",
            isActive: activePage === "billing.reports.customer-statement",
            onSelect: () => onSelect("billing.reports.customer-statement")
          },
          {
            title: "Customer Summary",
            isActive: activePage === "billing.reports.customer-summary",
            onSelect: () => onSelect("billing.reports.customer-summary")
          },
          {
            title: "Supplier Statement",
            isActive: activePage === "billing.reports.supplier-statement",
            onSelect: () => onSelect("billing.reports.supplier-statement")
          },
          {
            title: "Supplier Summary",
            isActive: activePage === "billing.reports.supplier-summary",
            onSelect: () => onSelect("billing.reports.supplier-summary")
          },
          {
            title: "Stock Statement",
            isActive: activePage === "billing.reports.stock-statement",
            onSelect: () => onSelect("billing.reports.stock-statement")
          },
          {
            title: "GST Statement",
            isActive: activePage === "billing.reports.gst-statement",
            onSelect: () => onSelect("billing.reports.gst-statement")
          }
        ]
      },
      {
        icon: PackageIcon,
        isActive:
          activePage === "core.master.contact" ||
          activePage === "core.master.product" ||
          activePage === "core.master.work-order",
        title: "Master",
        items: [
          {
            title: "Contact",
            isActive: activePage === "core.master.contact",
            onSelect: () => onSelect("core.master.contact")
          },
          {
            title: "Product",
            isActive: activePage === "core.master.product",
            onSelect: () => onSelect("core.master.product")
          },
          {
            title: "Work Order",
            isActive: activePage === "core.master.work-order",
            onSelect: () => onSelect("core.master.work-order")
          }
        ]
      },
      {
        icon: Globe2Icon,
        isActive: activePage.startsWith("core.common"),
        title: "Common",
        items: [
          {
            icon: MapPinnedIcon,
            title: "Location",
            isActive: activePage.startsWith("core.common.location"),
            items: [
              {
                title: "Countries",
                isActive: activePage === "core.common.location.countries",
                onSelect: () => onSelect("core.common.location.countries")
              },
              {
                title: "States",
                isActive: activePage === "core.common.location.states",
                onSelect: () => onSelect("core.common.location.states")
              },
              {
                title: "Districts",
                isActive: activePage === "core.common.location.districts",
                onSelect: () => onSelect("core.common.location.districts")
              },
              {
                title: "Cities",
                isActive: activePage === "core.common.location.cities",
                onSelect: () => onSelect("core.common.location.cities")
              },
              {
                title: "Pincodes",
                isActive: activePage === "core.common.location.pincodes",
                onSelect: () => onSelect("core.common.location.pincodes")
              }
            ]
          },
          ...commonMasterMenuGroups(activePage, onSelect)
        ]
      },
      {
        icon: Settings2Icon,
        isActive: activePage === "billing.settings" || activePage === "billing.document-settings",
        title: "Settings",
        items: [
          {
            title: "Billing Settings",
            isActive: activePage === "billing.settings",
            onSelect: () => onSelect("billing.settings")
          },
          {
            title: "Document Settings",
            isActive: activePage === "billing.document-settings",
            onSelect: () => onSelect("billing.document-settings")
          }
        ]
      }
    ];
  }

  return [
    {
      icon: CircleGaugeIcon,
      isActive: activePage === "application.overview",
      onSelect: () => onSelect("application.overview"),
      title: "Overview"
    },
    {
      icon: ShieldCheckIcon,
      isActive: activePage.startsWith("application.access"),
      title: "Access Control",
      items: [
        {
          title: "Users",
          isActive: activePage === "application.access.users",
          onSelect: () => onSelect("application.access.users")
        },
        {
          title: "Roles",
          isActive: activePage === "application.access.roles",
          onSelect: () => onSelect("application.access.roles")
        },
        {
          title: "Permissions",
          isActive: activePage === "application.access.permissions",
          onSelect: () => onSelect("application.access.permissions")
        },
        {
          title: "User Roles",
          isActive: activePage === "application.access.user-roles",
          onSelect: () => onSelect("application.access.user-roles")
        },
        {
          title: "Role Permissions",
          isActive: activePage === "application.access.role-permissions",
          onSelect: () => onSelect("application.access.role-permissions")
        },
        {
          title: "Access Control",
          isActive: activePage === "application.access.controls",
          onSelect: () => onSelect("application.access.controls")
        }
      ]
    },
    {
      icon: Building2Icon,
      isActive: activePage === "application.landing" || activePage === "application.profile",
      title: "Application",
      items: [
        {
          title: "Landing Desk",
          isActive: activePage === "application.landing",
          onSelect: () => onSelect("application.landing")
        },
        {
          title: "Platform Profile",
          isActive: activePage === "application.profile",
          onSelect: () => onSelect("application.profile")
        }
      ]
    },
    {
      icon: Building2Icon,
      isActive: activePage.startsWith("core.organisation"),
      title: "Organisation",
      items: [
        {
          title: "Company",
          isActive: activePage === "core.organisation.company",
          onSelect: () => onSelect("core.organisation.company")
        },
        {
          title: "Financial Years",
          isActive: activePage === "core.organisation.financial-year",
          onSelect: () => onSelect("core.organisation.financial-year")
        },
        {
          title: "Default Company",
          isActive: activePage === "core.organisation.default-company",
          onSelect: () => onSelect("core.organisation.default-company")
        }
      ]
    }
  ];
}

function codexsunMenuItems(activePage: string, onSelect: (page: string) => void): SidemenuItem[] {
  return [
    {
      icon: SparklesIcon,
      title: "Zuno Front Desk",
      isActive: activePage === "codexsun.frontdesk",
      onSelect: () => onSelect("codexsun.frontdesk")
    },
    {
      icon: LayoutDashboardIcon,
      title: "Desktop Workspace",
      isActive: activePage === "codexsun.workspace",
      onSelect: () => onSelect("codexsun.workspace")
    },
    {
      icon: ShieldCheckIcon,
      title: "Mobile Approvals",
      isActive: activePage === "codexsun.approvals",
      onSelect: () => onSelect("codexsun.approvals")
    }
  ];
}

export const deskAddonAppIds: PlatformAppId[] = ["notes", "chat"];

export function appWorkspaceItems(enabledApps: PlatformAppId[], activeApp: PlatformAppId) {
  return platformAppRegistry
    .filter((app) => enabledApps.includes(app.id))
    .map((app) => ({
      active: app.id === activeApp,
      appId: app.id,
      description: app.description,
      icon: app.icon,
      title: app.label,
      url: appRootUrl(app.id)
    }));
}

export const applicationPageIcons = {
  application: Building2Icon,
  billing: CreditCardIcon,
  mail: MailIcon,
  taskManager: ClipboardListIcon
};

function commonMasterMenuGroups(
  activePage: string,
  onSelect: (page: string) => void
): SidemenuItem[] {
  const groups = [
    {
      icon: LandmarkIcon,
      id: "accounts",
      label: "Accounts",
      pages: [
        ["Ledger Groups", "core.common.accounts.ledger-groups"],
        ["Ledgers", "core.common.accounts.ledgers"]
      ]
    },
    {
      icon: UsersIcon,
      id: "contacts",
      label: "Contacts",
      pages: [
        ["Contact Groups", "core.common.contacts.contact-groups"],
        ["Contact Types", "core.common.contacts.contact-types"],
        ["Address Types", "core.common.contacts.address-types"],
        ["Bank Names", "core.common.contacts.bank-names"]
      ]
    },
    {
      icon: PackageIcon,
      id: "products",
      label: "Product",
      pages: [
        ["Product Groups", "core.common.products.product-groups"],
        ["Product Categories", "core.common.products.product-categories"],
        ["Product Types", "core.common.products.product-types"],
        ["Units", "core.common.products.units"],
        ["HSN Codes", "core.common.products.hsn-codes"],
        ["Taxes", "core.common.products.taxes"],
        ["Brands", "core.common.products.brands"],
        ["Colours", "core.common.products.colours"],
        ["Sizes", "core.common.products.sizes"],
        ["Styles", "core.common.products.styles"]
      ]
    },
    {
      icon: ClipboardListIcon,
      id: "workorder",
      label: "Work Orders",
      pages: [
        ["Work Order Types", "core.common.workorder.work-order-types"],
        ["Transports", "core.common.workorder.transports"],
        ["Warehouses", "core.common.workorder.warehouses"],
        ["Destinations", "core.common.workorder.destinations"],
        ["Stock Rejection Types", "core.common.workorder.stock-rejection-types"]
      ]
    },
    {
      icon: Settings2Icon,
      id: "others",
      label: "Others",
      pages: [
        ["Currencies", "core.common.others.currencies"],
        ["Priorities", "core.common.others.priorities"],
        ["Payment Terms", "core.common.others.payment-terms"],
        ["Sales Types", "core.common.others.sales-types"],
        ["Months", "core.common.others.months"]
      ]
    }
  ] as const;
  return groups.map((group) => ({
    icon: group.icon,
    isActive: activePage.startsWith(`core.common.${group.id}.`),
    items: group.pages.map(([title, page]) => ({
      isActive: activePage === page,
      onSelect: () => onSelect(page),
      title
    })),
    title: group.label
  }));
}

function codeitMenuItems(activePage: string, onSelect: (page: string) => void): SidemenuItem[] {
  return [
    {
      title: "Overview",
      icon: LayoutDashboardIcon,
      isActive: activePage === "codeit.overview",
      onSelect: () => onSelect("codeit.overview")
    },
    {
      title: "Settings",
      icon: Settings2Icon,
      isActive: activePage === "codeit.settings",
      onSelect: () => onSelect("codeit.settings")
    }
  ];
}
