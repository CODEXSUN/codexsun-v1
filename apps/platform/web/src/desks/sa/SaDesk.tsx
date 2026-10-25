import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  AppWindowIcon,
  Building2Icon,
  CircleGaugeIcon,
  CreditCardIcon,
  DatabaseIcon,
  ListChecksIcon,
  PaletteIcon,
  SearchCodeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
  WorkflowIcon
} from "lucide-react";
import { SuperLayout } from "@codexsun/ui/layouts/super-layout";
import type { SidemenuItem } from "@codexsun/ui/blocks/menu/sidemenu/sub/sidemenu-section";
import { GlobalLoader } from "@codexsun/ui/components/global-loader";
import { AppOperationsStrip } from "../../modules/app-orchestration/app-orchestration.list";
import { useAppOperationsQuery } from "../../modules/app-orchestration/app-orchestration.hooks";
import { logout } from "../../shared/api/platform-api";
import { AuthGate } from "../../shared/auth/AuthGate";
import { requiredClientEnv } from "../../shared/env/client-env";
import { zetroPageFromUrl, type SaZetroPage } from "./sa-zetro-pages";
import { SaAppCatalog } from "./sa-app-catalog";
import { SaAppDetails } from "./sa-app-details";

const ZunoWorkspace = lazyWorkspace(() =>
  import("@codexsun/zuno-web").then((module) => module.ZunoWorkspace)
);
const DataMigrationWorkspace = lazyWorkspace(() =>
  import("@codexsun/data-migration-web").then((module) => module.DataMigrationWorkspace)
);
const DataMigrationAnalysisWorkspace = lazyWorkspace(() =>
  import("@codexsun/data-migration-web").then((module) => module.DataMigrationAnalysisWorkspace)
);
const MigrationAuditWorkspace = lazyWorkspace(() =>
  import("@codexsun/data-migration-web").then((module) => module.MigrationAuditWorkspace)
);
const MigrationRunQueueWorkspace = lazyWorkspace(() =>
  import("@codexsun/data-migration-web").then((module) => module.MigrationRunQueueWorkspace)
);
const DataMigrationSettings = lazyWorkspace(() =>
  import("@codexsun/data-migration-web").then((module) => module.DataMigrationSettings)
);
const DatabaseConnectionWorkspace = lazyWorkspace(() =>
  import("@codexsun/data-bridge-web").then((module) => module.DatabaseConnectionWorkspace)
);
const CommonTablesWorkspace = lazyWorkspace(() =>
  import("@codexsun/data-bridge-web").then((module) => module.CommonTablesWorkspace)
);
const MasterTablesWorkspace = lazyWorkspace(() =>
  import("@codexsun/data-bridge-web").then((module) => module.MasterTablesWorkspace)
);
const BillingTablesWorkspace = lazyWorkspace(() =>
  import("@codexsun/data-bridge-web").then((module) => module.BillingTablesWorkspace)
);
const ReportWorkspace = lazyWorkspace(() =>
  import("@codexsun/data-bridge-web").then((module) => module.ReportWorkspace)
);
const TransferWorkspace = lazyWorkspace(() =>
  import("@codexsun/data-bridge-web").then((module) => module.TransferWorkspace)
);
const TableImportReviewWorkspace = lazyWorkspace(() =>
  import("@codexsun/data-bridge-web").then((module) => module.TableImportReviewWorkspace)
);
const ZetroAdminWorkspace = lazyWorkspace(() =>
  import("@codexsun/zetro-web/modules/admin").then((module) => module.ZetroAdminWorkspace)
);

function lazyWorkspace<Props>(loader: () => Promise<ComponentType<Props>>) {
  return lazy(async () => ({ default: await loader() }));
}

