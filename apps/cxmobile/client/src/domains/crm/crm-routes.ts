/**
 * CRM Route Registry, Metadata, and Permission Boundary
 * Strictly models M0 CRM parity while masking Contact-360 and enforcing local task scope.
 */

import type { CrmPermissionKey, CrmRouteKey, CrmRouteMetadata, CrmRouteSection } from "./types.js";

export class CrmPermissionDeniedError extends Error {
  public readonly requiredPermission: string;
  public readonly routeKey?: string | undefined;

  constructor(message: string, requiredPermission: string, routeKey?: string | undefined) {
    super(message);
    this.name = "CrmPermissionDeniedError";
    this.requiredPermission = requiredPermission;
    this.routeKey = routeKey;
  }
}

export const CRM_ROUTE_REGISTRY: Record<CrmRouteKey, CrmRouteMetadata> = {
  "crm.overview": {
    description: "Operational overview, count cards, daily attention, and recent activity summaries.",
    id: "crm.overview",
    label: "Overview",
    requiredPermissions: ["crm.enquiry.view"],
    section: "pipeline",
    shortTitle: "Overview"
  },
  "crm.my-job": {
    description: "Enquiries currently assigned to the active user.",
    id: "crm.my-job",
    label: "My Job",
    requiredPermissions: ["crm.enquiry.view"],
    section: "pipeline",
    shortTitle: "My Job"
  },
  "crm.my-calls": {
    description: "Enquiries logged and created by the active user.",
    id: "crm.my-calls",
    label: "My Calls",
    requiredPermissions: ["crm.enquiry.view"],
    section: "pipeline",
    shortTitle: "My Calls"
  },
  "crm.enquiries": {
    description: "Tenant customer enquiries pipeline, stages, priorities, and filters.",
    id: "crm.enquiries",
    label: "Enquiries",
    requiredPermissions: ["crm.enquiry.view"],
    section: "pipeline",
    shortTitle: "Enquiries"
  },
  "crm.enquiries.new": {
    description: "Create new customer enquiry with customer details and requirements.",
    id: "crm.enquiries.new",
    label: "New Enquiry",
    requiredPermissions: ["crm.enquiry.view"],
    section: "pipeline",
    shortTitle: "New Enquiry"
  },
  "crm.enquiries.show": {
    description: "Enquiry details, comments, attachments, assignment, job timers, and closure.",
    id: "crm.enquiries.show",
    label: "Enquiry Details",
    requiredPermissions: ["crm.enquiry.view"],
    section: "pipeline",
    shortTitle: "Enquiry Details"
  },
  "crm.leads": {
    description: "Marketing leads intake, campaign forms, and lead qualification.",
    id: "crm.leads",
    label: "Leads",
    requiredPermissions: ["crm.lead.view"],
    section: "pipeline",
    shortTitle: "Leads"
  },
  "crm.tasks": {
    description: "CRM deliverables and tasks with local record scoping.",
    id: "crm.tasks",
    isLocalScopeOnly: true,
    label: "Tasks",
    requiredPermissions: ["crm.task.view"],
    section: "operations",
    shortTitle: "Tasks"
  },
  "crm.tasks.new": {
    description: "Create and assign task with target due date and contact association.",
    id: "crm.tasks.new",
    isLocalScopeOnly: true,
    label: "New Task",
    requiredPermissions: ["crm.task.create"],
    section: "operations",
    shortTitle: "New Task"
  },
  "crm.tasks.show": {
    description: "Task properties, work jobs timer, comments, and closure request.",
    id: "crm.tasks.show",
    isLocalScopeOnly: true,
    label: "Task Details",
    requiredPermissions: ["crm.task.view"],
    section: "operations",
    shortTitle: "Task Details"
  },
  "crm.duties": {
    description: "Active shift duty roster and SOP instructions assigned to current user.",
    id: "crm.duties",
    label: "My Duties",
    requiredPermissions: ["crm.duty.view.own"],
    section: "operations",
    shortTitle: "Duties"
  },
  "crm.duty-reporting": {
    description: "Field shift execution report submission and compliance metrics.",
    id: "crm.duty-reporting",
    label: "Duty Reporting",
    requiredPermissions: ["crm.duty-report.view.own", "crm.duty-report.create.own"],
    section: "operations",
    shortTitle: "Reporting"
  },
  "crm.schedules": {
    description: "Calendar appointments and scheduled follow-ups across CRM records.",
    id: "crm.schedules",
    label: "Schedules",
    requiredPermissions: ["crm.schedule.view"],
    section: "operations",
    shortTitle: "Schedules"
  },
  "crm.reminders": {
    description: "Due reminders, time-sensitive alerts, and mobile notifications.",
    id: "crm.reminders",
    label: "Reminders",
    requiredPermissions: ["crm.schedule.view"],
    section: "operations",
    shortTitle: "Reminders"
  },
  "crm.call-logs": {
    description: "Manual phone call notes, call outcomes, and caller tracking.",
    id: "crm.call-logs",
    label: "Call Logs",
    requiredPermissions: ["crm.call-log.view"],
    section: "operations",
    shortTitle: "Call Logs"
  },
  "crm.sops": {
    description: "Standard Operating Procedures catalog, revisions, and publishing.",
    id: "crm.sops",
    label: "SOPs",
    requiredPermissions: ["crm.sop.view"],
    section: "compliance",
    shortTitle: "SOPs"
  },
  "crm.duty-assignment": {
    description: "Staff duty assignments, recurring rosters, and scheduling administration.",
    id: "crm.duty-assignment",
    label: "Duty Assignment",
    requiredPermissions: ["crm.duty.assign"],
    section: "compliance",
    shortTitle: "Duty Roster"
  },
  "crm.closures": {
    description: "Managerial review and approval/rejection queue for enquiry and task closures.",
    id: "crm.closures",
    label: "Closure Approvals",
    requiredPermissions: ["crm.closure.review"],
    section: "compliance",
    shortTitle: "Closures"
  },
  "crm.activities": {
    description: "Tenant-wide audit activity stream across pipeline and operational actions.",
    id: "crm.activities",
    label: "Activities",
    requiredPermissions: ["crm.enquiry.view"],
    section: "compliance",
    shortTitle: "Activities"
  },
  "crm.reports": {
    description: "Operational and pipeline analytics: list-in, creator, assignee, and status breakdowns.",
    id: "crm.reports",
    label: "Reports",
    requiredPermissions: ["crm.enquiry.view-all"],
    section: "masters",
    shortTitle: "Reports"
  },
  "crm.contacts": {
    description: "Customer and organization contacts linked with CRM transactions.",
    id: "crm.contacts",
    label: "Contacts",
    requiredPermissions: ["crm.contact.view"],
    section: "masters",
    shortTitle: "Contacts"
  },
  "crm.list-in": {
    description: "Master table for Lead Sources / List-In categories.",
    id: "crm.list-in",
    label: "Lead Sources",
    requiredPermissions: ["admin"],
    section: "masters",
    shortTitle: "Lead Sources"
  },
  "crm.status": {
    description: "Master table for Enquiry pipeline lifecycle statuses.",
    id: "crm.status",
    label: "Statuses",
    requiredPermissions: ["admin"],
    section: "masters",
    shortTitle: "Statuses"
  },
  "crm.priority": {
    description: "Master table for Enquiry priority tiers.",
    id: "crm.priority",
    label: "Priorities",
    requiredPermissions: ["admin"],
    section: "masters",
    shortTitle: "Priorities"
  },
  "crm.contact-360": {
    description: "Unfinished 360 customer profile tabs. Kept strictly masked and hidden.",
    id: "crm.contact-360",
    isMasked: true,
    label: "Contact 360",
    requiredPermissions: ["admin"],
    section: "masters",
    shortTitle: "Contact 360"
  }
};

