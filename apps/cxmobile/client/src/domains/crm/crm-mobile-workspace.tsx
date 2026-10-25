import React, { useState } from "react";
import {
  BriefcaseIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  FilterIcon,
  LockIcon,
  ShieldAlertIcon
} from "lucide-react";
import { useNativeSession } from "../../app/native-session-provider.js";
import {
  CRM_ROUTE_REGISTRY,
  getCrmRoutesBySection,
  hasRequiredPermission
} from "./crm-routes.js";
import type { CrmRouteKey, CrmRouteSection } from "./types.js";

// Workspaces from @codexsun/crm-web public contracts
import { CrmOverviewWorkspace } from "@codexsun/crm-web/modules/overview";
import { EnquiryWorkspace } from "@codexsun/crm-web/modules/enquiry";
import { LeadWorkspace } from "@codexsun/crm-web";
import { TaskWorkspace } from "@codexsun/crm-web/modules/task";
import { ActivitiesWorkspace } from "@codexsun/crm-web/modules/activities";
import { ClosureWorkspace } from "@codexsun/crm-web/modules/closure";
import { SchedulerWorkspace } from "@codexsun/crm-web/modules/scheduler";
import { CallLogWorkspace } from "@codexsun/crm-web/modules/call-log";
import { SopWorkspace } from "@codexsun/crm-web/modules/sop";
import { DutyAssignmentWorkspace } from "@codexsun/crm-web/modules/duty-assignment";
import { DutyReportingWorkspace } from "@codexsun/crm-web/modules/duties";
import { CrmReportsWorkspace } from "@codexsun/crm-web/modules/reports";
import { CrmContactWorkspace } from "@codexsun/crm-web/modules/contact";
import { ListInWorkspace } from "@codexsun/crm-web/modules/list-in";
import { StatusWorkspace } from "@codexsun/crm-web/modules/status";
import { PriorityWorkspace } from "@codexsun/crm-web/modules/priority";

const SECTION_LABELS: Record<CrmRouteSection, { icon: React.ReactNode; label: string }> = {
  pipeline: {
    icon: <BriefcaseIcon className="size-3.5" />,
    label: "Pipeline"
  },
  operations: {
    icon: <ClipboardListIcon className="size-3.5" />,
    label: "Tasks & Field"
  },
  compliance: {
    icon: <CheckCircle2Icon className="size-3.5" />,
    label: "Operations & Quality"
  },
  masters: {
    icon: <FilterIcon className="size-3.5" />,
    label: "Intelligence & Masters"
  }
};

export interface CrmMobileWorkspaceProps {
  initialRoute?: CrmRouteKey;
  onNavigateRoute?: (route: CrmRouteKey) => void;
}