const DesignSystemGallery = lazyWorkspace(() =>
  import("../../modules/design-system/index").then((module) => module.DesignSystemGallery)
);
const UiuxGallery = lazyWorkspace(() =>
  import("@codexsun/uiux").then((module) => module.UiuxGallery)
);
const loadTenantList = () => import("../../modules/tenant/index");
const initialTenantList = window.location.pathname === "/sa/tenants" ? loadTenantList() : undefined;
const TenantList = lazyWorkspace(() =>
  (initialTenantList ?? loadTenantList()).then((module) => module.TenantList)
);
const TenantDomainList = lazyWorkspace(() =>
  import("../../modules/tenant-domain/index").then((module) => module.TenantDomainList)
);
const PlanWorkspace = lazyWorkspace(() =>
  import("../../modules/plan/index").then((module) => module.PlanWorkspace)
);
const SubscriptionWorkspace = lazyWorkspace(() =>
  import("../../modules/subscription/index").then((module) => module.SubscriptionWorkspace)
);
const AppRegistryWorkspace = lazyWorkspace(() =>
  import("../../modules/app-registry/index").then((module) => module.AppRegistryWorkspace)
);
const IndustryWorkspace = lazyWorkspace(() =>
  import("../../modules/industry/index").then((module) => module.IndustryWorkspace)
);
const EntitlementWorkspace = lazyWorkspace(() =>
  import("../../modules/entitlement/index").then((module) => module.EntitlementWorkspace)
);
const PlanAccessWorkspace = lazyWorkspace(() =>
  import("../../modules/plan-access/index").then((module) => module.PlanAccessWorkspace)
);
const TenantAccessWorkspace = lazyWorkspace(() =>
  import("../../modules/tenant-access/index").then((module) => module.TenantAccessWorkspace)
);
const TenantUserWorkspace = lazyWorkspace(() =>
  import("../../modules/tenant-user/index").then((module) => module.TenantUserWorkspace)
);
const AccessControlWorkspace = lazyWorkspace(() =>
  import("../../modules/access-control/index").then((module) => module.AccessControlWorkspace)
);
const PlatformActivityWorkspace = lazyWorkspace(() =>
  import("../../modules/platform-activity/index").then((module) => module.PlatformActivityWorkspace)
);
const MasterDatabaseWorkspace = lazyWorkspace(() =>
  import("../../modules/master-database/index").then((module) => module.MasterDatabaseWorkspace)
);
const MasterDatabaseBackupsWorkspace = lazyWorkspace(() =>
  import("../../modules/master-database/index").then(
    (module) => module.MasterDatabaseBackupsWorkspace
  )
);
const TenantDatabaseWorkspace = lazyWorkspace(() =>
  import("../../modules/tenant-database/index").then((module) => module.TenantDatabaseWorkspace)
);
const TenantDatabaseBackupsRoute = lazyWorkspace(() =>
  import("../../modules/tenant-database/index").then((module) => module.TenantDatabaseBackupsRoute)
);
const QueueManagementWorkspace = lazyWorkspace(() =>
  import("../../modules/queue-management/index").then((module) => module.QueueManagementWorkspace)
);
const StorageManagerWorkspace = lazyWorkspace(() =>
  import("../../modules/storage-manager/index").then((module) => module.StorageManagerWorkspace)
);
const TaskManagerWorkspace = lazyWorkspace(() =>
  import("../../modules/task-manager/index").then((module) => module.TaskManagerWorkspace)
);
const AppOrchestrationWorkspace = lazyWorkspace(() =>
  import("../../modules/app-orchestration/app-orchestration.workspace").then(
    (module) => module.AppOrchestrationWorkspace
  )
);

type SaPage =
  | "overview"
  | "app-operations"
  | "task-manager"
  | "data-migration-analysis"
  | "data-migration-run"
  | "data-migration-transfer-review"
  | "data-migration-audit"
  | "data-migration-queue"
  | "data-migration-settings"
  | "data-bridge"
  | "data-bridge-connections"
  | "data-bridge-tables"
  | "data-bridge-fields"
  | "data-bridge-prepare"
  | "data-bridge-confirm"
  | "data-bridge-results"
  | "data-bridge-master-tables"
  | "data-bridge-billing-tables"
  | "data-bridge-report"
  | "data-bridge-core-masters"
  | "data-bridge-common-tables"
  | "data-bridge-table-import"
  | "zuno"
  | SaZetroPage
  | "tenants"
  | "domains"
  | "plans"
  | "plan-access"
  | "subscriptions"
  | "apps"
  | "entitlements"
  | "tenant-access"
  | "tenant-users"
  | "industries"
  | "master-database"
  | "master-backups"
  | "tenant-database"
  | "tenant-backups"
  | "queue-management"
  | "storage-manager"
  | "access"
  | "activity"
  | "uiux"
  | "design-system";