/**
 * Checks if the caller has at least one of the required permissions.
 */
export function hasRequiredPermission(
  required: CrmPermissionKey[],
  hasPermissionFn: (perm: string) => boolean
): boolean {
  if (required.length === 0) return true;
  // If user is super-admin or admin, grant access
  if (hasPermissionFn("super-admin") || hasPermissionFn("admin")) return true;
  return required.some((perm) => hasPermissionFn(perm));
}

/**
 * Asserts permission, throwing CrmPermissionDeniedError if not granted.
 */
export function assertCrmPermission(
  required: CrmPermissionKey | CrmPermissionKey[],
  hasPermissionFn: (perm: string) => boolean,
  routeKey?: CrmRouteKey
): void {
  const perms = Array.isArray(required) ? required : [required];
  if (!hasRequiredPermission(perms, hasPermissionFn)) {
    throw new CrmPermissionDeniedError(
      `Permission denied: Action requires [${perms.join(", ")}].`,
      perms[0] ?? "unknown",
      routeKey
    );
  }
}

/**
 * Returns all accessible CRM routes for navigation.
 * Excludes masked routes (e.g. Contact 360) and routes where user lacks permissions.
 */
export function getAccessibleCrmRoutes(
  hasPermissionFn: (perm: string) => boolean
): CrmRouteMetadata[] {
  return Object.values(CRM_ROUTE_REGISTRY).filter((route) => {
    // 1. Contact 360 is strictly masked/hidden
    if (route.isMasked) return false;
    // 2. Must satisfy permission check
    return hasRequiredPermission(route.requiredPermissions, hasPermissionFn);
  });
}

/**
 * Group accessible routes by section for mobile navigation tabs.
 */
export function getCrmRoutesBySection(
  hasPermissionFn: (perm: string) => boolean
): Record<CrmRouteSection, CrmRouteMetadata[]> {
  const routes = getAccessibleCrmRoutes(hasPermissionFn);
  const grouped: Record<CrmRouteSection, CrmRouteMetadata[]> = {
    compliance: [],
    masters: [],
    operations: [],
    pipeline: []
  };

  for (const route of routes) {
    grouped[route.section].push(route);
  }

  return grouped;
}