export function CrmMobileWorkspace({
  initialRoute = "crm.overview",
  onNavigateRoute
}: CrmMobileWorkspaceProps) {
  const { hasPermission, session } = useNativeSession();

  const [activeSection, setActiveSection] = useState<CrmRouteSection>("pipeline");
  const [activeRoute, setActiveRoute] = useState<CrmRouteKey>(initialRoute);
  const [selectedEnquiryId, setSelectedEnquiryId] = useState<string | null>(null);
  const [isCreatingEnquiry, setIsCreatingEnquiry] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  const sections = getCrmRoutesBySection(hasPermission);
  const currentRouteMeta = CRM_ROUTE_REGISTRY[activeRoute];

  function handleSelectRoute(routeKey: CrmRouteKey) {
    const meta = CRM_ROUTE_REGISTRY[routeKey];
    if (meta) {
      setActiveSection(meta.section);
    }
    setActiveRoute(routeKey);
    setSelectedEnquiryId(null);
    setIsCreatingEnquiry(false);
    setSelectedTaskId(null);
    setIsCreatingTask(false);
    onNavigateRoute?.(routeKey);
  }

  const isPermitted =
    currentRouteMeta &&
    !currentRouteMeta.isMasked &&
    hasRequiredPermission(currentRouteMeta.requiredPermissions, hasPermission);

  const currentUserName = session?.name ?? session?.email ?? "Staff User";

  return (
    <div className="flex flex-col min-h-full bg-slate-950 text-slate-100" data-testid="crm-mobile-workspace">
      {/* 1. Mobile Sub-Route Header & Segment Navigation */}
      <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/95 backdrop-blur px-3 py-2">
        {/* Section Segmented Control */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1.5" role="tablist">
          {(["pipeline", "operations", "compliance", "masters"] as CrmRouteSection[]).map((sec) => {
            const isActive = activeSection === sec;
            const count = sections[sec].length;
            if (count === 0) return null;

            return (
              <button
                key={sec}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveSection(sec);
                  const firstRoute = sections[sec][0]?.id;
                  if (firstRoute) handleSelectRoute(firstRoute);
                }}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-sky-600 text-white shadow-sm"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                {SECTION_LABELS[sec].icon}
                <span>{SECTION_LABELS[sec].label}</span>
                <span className={`text-[10px] rounded-full px-1.5 py-0.2 ${isActive ? "bg-sky-700 text-sky-100" : "bg-slate-700 text-slate-400"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sub-Route Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {sections[activeSection].map((route) => {
            const isSelected = activeRoute === route.id;
            return (
              <button
                key={route.id}
                type="button"
                onClick={() => handleSelectRoute(route.id)}
                className={`whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  isSelected
                    ? "bg-slate-100 text-slate-900 font-semibold"
                    : "bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {route.shortTitle}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Operational Context Bar */}
      <div className="flex items-center justify-between border-b border-slate-800/60 bg-slate-900/40 px-3 py-1.5 text-[11px] text-slate-400">
        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold text-slate-200">{currentRouteMeta?.label ?? "CRM"}</span>
          {currentRouteMeta?.isLocalScopeOnly && (
            <span className="rounded bg-amber-950/80 border border-amber-800 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
              Local Task Scope
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-500">
          {currentUserName}
        </div>
      </div>

      {/* 3. Main Route Content View */}
      <div className="flex-1 p-2 md:p-4">
        {/* Contact 360 Masking Guard */}
        {currentRouteMeta?.isMasked ? (
          <div className="my-6 rounded-lg border border-amber-800/60 bg-amber-950/30 p-4 text-center">
            <LockIcon className="mx-auto size-8 text-amber-400 mb-2" />
            <h3 className="text-sm font-semibold text-amber-200">Contact-360 Masked</h3>
            <p className="mt-1 text-xs text-amber-400/80 max-w-sm mx-auto">
              CRM Contact-360 profile tabs remain masked and hidden in the cxmobile client per product specification.
            </p>
          </div>
        ) : !isPermitted ? (
          /* Permission Denial Card */
          <div className="my-6 rounded-lg border border-rose-800/60 bg-rose-950/30 p-4 text-center">
            <ShieldAlertIcon className="mx-auto size-8 text-rose-400 mb-2" />
            <h3 className="text-sm font-semibold text-rose-200">Access Denied</h3>
            <p className="mt-1 text-xs text-rose-400/80 max-w-sm mx-auto">
              You do not have the required role or permission (
              <code className="text-rose-300">{currentRouteMeta?.requiredPermissions.join(", ")}</code>
              ) to access this workflow.
            </p>
            <button
              type="button"
              onClick={() => handleSelectRoute("crm.overview")}
              className="mt-3 inline-flex items-center gap-1.5 rounded bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
            >
              Return to Overview
            </button>
          </div>
        ) : (
          /* Render Active Route Workspace */
          <div className="crm-workspace-container">
            {activeRoute === "crm.overview" && (
              <CrmOverviewWorkspace
                currentUserName={currentUserName}
                onOpenPage={(target) => {
                  if (target in CRM_ROUTE_REGISTRY) {
                    handleSelectRoute(target as CrmRouteKey);
                  }
                }}
              />
            )}

            {activeRoute === "crm.my-job" && (
              <EnquiryWorkspace
                scope="assigned"
                initialCreate={isCreatingEnquiry}
                initialRecordKey={selectedEnquiryId ?? undefined}
                onOpenRecord={(key) => setSelectedEnquiryId(key)}
                onCloseCreate={() => setIsCreatingEnquiry(false)}
              />
            )}

            {activeRoute === "crm.my-calls" && (
              <EnquiryWorkspace
                scope="created"
                initialCreate={isCreatingEnquiry}
                initialRecordKey={selectedEnquiryId ?? undefined}
                onOpenRecord={(key) => setSelectedEnquiryId(key)}
                onCloseCreate={() => setIsCreatingEnquiry(false)}
              />
            )}

            {activeRoute === "crm.enquiries" && (
              <EnquiryWorkspace
                scope="all"
                initialCreate={isCreatingEnquiry}
                initialRecordKey={selectedEnquiryId ?? undefined}
                onOpenRecord={(key) => setSelectedEnquiryId(key)}
                onCloseCreate={() => setIsCreatingEnquiry(false)}
              />
            )}

            {activeRoute === "crm.enquiries.new" && (
              <EnquiryWorkspace
                scope="all"
                initialCreate={true}
                onCloseCreate={() => handleSelectRoute("crm.enquiries")}
              />
            )}

            {activeRoute === "crm.enquiries.show" && (
              <EnquiryWorkspace
                scope="all"
                initialRecordKey={selectedEnquiryId ?? "1"}
                onOpenRecord={(key) => setSelectedEnquiryId(key)}
              />
            )}

            {activeRoute === "crm.leads" && (
              <LeadWorkspace />
            )}

            {activeRoute === "crm.tasks" && (
              <TaskWorkspace
                initialCreate={isCreatingTask}
                initialRecordKey={selectedTaskId ?? undefined}
                onOpenRecord={(key) => setSelectedTaskId(key)}
                onCloseCreate={() => setIsCreatingTask(false)}
              />
            )}

            {activeRoute === "crm.tasks.new" && (
              <TaskWorkspace
                initialCreate={true}
                onCloseCreate={() => handleSelectRoute("crm.tasks")}
              />
            )}

            {activeRoute === "crm.tasks.show" && (
              <TaskWorkspace
                initialRecordKey={selectedTaskId ?? "1"}
                onOpenRecord={(key) => setSelectedTaskId(key)}
              />
            )}

            {activeRoute === "crm.activities" && (
              <ActivitiesWorkspace
                onOpenEnquiry={(enqId) => {
                  setSelectedEnquiryId(String(enqId));
                  handleSelectRoute("crm.enquiries.show");
                }}
              />
            )}

            {activeRoute === "crm.closures" && (
              <ClosureWorkspace
                onOpenEnquiry={(enqId) => {
                  setSelectedEnquiryId(String(enqId));
                  handleSelectRoute("crm.enquiries.show");
                }}
              />
            )}

            {activeRoute === "crm.schedules" && (
              <SchedulerWorkspace view="schedules" />
            )}

            {activeRoute === "crm.reminders" && (
              <SchedulerWorkspace view="reminders" />
            )}

            {activeRoute === "crm.call-logs" && (
              <CallLogWorkspace />
            )}

            {activeRoute === "crm.sops" && (
              <SopWorkspace />
            )}

            {activeRoute === "crm.duties" && (
              <DutyAssignmentWorkspace />
            )}

            {activeRoute === "crm.duty-assignment" && (
              <DutyAssignmentWorkspace />
            )}

            {activeRoute === "crm.duty-reporting" && (
              <DutyReportingWorkspace />
            )}

            {activeRoute === "crm.reports" && (
              <CrmReportsWorkspace
                onOpenEnquiries={() => handleSelectRoute("crm.enquiries")}
                onViewChange={() => {}}
              />
            )}

            {activeRoute === "crm.contacts" && (
              <CrmContactWorkspace />
            )}

            {activeRoute === "crm.list-in" && (
              <ListInWorkspace />
            )}

            {activeRoute === "crm.status" && (
              <StatusWorkspace />
            )}

            {activeRoute === "crm.priority" && (
              <PriorityWorkspace />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