export function SaDesk() {
  const location = useLocation();
  const navigate = useNavigate();
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [migrationSelection, setMigrationSelection] = useState<{
    sourceId: number;
    targetTenantId: number;
    table: string;
  }>();
  const bridgeSearch = location.search as Record<string, unknown>;
  const bridgeSelection =
    typeof bridgeSearch.sourceId === "number" &&
    typeof bridgeSearch.targetTenantId === "number" &&
    typeof bridgeSearch.table === "string"
      ? {
          sourceId: bridgeSearch.sourceId,
          targetTenantId: bridgeSearch.targetTenantId,
          table: bridgeSearch.table,
          ...(typeof bridgeSearch.importId === "string" ? { importId: bridgeSearch.importId } : {})
        }
      : undefined;
  const page = pageFromUrl(location.pathname);
  const tenantSearch = (location.search as Record<string, unknown>).tenant;
  const selectedZetroTenant = typeof tenantSearch === "string" ? tenantSearch : "";
  const appSearch = (location.search as Record<string, unknown>).app;
  const selectedAppId = typeof appSearch === "string" ? appSearch : "platform";

  useEffect(() => {
    const canonicalPath = page === "overview" ? "/sa" : `/sa/${page}`;
    if (location.pathname !== canonicalPath) {
      void navigate({ to: canonicalPath, search: location.search, replace: true });
    }
  }, [location.pathname, location.search, navigate, page]);

  function selectPage(nextPage: SaPage) {
    setWorkspaceRevision((revision) => revision + 1);
    const path = nextPage === "overview" ? "/sa" : `/sa/${nextPage}`;
    void navigate({
      to: path,
      search:
        nextPage.startsWith("zetro/") && selectedZetroTenant ? { tenant: selectedZetroTenant } : {}
    });
  }

  const bridgeStages: SaPage[] = [
    "data-bridge-connections",
    "data-bridge-tables",
    "data-bridge-fields",
    "data-bridge-prepare",
    "data-bridge-confirm",
    "data-bridge-results"
  ];
  const transferId = typeof bridgeSearch.transfer === "string" ? bridgeSearch.transfer : undefined;
  function openBridgeStage(stage: number, id?: string) {
    void navigate({
      to: "/sa/$",
      params: { _splat: bridgeStages[stage - 1]! },
      search: id ? { transfer: id } : {}
    });
  }
  const groupStage = Math.min(6, Math.max(2, Number(bridgeSearch.tab) || 2));
  function openGroupedImport(groupPage: SaPage, stage: number, id?: string) {
    void navigate({
      to: "/sa/$",
      params: { _splat: groupPage },
      search: { tab: stage, ...(id ? { transfer: id } : {}) }
    });
  }
  function openBridgeReport(kind?: string, id?: string) {
    void navigate({
      to: "/sa/$",
      params: { _splat: "data-bridge-report" },
      search: kind && id ? { kind, record: id } : {}
    });
  }
  function openCommonTableImport(selection: {
    sourceId: number;
    targetTenantId: number;
    table: string;
    importId?: string;
  }) {
    setWorkspaceRevision((revision) => revision + 1);
    void navigate({
      params: { _splat: "data-bridge-table-import" },
      search: {
        sourceId: selection.sourceId,
        targetTenantId: selection.targetTenantId,
        table: selection.table,
        ...(selection.importId ? { importId: selection.importId } : {})
      },
      to: "/sa/$"
    });
  }

  function selectZetroTenant(tenantId: string) {
    void navigate({
      params: { _splat: page },
      search: { tenant: tenantId },
      to: "/sa/$"
    });
  }

  function openTenantBackups(tenantId: number) {
    void navigate({
      params: { _splat: "tenant-backups" },
      search: { tenant: tenantId },
      to: "/sa/$"
    });
  }

  function openAppOperations(appId: string) {
    if (appId === "data-migration") {
      selectPage("data-migration-run");
      return;
    }
    void navigate({
      params: { _splat: "app-operations" },
      search: { app: appId },
      to: "/sa/$"
    });
  }

  async function handleLogout() {
    await logout("sa");
    window.location.assign("/sa/login");
  }

  const menuItems: SidemenuItem[] = [
    {
      title: "Overview",
      icon: CircleGaugeIcon,
      isActive: page === "overview",
      onSelect: () => selectPage("overview")
    },
    {
      title: "Data sync",
      icon: DatabaseIcon,
      isActive: page.startsWith("data-migration-"),
      items: [
        {
          title: "Database Settings",
          isActive: page === "data-migration-settings",
          onSelect: () => selectPage("data-migration-settings")
        },
        {
          title: "Migration Mapper",
          isActive: page === "data-migration-run",
          onSelect: () => selectPage("data-migration-run")
        },
        {
          title: "Transfer Review",
          isActive: page === "data-migration-transfer-review",
          onSelect: () => selectPage("data-migration-transfer-review")
        },
        {
          title: "Migration Audit",
          isActive: page === "data-migration-audit",
          onSelect: () => selectPage("data-migration-audit")
        },
        {
          title: "Migration Queue",
          isActive: page === "data-migration-queue",
          onSelect: () => selectPage("data-migration-queue")
        },
        {
          title: "Migration Analysis",
          isActive: page === "data-migration-analysis",
          onSelect: () => selectPage("data-migration-analysis")
        }
      ]
    },
    {
      title: "Data Bridge",
      icon: WorkflowIcon,
      isActive: page.startsWith("data-bridge"),
      items: [
        {
          title: "Database Connection",
          isActive: page === "data-bridge-connections" || page === "data-bridge",
          onSelect: () => selectPage("data-bridge-connections")
        },
        {
          title: "Common Tables",
          isActive: page === "data-bridge-common-tables",
          onSelect: () => selectPage("data-bridge-common-tables")
        },
        {
          title: "Master Tables",
          isActive: page === "data-bridge-master-tables" || page === "data-bridge-core-masters",
          onSelect: () => selectPage("data-bridge-master-tables")
        },
        {
          title: "Billing Tables",
          isActive: page === "data-bridge-billing-tables",
          onSelect: () => selectPage("data-bridge-billing-tables")
        },
        {
          title: "Report",
          isActive:
            page === "data-bridge-report" ||
            page === "data-bridge-table-import" ||
            bridgeStages.slice(1).includes(page),
          onSelect: () => selectPage("data-bridge-report")
        }
      ]
    },
    {
      title: "Task Manager",
      icon: ListChecksIcon,
      isActive: page === "task-manager",
      onSelect: () => selectPage("task-manager")
    },
    {
      title: "Zuno",
      icon: SearchCodeIcon,
      isActive: page === "zuno",
      onSelect: () => selectPage("zuno")
    },
    {
      title: "Zetro",
      icon: SparklesIcon,
      isActive: page.startsWith("zetro/"),
      items: [
        {
          title: "Query Patterns",
          isActive: page === "zetro/patterns",
          onSelect: () => selectPage("zetro/patterns")
        },
        {
          title: "Permissions",
          isActive: page === "zetro/access",
          onSelect: () => selectPage("zetro/access")
        },
        {
          title: "Conversations",
          isActive: page === "zetro/conversations",
          onSelect: () => selectPage("zetro/conversations")
        },
        {
          title: "Review Activity",
          isActive: page === "zetro/review",
          onSelect: () => selectPage("zetro/review")
        }
      ]
    },
    {
      title: "Operations",
      icon: WorkflowIcon,
      isActive: page === "queue-management",
      items: [
        {
          title: "Queue Management",
          isActive: page === "queue-management",
          onSelect: () => selectPage("queue-management")
        }
      ]
    },
    {
      title: "Tenant Setup",
      icon: Building2Icon,
      isActive:
        page === "tenants" ||
        page === "domains" ||
        page === "tenant-access" ||
        page === "tenant-users",
      items: [
        {
          title: requiredClientEnv("VITE_TENANCY_MODE") === "single" ? "Client" : "Tenants",
          isActive: page === "tenants",
          onSelect: () => selectPage("tenants")
        },
        { title: "Domains", isActive: page === "domains", onSelect: () => selectPage("domains") },
        {
          title: "Tenant Access",
          isActive: page === "tenant-access",
          onSelect: () => selectPage("tenant-access")
        },
        {
          title: "User Manager",
          icon: UsersIcon,
          isActive: page === "tenant-users",
          onSelect: () => selectPage("tenant-users")
        }
      ]
    },
    {
      title: "Commercial",
      icon: CreditCardIcon,
      isActive: page === "plans" || page === "plan-access" || page === "subscriptions",
      items: [
        { title: "Plans", isActive: page === "plans", onSelect: () => selectPage("plans") },
        {
          title: "Plan Access",
          isActive: page === "plan-access",
          onSelect: () => selectPage("plan-access")
        },
        {
          title: "Subscriptions",
          isActive: page === "subscriptions",
          onSelect: () => selectPage("subscriptions")
        }
      ]
    },
    {
      title: "Catalog",
      icon: AppWindowIcon,
      isActive: page === "apps" || page === "industries",
      items: [
        { title: "Apps", isActive: page === "apps", onSelect: () => selectPage("apps") },
        {
          title: "Industries",
          isActive: page === "industries",
          onSelect: () => selectPage("industries")
        }
      ]
    },
    {
      title: "Governance",
      icon: ShieldCheckIcon,
      isActive: page === "entitlements" || page === "access" || page === "activity",
      items: [
        {
          title: "Entitlements",
          isActive: page === "entitlements",
          onSelect: () => selectPage("entitlements")
        },
        {
          title: "Access Control",
          isActive: page === "access",
          onSelect: () => selectPage("access")
        },
        { title: "Activity", isActive: page === "activity", onSelect: () => selectPage("activity") }
      ]
    },
    {
      title: "Database",
      icon: DatabaseIcon,
      isActive:
        page === "master-database" ||
        page === "master-backups" ||
        page === "tenant-database" ||
        page === "tenant-backups" ||
        page === "storage-manager",
      items: [
        {
          title: "Master Database",
          isActive: page === "master-database",
          onSelect: () => selectPage("master-database")
        },
        {
          title: "Backup & Restore",
          isActive: page === "master-backups",
          onSelect: () => selectPage("master-backups")
        },
        {
          title: "Tenant Databases",
          isActive: page === "tenant-database",
          onSelect: () => selectPage("tenant-database")
        },
        {
          title: "Tenant Backup & Restore",
          isActive: page === "tenant-backups",
          onSelect: () => selectPage("tenant-backups")
        },
        {
          title: "Storage Manager",
          isActive: page === "storage-manager",
          onSelect: () => selectPage("storage-manager")
        }
      ]
    },
    {
      title: "Design System",
      icon: PaletteIcon,
      isActive: page === "design-system" || page === "uiux",
      items: [
        {
          title: "UIUX Gallery",
          isActive: page === "uiux",
          onSelect: () => selectPage("uiux")
        },
        {
          title: "Components",
          isActive: page === "design-system",
          onSelect: () => selectPage("design-system")
        }
      ]
    }
  ];

  return (
    <AuthGate desk="sa">
      {page === "uiux" ? (
        <Suspense fallback={<GlobalLoader className="min-h-[24rem]" fullScreen={false} />}>
          <UiuxGallery componentCatalogHref="/sa/design-system" deskRoutesAvailable />
        </Suspense>
      ) : (
        <SuperLayout
          homeHref="/"
          menuItems={menuItems}
          onLogout={handleLogout}
          versionLabel={`v ${__APP_VERSION__}`}
          workspace={page === "task-manager" ? "task-manager" : "platform"}
        >
          <Suspense
            key={`${page}:${workspaceRevision}`}
            fallback={<GlobalLoader className="min-h-[24rem]" fullScreen={false} />}
          >
            {page === "overview" ? <SaOverview onOpenApp={openAppOperations} /> : null}
            {page === "app-operations" && selectedAppId === "platform" ? (
              <AppOrchestrationWorkspace appId="platform" onBack={() => selectPage("overview")} />
            ) : null}
            {page === "app-operations" && selectedAppId !== "platform" ? (
              <SaAppDetails appId={selectedAppId} onBack={() => selectPage("overview")} />
            ) : null}
            {page === "task-manager" ? <TaskManagerWorkspace /> : null}
            {page === "zuno" ? <ZunoWorkspace /> : null}
            {page.startsWith("zetro/") ? (
              <ZetroAdminWorkspace
                page={
                  page.slice("zetro/".length) as "patterns" | "access" | "conversations" | "review"
                }
                tenantId={selectedZetroTenant}
                onTenantChange={selectZetroTenant}
              />
            ) : null}
            {page === "data-migration-run" ? (
              <DataMigrationWorkspace
                initialSelection={migrationSelection}
                onAuditHandoff={() => selectPage("data-migration-audit")}
              />
            ) : null}
            {page === "data-migration-transfer-review" ? (
              <DataMigrationWorkspace
                initialStep="transfer-list"
                onAuditHandoff={() => selectPage("data-migration-audit")}
              />
            ) : null}
            {page === "data-migration-audit" ? <MigrationAuditWorkspace /> : null}
            {page === "data-migration-queue" ? <MigrationRunQueueWorkspace /> : null}
            {page === "data-migration-analysis" ? (
              <DataMigrationAnalysisWorkspace
                onOpenMigration={(selection) => {
                  setMigrationSelection(selection);
                  selectPage("data-migration-run");
                }}
              />
            ) : null}
            {page === "data-migration-settings" ? <DataMigrationSettings /> : null}
            {page === "data-bridge" || page === "data-bridge-connections" ? (
              <DatabaseConnectionWorkspace
                onManageSources={() => selectPage("data-migration-settings")}
                onOpenBusinessReport={(id) => openBridgeReport("business", id)}
              />
            ) : null}
            {page === "data-bridge-common-tables" ? (
              <CommonTablesWorkspace
                stage={groupStage}
                {...(transferId ? { id: transferId } : {})}
                onNavigate={(stage, id) =>
                  openGroupedImport("data-bridge-common-tables", stage, id)
                }
                onConfigure={() => selectPage("data-bridge-connections")}
                onReport={(id) => openBridgeReport("bulk", id)}
              />
            ) : null}
            {page === "data-bridge-master-tables" || page === "data-bridge-core-masters" ? (
              <MasterTablesWorkspace
                stage={groupStage}
                {...(transferId ? { id: transferId } : {})}
                onNavigate={(stage, id) =>
                  openGroupedImport("data-bridge-master-tables", stage, id)
                }
                onConfigure={() => selectPage("data-bridge-connections")}
                onReport={(id) => openBridgeReport("bulk", id)}
              />
            ) : null}
            {page === "data-bridge-billing-tables" ? (
              <BillingTablesWorkspace
                stage={groupStage}
                {...(transferId ? { id: transferId } : {})}
                onNavigate={(stage, id) =>
                  openGroupedImport("data-bridge-billing-tables", stage, id)
                }
                onConfigure={() => selectPage("data-bridge-connections")}
              />
            ) : null}
            {page === "data-bridge-report" ? (
              <ReportWorkspace
                {...(typeof bridgeSearch.record === "string"
                  ? { recordId: bridgeSearch.record }
                  : {})}
                {...(typeof bridgeSearch.kind === "string" ? { kind: bridgeSearch.kind } : {})}
                onOpen={openBridgeReport}
                onResume={(group, stage, id) => {
                  if (group === "common") openGroupedImport("data-bridge-common-tables", stage, id);
                  else if (group === "masters")
                    openGroupedImport("data-bridge-master-tables", stage, id);
                  else if (group === "billing")
                    openGroupedImport("data-bridge-billing-tables", stage, id);
                  else openBridgeStage(stage, id);
                }}
              />
            ) : null}
            {bridgeStages.slice(1).includes(page) ? (
              <TransferWorkspace
                stage={bridgeStages.indexOf(page) + 1}
                {...(transferId ? { id: transferId } : {})}
                onNavigate={openBridgeStage}
              />
            ) : null}
            {page === "data-bridge-table-import" ? (
              <TableImportReviewWorkspace
                {...(bridgeSelection ? { selection: bridgeSelection } : {})}
                onBack={() => selectPage("data-bridge-report")}
                onOpenSaved={(importId) => {
                  if (bridgeSelection) openCommonTableImport({ ...bridgeSelection, importId });
                }}
              />
            ) : null}
            {page === "tenants" ? <TenantList onBack={() => selectPage("overview")} /> : null}
            {page === "domains" ? <TenantDomainList /> : null}
            {page === "plans" ? <PlanWorkspace /> : null}
            {page === "plan-access" ? <PlanAccessWorkspace /> : null}
            {page === "subscriptions" ? <SubscriptionWorkspace /> : null}
            {page === "apps" ? <AppRegistryWorkspace /> : null}
            {page === "entitlements" ? <EntitlementWorkspace /> : null}
            {page === "tenant-access" ? <TenantAccessWorkspace /> : null}
            {page === "tenant-users" ? <TenantUserWorkspace mode="super-admin" /> : null}
            {page === "industries" ? <IndustryWorkspace /> : null}
            {page === "master-database" ? (
              <MasterDatabaseWorkspace onOpenBackups={() => selectPage("master-backups")} />
            ) : null}
            {page === "master-backups" ? (
              <MasterDatabaseBackupsWorkspace onBack={() => selectPage("master-database")} />
            ) : null}
            {page === "tenant-database" ? (
              <TenantDatabaseWorkspace onOpenBackups={openTenantBackups} />
            ) : null}
            {page === "tenant-backups" ? (
              <TenantDatabaseBackupsRoute onBack={() => selectPage("tenant-database")} />
            ) : null}
            {page === "queue-management" ? <QueueManagementWorkspace /> : null}
            {page === "storage-manager" ? <StorageManagerWorkspace /> : null}
            {page === "access" ? <AccessControlWorkspace /> : null}
            {page === "activity" ? <PlatformActivityWorkspace /> : null}
            {page === "design-system" ? <DesignSystemGallery /> : null}
          </Suspense>
        </SuperLayout>
      )}
    </AuthGate>
  );
}

function pageFromUrl(pathname: string): SaPage {
  const zetroPage = zetroPageFromUrl(pathname);
  if (zetroPage) return zetroPage;
  const page = pathname.split("/").slice(2).join("/");
  if (page === "data-migration-overview") return "data-migration-run";
  return page === "app-operations" ||
    page === "task-manager" ||
    page === "data-migration-analysis" ||
    page === "data-migration-run" ||
    page === "data-migration-transfer-review" ||
    page === "data-migration-audit" ||
    page === "data-migration-queue" ||
    page === "data-migration-settings" ||
    page === "data-bridge-connections" ||
    page === "data-bridge-tables" ||
    page === "data-bridge-fields" ||
    page === "data-bridge-prepare" ||
    page === "data-bridge-confirm" ||
    page === "data-bridge-results" ||
    page === "data-bridge" ||
    page === "data-bridge-master-tables" ||
    page === "data-bridge-billing-tables" ||
    page === "data-bridge-report" ||
    page === "data-bridge-core-masters" ||
    page === "data-bridge-common-tables" ||
    page === "data-bridge-table-import" ||
    page === "zuno" ||
    page === "tenants" ||
    page === "domains" ||
    page === "plans" ||
    page === "plan-access" ||
    page === "subscriptions" ||
    page === "apps" ||
    page === "entitlements" ||
    page === "tenant-access" ||
    page === "tenant-users" ||
    page === "industries" ||
    page === "master-database" ||
    page === "master-backups" ||
    page === "tenant-database" ||
    page === "tenant-backups" ||
    page === "queue-management" ||
    page === "storage-manager" ||
    page === "access" ||
    page === "activity" ||
    page === "uiux" ||
    page === "design-system"
    ? page
    : "overview";
}

function SaOverview({ onOpenApp }: { onOpenApp: (appId: string) => void }) {
  const apps = useAppOperationsQuery();
  return (
    <main className="mx-auto w-[calc(100%-2rem)] max-w-[92rem] space-y-4 py-5 lg:w-[calc(100%-3rem)]">
      <section className="rounded-md border bg-card px-5 py-4 shadow-sm">
        <p className="text-sm font-semibold uppercase text-muted-foreground">
          Repository Operations
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Apps</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live state for the single Platform runtime and its composed workspace packages.
        </p>
      </section>
      {apps.error ? (
        <section className="rounded-md border border-destructive/40 bg-card p-4 text-sm text-destructive">
          {apps.error.message}
        </section>
      ) : null}
      <AppOperationsStrip apps={apps.data ?? []} onSelect={onOpenApp} />
      <SaAppCatalog onOpenApp={onOpenApp} />
    </main>
  );
}
