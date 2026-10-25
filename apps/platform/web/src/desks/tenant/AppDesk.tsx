import { CodeitOverview, CodeitSettings } from "@codexsun/codeit";
import { LeadWorkspace } from "@codexsun/crm-web";
import { marketingPageFromPath } from "../../modules/marketing/marketing-navigation";
import { MarketingHost } from "../../modules/marketing/marketing-host";
import { tconnectGateway } from "../../modules/tconnect/tconnect-host";
import { QCafeAppearance } from "./QCafeAppearance";
import { WorkspaceNavigationProvider } from "@codexsun/ui/workspace/navigation";
import { ApplicationOverview } from "./application-overview";
import {
  DocsKnowledgeWorkspace,
  useKnowledgeCatalog,
  buildKnowledgeMenu
} from "@codexsun/docs-web/modules/knowledge";
import { docsKnowledgeGateway } from "../../modules/docs/docs-host";
import { CodexsunHost } from "../../modules/codexsun/codexsun-host";
import { EmployeeWorkspace, employeeFormId } from "@codexsun/hrms-web/modules/employee";
import { attendanceGateway, employeeGateway } from "../../modules/hrms/hrms-host";
import { hrmsOverviewGateway } from "../../modules/hrms/hrms-host";
import { docsOverviewGateway } from "../../modules/docs/docs-host";
import { himsxOverviewGateway } from "../../modules/himsx/himsx-host";
import { siteGateway, sitesOverviewGateway } from "../../modules/sites/sites-host";
import {
  EcommerceModuleWorkspace,
  ecommerceModulePages,
  type EcommerceModulePage
} from "@codexsun/ecommerce-web/modules/pages";
import {
  EcommerceOverviewWorkspace,
  EcommerceStorefrontControls
} from "@codexsun/ecommerce-web/modules/overview";
import {
  ecommerceOverviewGateway,
  ecommerceStorefrontRuntimeGateway,
  openPublicStorefront
} from "../../modules/ecommerce/ecommerce-host";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type FormEvent
} from "react";
import { PlusIcon, RocketIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { TenantMainLayout } from "./TenantMainLayout";
import { QCafeAppHeader } from "./QCafeAppHeader";
import { ApplicationSettings } from "./ApplicationSettings";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@codexsun/ui/components/alert-dialog";
import { Button } from "@codexsun/ui/components/button";
import { Card } from "@codexsun/ui/components/card";
import { GlobalLoader } from "@codexsun/ui/components/global-loader";
import { workspaceLoadingMessage } from "../../shared/loading/workspace-loading";
import { Label } from "@codexsun/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@codexsun/ui/components/radio-group";
import { StatusBadge } from "@codexsun/ui/components/StatusBadge";
import { toast } from "sonner";
import {
  appMenuItemsFor,
  appRootPage,
  appRootUrl,
  appWorkspaceItems,
  deskAddonAppIds,
  enabledAppIds,
  platformAppRegistry,
  type BillingNavigationFeatures,
  type PlatformAppId
} from "../../app/app-registry";
import { getTenantRuntime } from "../../modules/tenant/tenant.services";
import {
  companyBrandName,
  useCompanyBranding
} from "@codexsun/core-web/modules/organisation/company/branding";
import { listCompanies } from "@codexsun/core-web/modules/organisation/company/services";
import { defaultCompanyQueryKey } from "@codexsun/core-web/modules/organisation/default-company/hooks";
import {
  getDefaultCompany,
  saveDefaultCompany
} from "@codexsun/core-web/modules/organisation/default-company/services";
import type { LandingAppOption } from "@codexsun/core-web/modules/organisation/default-company/types";
import { listFinancialYears } from "@codexsun/core-web/modules/organisation/financial-year/services";
import { getSessionIdentity, logout, PlatformApiError } from "../../shared/api/platform-api";
import { setPlatformDocumentTitle, setPlatformFavicon } from "../../shared/document/PageTitle";
import { publishDesktopWorkspace } from "../../shared/desktop/desktop-bridge";
import { publishAccountingYear, publishCompanyContext } from "../../shared/tenant/runtime-context";
import { blogEditorHost } from "../../modules/blog/blog-host";
import { useCrmNavigationCounts } from "@codexsun/crm-web/modules/enquiry/hooks";
import {
  chatTelegramLauncherItem,
  chatTelegramMenuItems,
  useChatNavigationCounts
} from "@codexsun/chat-web/modules/chat/navigation";
import { ZetroLogo } from "@codexsun/zetro-web/logo";
import { landingAppChoices } from "./landing-app-choices";
import { CrmContactApplicationHeader } from "./crm-contact-application-header";
import { SchedulerWorkspace } from "@codexsun/crm-web/modules/scheduler";
import { usePlatformNotifications } from "../../modules/notifications/index";
import { newEnquiryFormId, type EnquiryReportFilters } from "@codexsun/crm-web/modules/enquiry";
import { TaskWorkspace, useTaskNavigationCount } from "@codexsun/crm-web/modules/task";
import { auditorClientGateway } from "../../modules/auditor/auditor-host";
import {
  logicxErpOverviewGateway,
  logicxErpSchemeGateway
} from "../../modules/logicx-erp/logicx-erp-host";

function lazyWorkspace<Props>(loader: () => Promise<ComponentType<Props>>) {
  return lazy(async () => ({ default: await loader() }));
}

function retryWorkspaceBootstrap(failureCount: number, error: unknown) {
  if (error instanceof PlatformApiError && error.statusCode < 500) return false;
  return failureCount < 2;
}

function workspaceBootstrapRetryDelay(attemptIndex: number) {
  return 300 * (attemptIndex + 1);
}

const TconnectWorkspace = lazyWorkspace(() =>
  import("@codexsun/tconnect-web").then((module) => module.TconnectWorkspace)
);
export type SportsclubRouteMode = "list" | "new" | "view" | "edit";

export type SportsclubWorkspaceRouteProps = {
  mode?: SportsclubRouteMode | undefined;
  uuid?: string | undefined;
  onNavigate?:
    | ((options: { mode?: SportsclubRouteMode | undefined; uuid?: string | undefined }) => void)
    | undefined;
};

const SportsclubOverviewWorkspace = lazyWorkspace(() =>
  import("@codexsun/sportsclub-web").then((module) => module.SportsclubOverviewWorkspace)
);
const SportsclubMemberWorkspace = lazyWorkspace<SportsclubWorkspaceRouteProps>(() =>
  import("@codexsun/sportsclub-web").then(
    (module) => module.MemberWorkspace as unknown as ComponentType<SportsclubWorkspaceRouteProps>
  )
);
const SportsclubMasterWorkspace = lazyWorkspace<SportsclubWorkspaceRouteProps>(() =>
  import("@codexsun/sportsclub-web").then(
    (module) => module.MasterWorkspace as unknown as ComponentType<SportsclubWorkspaceRouteProps>
  )
);
const SportsclubProgramWorkspace = lazyWorkspace<SportsclubWorkspaceRouteProps>(() =>
  import("@codexsun/sportsclub-web").then(
    (module) => module.ProgramWorkspace as unknown as ComponentType<SportsclubWorkspaceRouteProps>
  )
);
const SportsclubSessionWorkspace = lazyWorkspace<SportsclubWorkspaceRouteProps>(() =>
  import("@codexsun/sportsclub-web").then(
    (module) => module.SessionWorkspace as unknown as ComponentType<SportsclubWorkspaceRouteProps>
  )
);
const SportsclubAttendanceWorkspace = lazyWorkspace<SportsclubWorkspaceRouteProps>(() =>
  import("@codexsun/sportsclub-web").then(
    (module) =>
      module.AttendanceWorkspace as unknown as ComponentType<SportsclubWorkspaceRouteProps>
  )
);
const SportsclubProgressWorkspace = lazyWorkspace<SportsclubWorkspaceRouteProps>(() =>
  import("@codexsun/sportsclub-web").then(
    (module) => module.ProgressWorkspace as unknown as ComponentType<SportsclubWorkspaceRouteProps>
  )
);
const SportsclubEventWorkspace = lazyWorkspace<SportsclubWorkspaceRouteProps>(() =>
  import("@codexsun/sportsclub-web").then(
    (module) => module.EventWorkspace as unknown as ComponentType<SportsclubWorkspaceRouteProps>
  )
);
const SportsclubEnquiryWorkspace = lazyWorkspace<SportsclubWorkspaceRouteProps>(() =>
  import("@codexsun/sportsclub-web").then(
    (module) => module.EnquiryWorkspace as unknown as ComponentType<SportsclubWorkspaceRouteProps>
  )
);
const HrmsOverviewWorkspace = lazyWorkspace(() =>
  import("@codexsun/hrms-web/modules/overview").then((module) => module.HrmsOverviewWorkspace)
);
const DocsOverviewWorkspace = lazyWorkspace(() =>
  import("@codexsun/docs-web/modules/overview").then((module) => module.DocsOverviewWorkspace)
);
const HimsxOverviewWorkspace = lazyWorkspace(() =>
  import("@codexsun/himsx-web/modules/overview").then((module) => module.HimsxOverviewWorkspace)
);
const SitesOverviewWorkspace = lazyWorkspace(() =>
  import("@codexsun/sites-web/modules/overview").then((module) => module.SitesOverviewWorkspace)
);
const HrmsAttendanceWorkspace = lazyWorkspace(() =>
  import("@codexsun/hrms-web/modules/attendance").then((module) => module.AttendanceWorkspace)
);

const loadBillingDashboardModule = () => import("@codexsun/billing-web/modules/dashboard");
const loadQuotationModule = () => import("@codexsun/billing-web/modules/quotation");
const loadSalesModule = () => import("@codexsun/billing-web/modules/sales");
const loadPurchaseModule = () => import("@codexsun/billing-web/modules/purchase");
const loadExportSalesModule = () => import("@codexsun/billing-web/modules/export-sales");
const loadPaymentModule = () => import("@codexsun/billing-web/modules/payment");
const loadReceiptModule = () => import("@codexsun/billing-web/modules/receipt");
const loadBillingReportsModule = () => import("@codexsun/billing-web/modules/reports");
const loadAccountsOverviewModule = () => import("@codexsun/accounts-web/modules/overview");
const loadAccountingModule = () => import("@codexsun/accounts-web/modules/accounting");
const loadBlogModule = () => import("@codexsun/blog/web");
const AuditorOverviewWorkspace = lazyWorkspace(() =>
  import("@codexsun/auditor-web/modules/overview").then((module) => module.AuditorOverviewWorkspace)
);
const AuditorClientWorkspace = lazyWorkspace(() =>
  import("@codexsun/auditor-web/modules/client").then((module) => module.AuditorClientWorkspace)
);
const LogicxErpOverviewWorkspace = lazyWorkspace(() =>
  import("@codexsun/logicx-erp-web/modules/overview").then(
    (module) => module.LogicxErpOverviewWorkspace
  )
);
const LogicxErpSchemeWorkspace = lazyWorkspace(() =>
  import("@codexsun/logicx-erp-web/modules/scheme").then(
    (module) => module.LogicxErpSchemeWorkspace
  )
);
const CrmOverviewWorkspace = lazyWorkspace(() =>
  import("@codexsun/crm-web/modules/overview").then((module) => module.CrmOverviewWorkspace)
);
const FrappeOverviewWorkspace = lazyWorkspace(() =>
  import("@codexsun/frappe-web/modules/overview").then((module) => module.FrappeOverviewWorkspace)
);
const ZetroChatWorkspace = lazyWorkspace(() =>
  import("@codexsun/zetro-web/modules/chat").then((module) => module.ZetroChatWorkspace)
);
const ZetroChatDrawer = lazyWorkspace(() =>
  import("@codexsun/zetro-web/modules/chat").then((module) => module.ZetroChatDrawer)
);
const FrappeEnquiryImportWorkspace = lazyWorkspace(() =>
  import("@codexsun/frappe-web/modules/enquiry-sync").then(
    (module) => module.FrappeEnquiryImportWorkspace
  )
);
const FrappeContactImportWorkspace = lazyWorkspace(() =>
  import("@codexsun/frappe-web/modules/contact-import").then(
    (module) => module.FrappeContactImportWorkspace
  )
);
const FrappeActivityImportWorkspace = lazyWorkspace(() =>
  import("@codexsun/frappe-web/modules/activity-import").then(
    (module) => module.FrappeActivityImportWorkspace
  )
);
const FrappeCallLogImportWorkspace = lazyWorkspace(() =>
  import("@codexsun/frappe-web/modules/call-log-import").then(
    (module) => module.FrappeCallLogImportWorkspace
  )
);
const FrappeContactExportWorkspace = lazyWorkspace(() =>
  import("@codexsun/frappe-web/modules/export").then(
    (module) => module.FrappeContactExportWorkspace
  )
);
const FrappeEnquiryExportWorkspace = lazyWorkspace(() =>
  import("@codexsun/frappe-web/modules/export").then(
    (module) => module.FrappeEnquiryExportWorkspace
  )
);
const FrappeActivityExportWorkspace = lazyWorkspace(() =>
  import("@codexsun/frappe-web/modules/export").then(
    (module) => module.FrappeActivityExportWorkspace
  )
);
const FrappeCallLogExportWorkspace = lazyWorkspace(() =>
  import("@codexsun/frappe-web/modules/export").then(
    (module) => module.FrappeCallLogExportWorkspace
  )
);
const FrappeAvailabilityWorkspace = lazyWorkspace(() =>
  import("@codexsun/frappe-web/modules/live-sync").then(
    (module) => module.FrappeAvailabilityWorkspace
  )
);
const FrappeLiveSyncWorkspace = lazyWorkspace(() =>
  import("@codexsun/frappe-web/modules/live-sync").then((module) => module.FrappeLiveSyncWorkspace)
);
const FrappeLiveSyncQueueWorkspace = lazyWorkspace(() =>
  import("@codexsun/frappe-web/modules/live-sync").then(
    (module) => module.FrappeLiveSyncQueueWorkspace
  )
);
const FrappeConnectionWorkspace = lazyWorkspace(() =>
  import("@codexsun/frappe-web/modules/connection").then(
    (module) => module.FrappeConnectionWorkspace
  )
);
const FrappeUserSyncWorkspace = lazyWorkspace(() =>
  import("@codexsun/frappe-web/modules/user-sync").then((module) => module.FrappeUserSyncWorkspace)
);
const FrappeUserMappingWorkspace = lazyWorkspace(() =>
  import("@codexsun/frappe-web/modules/user-mapping").then(
    (module) => module.FrappeUserMappingWorkspace
  )
);
const FrappeIdentityAuditWorkspace = lazyWorkspace(() =>
  import("@codexsun/frappe-web/modules/user-mapping").then(
    (module) => module.FrappeIdentityAuditWorkspace
  )
);
const CrmReportsWorkspace = lazyWorkspace(() =>
  import("@codexsun/crm-web/modules/reports").then((module) => module.CrmReportsWorkspace)
);
const EnquiryWorkspace = lazyWorkspace(() =>
  import("@codexsun/crm-web/modules/enquiry").then((module) => module.EnquiryWorkspace)
);
const ActivitiesWorkspace = lazyWorkspace(() =>
  import("@codexsun/crm-web/modules/activities").then((module) => module.ActivitiesWorkspace)
);
const SopWorkspace = lazyWorkspace(() =>
  import("@codexsun/crm-web/modules/sop").then((module) => module.SopWorkspace)
);
const MyDutiesWorkspace = lazyWorkspace(() =>
  import("@codexsun/crm-web/modules/duty-assignment").then(
    (module) => module.DutyAssignmentWorkspace
  )
);
const DutyReportingWorkspace = lazyWorkspace(() =>
  import("@codexsun/crm-web/modules/duty-report").then((module) => module.DutyReportWorkspace)
);
const ClosureWorkspace = lazyWorkspace(() =>
  import("@codexsun/crm-web/modules/closure").then((module) => module.ClosureWorkspace)
);
const CallLogWorkspace = lazyWorkspace(() =>
  import("@codexsun/crm-web/modules/call-log").then((module) => module.CallLogWorkspace)
);
const ListInWorkspace = lazyWorkspace(() =>
  import("@codexsun/crm-web/modules/list-in").then((module) => module.ListInWorkspace)
);
const StatusWorkspace = lazyWorkspace(() =>
  import("@codexsun/crm-web/modules/status").then((module) => module.StatusWorkspace)
);
const PriorityWorkspace = lazyWorkspace(() =>
  import("@codexsun/crm-web/modules/priority").then((module) => module.PriorityWorkspace)
);

const billingWorkspacePreloaders = [
  loadBillingDashboardModule,
  loadQuotationModule,
  loadSalesModule,
  loadPurchaseModule,
  loadExportSalesModule,
  loadPaymentModule,
  loadReceiptModule,
  loadBillingReportsModule
] as const;

const TaskManagerWorkspace = lazyWorkspace(() =>
  import("../../modules/task-manager/index").then((module) => module.TaskManagerWorkspace)
);

const AddressTypesWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/contacts/address-types").then(
    (module) => module.AddressTypesWorkspace
  )
);
const BankNamesWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/contacts/bank-names").then(
    (module) => module.BankNamesWorkspace
  )
);
const ContactGroupsWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/contacts/contact-groups").then(
    (module) => module.ContactGroupsWorkspace
  )
);
const ContactTypesWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/contacts/contact-types").then(
    (module) => module.ContactTypesWorkspace
  )
);
const CityWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/location/city").then((module) => module.CityWorkspace)
);
const CountryWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/location/country").then(
    (module) => module.CountryWorkspace
  )
);
const DistrictWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/location/district").then(
    (module) => module.DistrictWorkspace
  )
);
const PincodeWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/location/pincode").then(
    (module) => module.PincodeWorkspace
  )
);
const StateWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/location/state").then((module) => module.StateWorkspace)
);
const LedgerGroupsWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/accounts/ledger-groups").then(
    (module) => module.LedgerGroupsWorkspace
  )
);
const LedgersWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/accounts/ledgers").then(
    (module) => module.LedgersWorkspace
  )
);
const CurrenciesWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/others/currencies").then(
    (module) => module.CurrenciesWorkspace
  )
);
const MonthsWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/others/months").then((module) => module.MonthsWorkspace)
);
const PaymentTermsWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/others/payment-terms").then(
    (module) => module.PaymentTermsWorkspace
  )
);
const PrioritiesWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/others/priorities").then(
    (module) => module.PrioritiesWorkspace
  )
);
const SalesTypesWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/others/sales-types").then(
    (module) => module.SalesTypesWorkspace
  )
);
const BrandsWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/products/brands").then(
    (module) => module.BrandsWorkspace
  )
);
const ColoursWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/products/colours").then(
    (module) => module.ColoursWorkspace
  )
);
const HsnCodesWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/products/hsn-codes").then(
    (module) => module.HsnCodesWorkspace
  )
);
const ProductCategoriesWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/products/product-categories").then(
    (module) => module.ProductCategoriesWorkspace
  )
);
const ProductGroupsWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/products/product-groups").then(
    (module) => module.ProductGroupsWorkspace
  )
);
const ProductTypesWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/products/product-types").then(
    (module) => module.ProductTypesWorkspace
  )
);
const SizesWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/products/sizes").then((module) => module.SizesWorkspace)
);
const StylesWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/products/styles").then(
    (module) => module.StylesWorkspace
  )
);
const TaxesWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/products/taxes").then((module) => module.TaxesWorkspace)
);
const UnitsWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/products/units").then((module) => module.UnitsWorkspace)
);
const DestinationsWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/workorder/destinations").then(
    (module) => module.DestinationsWorkspace
  )
);
const StockRejectionTypesWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/workorder/stock-rejection-types").then(
    (module) => module.StockRejectionTypesWorkspace
  )
);
const TransportsWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/workorder/transports").then(
    (module) => module.TransportsWorkspace
  )
);
const WarehousesWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/workorder/warehouses").then(
    (module) => module.WarehousesWorkspace
  )
);
const WorkOrderTypesWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/common/workorder/work-order-types").then(
    (module) => module.WorkOrderTypesWorkspace
  )
);
const ContactWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/master/contact/workspace").then(
    (module) => module.ContactWorkspace
  )
);
const CrmContactWorkspace = lazyWorkspace(() =>
  import("@codexsun/crm-web/modules/contact").then((module) => module.CrmContactWorkspace)
);
const Contact360Workspace = lazyWorkspace(() =>
  import("@codexsun/crm-web/modules/contact-360").then((module) => module.Contact360Workspace)
);
const ProductWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/master/product").then((module) => module.ProductWorkspace)
);
const WorkOrderWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/master/work-order").then((module) => module.WorkOrderWorkspace)
);
const CompanyWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/organisation/company").then(
    (module) => module.CompanyWorkspace
  )
);
const DefaultCompanyWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/organisation/default-company").then(
    (module) => module.DefaultCompanyWorkspace
  )
);
const FinancialYearWorkspace = lazyWorkspace(() =>
  import("@codexsun/core-web/modules/organisation/financial-year").then(
    (module) => module.FinancialYearWorkspace
  )
);
const QuotationWorkspace = lazyWorkspace(() =>
  loadQuotationModule().then((module) => module.QuotationWorkspace)
);
const QuotationPrintRoutePage = lazyWorkspace(() =>
  loadQuotationModule().then((module) => module.QuotationPrintRoutePage)
);
const SalesWorkspace = lazyWorkspace(() =>
  loadSalesModule().then((module) => module.SalesWorkspace)
);
const SalesPrintRoutePage = lazyWorkspace(() =>
  loadSalesModule().then((module) => module.SalesPrintRoutePage)
);
const BillingDashboardWorkspace = lazyWorkspace(() =>
  loadBillingDashboardModule().then((module) => module.BillingDashboardWorkspace)
);
const CustomerStatementWorkspace = lazyWorkspace(() =>
  loadBillingReportsModule().then((module) => module.CustomerStatementWorkspace)
);
const CustomerSummaryWorkspace = lazyWorkspace(() =>
  loadBillingReportsModule().then((module) => module.CustomerSummaryWorkspace)
);
const SupplierStatementWorkspace = lazyWorkspace(() =>
  loadBillingReportsModule().then((module) => module.SupplierStatementWorkspace)
);
const SupplierSummaryWorkspace = lazyWorkspace(() =>
  loadBillingReportsModule().then((module) => module.SupplierSummaryWorkspace)
);
const StockStatementWorkspace = lazyWorkspace(() =>
  loadBillingReportsModule().then((module) => module.StockStatementWorkspace)
);
const GstStatementWorkspace = lazyWorkspace(() =>
  loadBillingReportsModule().then((module) => module.GstStatementWorkspace)
);
const BillingSettingsWorkspace = lazyWorkspace(() =>
  import("@codexsun/billing-web").then((module) => module.BillingSettingsWorkspace)
);
const DocumentSettingsWorkspace = lazyWorkspace(() =>
  import("@codexsun/billing-web").then((module) => module.DocumentSettingsWorkspace)
);
const PurchaseWorkspace = lazyWorkspace(() =>
  loadPurchaseModule().then((module) => module.PurchaseWorkspace)
);
const PurchasePrintRoutePage = lazyWorkspace(() =>
  loadPurchaseModule().then((module) => module.PurchasePrintRoutePage)
);
const ExportSalesWorkspace = lazyWorkspace(() =>
  loadExportSalesModule().then((module) => module.ExportSalesWorkspace)
);
const ExportSalesPrintRoutePage = lazyWorkspace(() =>
  loadExportSalesModule().then((module) => module.ExportSalesPrintRoutePage)
);
const PaymentWorkspace = lazyWorkspace(() =>
  loadPaymentModule().then((module) => module.PaymentWorkspace)
);
const ReceiptWorkspace = lazyWorkspace(() =>
  loadReceiptModule().then((module) => module.ReceiptWorkspace)
);
const MailWorkspace = lazyWorkspace(() =>
  import("@codexsun/mail-web/modules/mail").then((module) => module.MailWorkspace)
);
const NotesWorkspace = lazyWorkspace(() =>
  import("@codexsun/notes-web/modules/notes").then((module) => module.NotesWorkspace)
);
const ChatWorkspace = lazyWorkspace(() =>
  import("@codexsun/chat-web/modules/chat").then((module) => module.ChatWorkspace)
);
const ChatTelegramWorkspace = lazyWorkspace(() =>
  import("@codexsun/chat-web/modules/chat").then((module) => module.ChatTelegramWorkspace)
);
const ChatTelegramSettingsWorkspace = lazyWorkspace(() =>
  import("@codexsun/chat-web/modules/chat").then((module) => module.ChatTelegramSettingsWorkspace)
);
const AccountsOverviewWorkspace = lazyWorkspace(() =>
  loadAccountsOverviewModule().then((module) => module.AccountsOverviewWorkspace)
);
const AccountingWorkspace = lazyWorkspace(() =>
  loadAccountingModule().then((module) => module.AccountingWorkspace)
);
const AccountingLedgerWorkspace = lazyWorkspace(() =>
  loadAccountingModule().then((module) => module.AccountingLedgerWorkspace)
);
const AccountingPeriodsWorkspace = lazyWorkspace(() =>
  loadAccountingModule().then((module) => module.AccountingPeriodsWorkspace)
);
const CashBookWorkspace = lazyWorkspace(() =>
  loadAccountingModule().then((module) => module.CashBookWorkspace)
);
const BankBookWorkspace = lazyWorkspace(() =>
  loadAccountingModule().then((module) => module.BankBookWorkspace)
);
const BlogsEditorWorkspace = lazyWorkspace(() =>
  loadBlogModule().then((module) => module.BlogsEditorWorkspace)
);

const QCafeWebApp = lazy(() =>
  import("@codexsun/qcafe-web/web").then((module) => ({ default: module.WebApp }))
);
const TenantUserWorkspace = lazy(() =>
  import("../../modules/tenant-user/index").then((module) => ({
    default: module.TenantUserWorkspace
  }))
);
const TenantRoleWorkspace = lazy(() =>
  import("../../modules/tenant-role/index").then((module) => ({
    default: module.TenantRoleWorkspace
  }))
);
const TenantPermissionWorkspace = lazy(() =>
  import("../../modules/tenant-permission/index").then((module) => ({
    default: module.TenantPermissionWorkspace
  }))
);
const TenantUserRoleWorkspace = lazy(() =>
  import("../../modules/tenant-user-role/index").then((module) => ({
    default: module.TenantUserRoleWorkspace
  }))
);
const TenantRolePermissionWorkspace = lazy(() =>
  import("../../modules/tenant-role-permission/index").then((module) => ({
    default: module.TenantRolePermissionWorkspace
  }))
);

const TenantAccessControlWorkspace = lazy(() =>
  import("../../modules/tenant-role-permission/index").then((module) => ({
    default: module.TenantAccessControlWorkspace
  }))
);

type AppPage =
  | "zetro.chat"
  | "frappe.overview"
  | "frappe.contacts"
  | "frappe.enquiries"
  | "frappe.activities"
  | "frappe.call-logs"
  | "frappe.export.contacts"
  | "frappe.export.enquiries"
  | "frappe.export.activities"
  | "frappe.export.call-logs"
  | "frappe.availability"
  | "frappe.live-sync"
  | "frappe.live-sync-queue"
  | "frappe.connection"
  | "frappe.users"
  | "frappe.user-mapping"
  | "frappe.identity-audit"
  | "auditor.overview"
  | "auditor.clients"
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
  | "ecommerce.categories"
  | "ecommerce.products"
  | "ecommerce.brands-strip"
  | "ecommerce.campaign-events"
  | "ecommerce.organisation"
  | "ecommerce.catalog"
  | "ecommerce.storefront"
  | "ecommerce.product-information"
  | "ecommerce.product-attributes"
  | "ecommerce.product-specifications"
  | "ecommerce.product-collections"
  | "ecommerce.product-variants"
  | "ecommerce.product-images"
  | "ecommerce.catalog-data-source"
  | "ecommerce.storefront-sliders"
  | "ecommerce.promotions"
  | "ecommerce.featured-cards"
  | "ecommerce.season-strips"
  | "ecommerce.service-banner"
  | "ecommerce.trusted-strip"
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
  | "hrms.attendance"
  | "codexsun.frontdesk"
  | "codexsun.workspace"
  | "codexsun.approvals"
  | "docs.overview"
  | "docs.guide"
  | "docs.library"
  | "codeit.overview"
  | "codeit.settings"
  | "himsx.overview"
  | "himsx.guide"
  | "sites.overview"
  | "sites.studio"
  | "sites.sites"
  | "sites.guide"
  | "logicx-erp.overview"
  | "logicx-erp.schemes"
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
  | "crm.reports"
  | "crm.enquiries"
  | "crm.activities"
  | "crm.closures"
  | "crm.call-logs"
  | "crm.sops"
  | "crm.leads"
  | "crm.tasks"
  | "crm.schedules"
  | "crm.reminders"
  | "crm.duties"
  | "crm.duty-reporting"
  | "crm.enquiries.new"
  | "crm.my-job"
  | "crm.my-calls"
  | "crm.contacts"
  | "crm.contact-360"
  | "crm.list-in"
  | "crm.status"
  | "crm.priority"
  | "blog.overview"
  | "blog.articles"
  | "application.overview"
  | "application.landing"
  | "application.profile"
  | "application.settings"
  | "application.access.users"
  | "application.access.roles"
  | "application.access.permissions"
  | "application.access.user-roles"
  | "application.access.role-permissions"
  | "application.access.controls"
  | "billing.overview"
  | "billing.quotation"
  | "billing.quotation.print"
  | "billing.sales"
  | "billing.sales.print"
  | "billing.purchase"
  | "billing.purchase.print"
  | "billing.export-sales"
  | "billing.export-sales.print"
  | "billing.payment"
  | "billing.receipt"
  | "billing.reports.customer-statement"
  | "billing.reports.customer-summary"
  | "billing.reports.supplier-statement"
  | "billing.reports.supplier-summary"
  | "billing.reports.stock-statement"
  | "billing.reports.gst-statement"
  | "billing.settings"
  | "billing.document-settings"
  | "accounts.overview"
  | "accounts.ledger-groups"
  | "accounts.ledgers"
  | "accounts.journal"
  | "accounts.ledger"
  | "accounts.periods"
  | "accounts.cash-book"
  | "accounts.bank-book"
  | "mail.inbox"
  | "mail.outbox"
  | "mail.drafts"
  | "mail.scheduled"
  | "mail.sent"
  | "mail.failed"
  | "mail.trash"
  | "notes.overview"
  | "chat.overview"
  | "chat.direct"
  | "chat.groups"
  | "chat.channels"
  | "chat.broadcast"
  | "chat.telegram"
  | "chat.telegram.settings"
  | "task-manager.overview"
  | "task-manager.todos"
  | "core.common.location.countries"
  | "core.common.location.states"
  | "core.common.location.districts"
  | "core.common.location.cities"
  | "core.common.location.pincodes"
  | "core.organisation.company"
  | "core.organisation.financial-year"
  | "core.organisation.default-company"
  | "core.master.contact"
  | "core.master.product"
  | "core.master.work-order"
  | `core.common.${"accounts" | "contacts" | "others" | "products" | "workorder"}.${string}`;

function renderSportsclubHeaderAction(
  safePage: AppPage,
  pathname: string,
  onNavigate: (to: string) => void
) {
  const entityMap: Record<string, { label: string; formId: string }> = {
    "sportsclub.members": { label: "student", formId: "sportsclub-member-form" },
    "sportsclub.masters": { label: "master", formId: "sportsclub-master-form" },
    "sportsclub.programs": { label: "curriculum", formId: "sportsclub-program-form" },
    "sportsclub.sessions": { label: "batch", formId: "sportsclub-session-form" },
    "sportsclub.attendance": { label: "attendance", formId: "sportsclub-attendance-form" },
    "sportsclub.progress": { label: "assessment", formId: "sportsclub-progress-form" },
    "sportsclub.events": { label: "event", formId: "sportsclub-event-form" },
    "sportsclub.enquiries": { label: "admission", formId: "sportsclub-enquiry-form" }
  };

  const config = entityMap[safePage];
  if (!config) return null;

  const entityPath = `/app/${safePage.replace(".", "/")}`;
  const isNew = pathname === `${entityPath}/new` || pathname.endsWith("/new");
  const isEdit = pathname.endsWith("/edit");
  const isShow = pathname.startsWith(`${entityPath}/`) && !isNew && !isEdit;

  if (isNew) {
    return (
      <Button
        key={`save-${config.label}`}
        size="sm"
        className="h-7 px-3"
        type="submit"
        form={config.formId}
        aria-keyshortcuts="Control+S"
      >
        Save {config.label}
        <kbd className="ml-1 rounded bg-background/15 px-1.5 py-0.5 text-[10px] font-medium text-background/75">
          Ctrl S
        </kbd>
      </Button>
    );
  }

  if (isEdit) {
    return (
      <Button
        key={`update-${config.label}`}
        size="sm"
        className="h-7 px-3"
        type="submit"
        form={config.formId}
        aria-keyshortcuts="Control+S"
      >
        Update {config.label}
        <kbd className="ml-1 rounded bg-background/15 px-1.5 py-0.5 text-[10px] font-medium text-background/75">
          Ctrl S
        </kbd>
      </Button>
    );
  }

  if (isShow) {
    return (
      <Button
        key={`edit-${config.label}`}
        size="sm"
        className="h-7 px-3"
        type="button"
        onClick={() => onNavigate(`${pathname}/edit`)}
      >
        Edit
      </Button>
    );
  }

  return (
    <Button
      key={`new-${config.label}`}
      size="sm"
      className="h-7 px-3"
      type="button"
      onClick={() => onNavigate(`${entityPath}/new`)}
    >
      <PlusIcon className="size-4" />
      New {config.label}
    </Button>
  );
}

function sportsclubPageTitle(safePage: AppPage, pathname: string): string | null {
  if (!safePage.startsWith("sportsclub.")) return null;
  const entityMap: Record<string, string> = {
    "sportsclub.members": "student",
    "sportsclub.masters": "master",
    "sportsclub.programs": "curriculum",
    "sportsclub.sessions": "batch",
    "sportsclub.attendance": "attendance",
    "sportsclub.progress": "assessment",
    "sportsclub.events": "event",
    "sportsclub.enquiries": "admission"
  };
  const label = entityMap[safePage];
  if (!label) return null;
  if (pathname.endsWith("/new")) {
    return `New ${label}`;
  }
  if (pathname.endsWith("/edit")) {
    return `Edit ${label}`;
  }
  return null;
}

function getSportsclubRouteProps(
  safePage: AppPage,
  pathname: string,
  onNavigate: (to: string) => void
): SportsclubWorkspaceRouteProps {
  const entity = safePage.startsWith("sportsclub.") ? safePage.slice("sportsclub.".length) : "";
  const prefix = `/app/sportsclub/${entity}`;
  const cleanPath = pathname.replace(/\/+$/, "");

  let mode: SportsclubRouteMode = "list";
  let uuid: string | undefined = undefined;

  if (cleanPath === `${prefix}/new`) {
    mode = "new";
  } else if (cleanPath.startsWith(`${prefix}/`)) {
    const segments = cleanPath.slice(`${prefix}/`.length).split("/");
    if (segments.length === 2 && segments[1] === "edit") {
      mode = "edit";
      uuid = segments[0];
    } else if (segments.length === 1 && segments[0]) {
      if (segments[0] === "new") {
        mode = "new";
      } else {
        mode = "view";
        uuid = segments[0];
      }
    }
  }

  const navigateHandler = (
    options: { mode?: SportsclubRouteMode | undefined; uuid?: string | undefined } | string
  ) => {
    if (typeof options === "string") {
      onNavigate(options);
      return;
    }
    const targetMode = options.mode ?? "list";
    if (targetMode === "new") {
      onNavigate(`${prefix}/new`);
    } else if (targetMode === "edit" && options.uuid) {
      onNavigate(`${prefix}/${options.uuid}/edit`);
    } else if (targetMode === "view" && options.uuid) {
      onNavigate(`${prefix}/${options.uuid}`);
    } else {
      onNavigate(prefix);
    }
  };

  return {
    mode,
    uuid,
    onNavigate: navigateHandler
  };
}

export function AppDesk() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const routeSearch: Record<string, unknown> = location.search;
  const navigate = useNavigate();
  const signedInUser = signedInTenantUser();
  const routePage = pageFromUrl(null, location.pathname);
  const crmCounts = useCrmNavigationCounts(signedInUser.email, routePage.startsWith("crm."));
  const crmTaskCount = useTaskNavigationCount(routePage.startsWith("crm."));
  const chatCounts = useChatNavigationCounts(Boolean(signedInUser.email));
  const [pendingListPage, setPendingListPage] = useState<{
    page: AppPage;
    search?: Record<string, string>;
  } | null>(null);
  const [crmListRevision, setCrmListRevision] = useState(0);
  const [taskEditAction, setTaskEditAction] = useState<{ run: () => void } | null>(null);
  const [crmReportTitle, setCrmReportTitle] = useState("List in");
  const [crmContactHeader, setCrmContactHeader] = useState<{
    code: string;
    name: string;
    primaryPhone: string | null;
  } | null>(null);
  const [applicationHeaderTarget, setApplicationHeaderTarget] = useState<HTMLDivElement | null>(
    null
  );
  const dirtyFormsRef = useRef<Set<Element>>(new Set());
  const [shouldResolveLandingPath, setShouldResolveLandingPath] = useState(() =>
    isAppRootPath(location.pathname)
  );
  const runtimeQuery = useQuery({
    queryFn: getTenantRuntime,
    queryKey: ["tenant", "runtime"],
    retry: retryWorkspaceBootstrap,
    retryDelay: workspaceBootstrapRetryDelay,
    staleTime: 5 * 60 * 1_000
  });
  const companiesQuery = useQuery({
    enabled: Boolean(runtimeQuery.data?.tenant?.uuid),
    queryFn: () => listCompanies(),
    queryKey: ["core", "organisation", "companies", runtimeQuery.data?.tenant?.uuid],
    retry: retryWorkspaceBootstrap,
    retryDelay: workspaceBootstrapRetryDelay,
    staleTime: 5 * 60 * 1_000
  });
  const financialYearsQuery = useQuery({
    enabled: Boolean(runtimeQuery.data?.tenant?.uuid),
    queryFn: listFinancialYears,
    queryKey: ["core", "organisation", "financial-years", runtimeQuery.data?.tenant?.uuid],
    retry: retryWorkspaceBootstrap,
    retryDelay: workspaceBootstrapRetryDelay,
    staleTime: 5 * 60 * 1_000
  });
  const defaultCompanyQuery = useQuery({
    enabled: Boolean(runtimeQuery.data?.tenant?.uuid),
    queryFn: getDefaultCompany,
    queryKey: [...defaultCompanyQueryKey, runtimeQuery.data?.tenant?.uuid],
    retry: retryWorkspaceBootstrap,
    retryDelay: workspaceBootstrapRetryDelay,
    staleTime: 5 * 60 * 1_000
  });
  const runtime = runtimeQuery.data;
  const moduleKeys = runtime?.tenant?.enabledModuleKeys ?? ["platform.application"];
  const enabledApps = enabledAppIds(moduleKeys);
  const switchableApps = uniqueApps(enabledApps);
  const activeDefaultCompany =
    defaultCompanyQuery.data?.status === "active" ? defaultCompanyQuery.data : null;
  const persistedLandingApp = activeDefaultCompany?.landingApp as PlatformAppId | undefined;
  const landingApp =
    persistedLandingApp && enabledApps.includes(persistedLandingApp)
      ? persistedLandingApp
      : "application";
  const page = pageFromUrl(landingApp, location.pathname);
  const activeApp = appFromPage(page, landingApp, switchableApps);
  const platformNotifications = usePlatformNotifications(enabledApps.includes("crm"));
  const activeCompanies = useMemo(
    () => (companiesQuery.data ?? []).filter((company) => company.isActive),
    [companiesQuery.data]
  );
  const selectedCompany =
    activeCompanies.find((company) => company.id === activeDefaultCompany?.companyId) ?? null;
  const companyBranding = useCompanyBranding(selectedCompany?.id ?? null);
  useEffect(() => {
    setPlatformFavicon(companyBranding.faviconUrl);
  }, [companyBranding.faviconUrl]);
  const activeFinancialYears = useMemo(
    () => (financialYearsQuery.data ?? []).filter((year) => year.status === "active"),
    [financialYearsQuery.data]
  );
  const selectedFinancialYear =
    activeFinancialYears.find((year) => year.id === activeDefaultCompany?.financialYearId) ?? null;
  const billingSettingsQuery = useQuery({
    enabled:
      activeApp === "billing" &&
      enabledApps.includes("billing") &&
      Boolean(activeDefaultCompany?.companyId),
    queryFn: async () => {
      const module = await import("@codexsun/billing-web/modules/settings/services");
      return module.getBillingSettings();
    },
    queryKey: ["billing", "settings", activeDefaultCompany?.companyId],
    retry: retryWorkspaceBootstrap,
    retryDelay: workspaceBootstrapRetryDelay,
    staleTime: 5 * 60 * 1_000
  });
  const appSafePage =
    page.startsWith("codeit.") && !switchableApps.includes("codeit")
      ? pageForApp(landingApp)
      : page.startsWith("marketing.") && !switchableApps.includes("marketing")
        ? pageForApp(landingApp)
        : page.startsWith("tconnect.") && !switchableApps.includes("tconnect")
          ? pageForApp(landingApp)
          : page.startsWith("sportsclub.") && !switchableApps.includes("sportsclub")
            ? pageForApp(landingApp)
            : page.startsWith("devkit") || page.startsWith("project-manager")
              ? pageForApp(landingApp)
              : page.startsWith("hrms.") && !switchableApps.includes("hrms")
                ? pageForApp(landingApp)
                : page.startsWith("codexsun.") && !switchableApps.includes("codexsun")
                  ? pageForApp(landingApp)
                  : page.startsWith("docs.") && !switchableApps.includes("docs")
                    ? pageForApp(landingApp)
                    : page.startsWith("himsx.") && !switchableApps.includes("himsx")
                      ? pageForApp(landingApp)
                      : page.startsWith("sites.") && !switchableApps.includes("sites")
                        ? pageForApp(landingApp)
                        : page.startsWith("qcafe") && !switchableApps.includes("qcafe")
                          ? pageForApp(landingApp)
                          : page.startsWith("ecommerce") && !switchableApps.includes("ecommerce")
                            ? pageForApp(landingApp)
                            : page.startsWith("auditor") && !switchableApps.includes("auditor")
                              ? pageForApp(landingApp)
                              : page.startsWith("logicx-erp") &&
                                  !switchableApps.includes("logicx-erp")
                                ? pageForApp(landingApp)
                                : page.startsWith("logicx-erp.schemes") &&
                                    !enabledApps.includes("billing")
                                  ? "logicx-erp.overview"
                                  : page.startsWith("zetro") && !switchableApps.includes("zetro")
                                    ? pageForApp(landingApp)
                                    : page.startsWith("frappe") &&
                                        !switchableApps.includes("frappe")
                                      ? pageForApp(landingApp)
                                      : page.startsWith("task-manager") &&
                                          !switchableApps.includes("task-manager")
                                        ? pageForApp(landingApp)
                                        : page.startsWith("mail") &&
                                            !switchableApps.includes("mail")
                                          ? pageForApp(landingApp)
                                          : page.startsWith("notes") &&
                                              !switchableApps.includes("notes")
                                            ? pageForApp(landingApp)
                                            : page.startsWith("chat") &&
                                                !switchableApps.includes("chat")
                                              ? pageForApp(landingApp)
                                              : page.startsWith("crm") &&
                                                  !switchableApps.includes("crm")
                                                ? pageForApp(landingApp)
                                                : page.startsWith("blog") &&
                                                    !switchableApps.includes("blog")
                                                  ? pageForApp(landingApp)
                                                  : page.startsWith("accounts") &&
                                                      !switchableApps.includes("accounts")
                                                    ? pageForApp(landingApp)
                                                    : (page.startsWith("billing") ||
                                                          (page.startsWith("core") &&
                                                            !page.startsWith(
                                                              "core.organisation"
                                                            ))) &&
                                                        !switchableApps.includes("billing")
                                                      ? pageForApp(landingApp)
                                                      : page;
  const safePage = resolveBillingFeaturePage(appSafePage, billingSettingsQuery.data?.features);
  const sportsclubTitle = sportsclubPageTitle(safePage, location.pathname);
  const activePageTitle =
    sportsclubTitle ??
    (safePage === "hrms.employees" && location.pathname.endsWith("/new")
      ? "New employee"
      : safePage === "hrms.employees" && location.pathname.endsWith("/edit")
        ? "Edit employee"
        : safePage === "crm.reports"
          ? crmReportTitle
          : safePage === "crm.enquiries"
            ? "Enquiries"
            : safePage === "crm.tasks" && location.pathname === "/app/crm/tasks/new"
              ? "New task"
              : titleForPage(safePage));
  const handleSportsclubNavigate = (to: string) => {
    const splat = to.startsWith("/app/") ? to.replace(/^\/app\//, "") : to;
    void navigate({ to: "/app/$", params: { _splat: splat } });
  };
  const accountingYear = selectedFinancialYear?.name ?? "Accounting year";
  const defaultSelectionMutation = useMutation({
    mutationFn: saveDefaultCompany,
    onSuccess: async (record) => {
      publishCompanyContext(record.companyId);
      publishAccountingYear(record.financialYearId);
      await queryClient.invalidateQueries({ queryKey: defaultCompanyQueryKey });
      toast.success("Startup defaults updated");
    },
    onError: (error) =>
      toast.error("Startup defaults could not be updated", {
        description: error instanceof Error ? error.message : "Update failed."
      })
  });

  useEffect(() => {
    setPlatformDocumentTitle(activePageTitle);
  }, [activePageTitle]);

  useEffect(() => {
    if (isAppRootPath(location.pathname) || !runtime || !defaultCompanyQuery.isFetched) return;
    if (tenantPathMatchesPage(location.pathname, safePage)) return;
    navigatePage(safePage, true);
  }, [defaultCompanyQuery.isFetched, location.pathname, runtime, safePage]);

  useEffect(() => {
    dirtyFormsRef.current.clear();
    setPendingListPage(null);
  }, [location.href]);

  useEffect(() => {
    if (activeApp !== "billing") return;

    const preload = () => {
      void Promise.allSettled(billingWorkspacePreloaders.map((loader) => loader()));
    };

    if ("requestIdleCallback" in window) {
      const idleCallbackId = window.requestIdleCallback(preload, { timeout: 2_000 });
      return () => window.cancelIdleCallback(idleCallbackId);
    }

    const timeoutId = setTimeout(preload, 750);
    return () => clearTimeout(timeoutId);
  }, [activeApp]);

  useEffect(() => {
    if (!isBillingFeaturePageDisabled(page, billingSettingsQuery.data?.features)) return;
    const fallbackPage: AppPage = "billing.overview";
    navigatePage(fallbackPage, true);
  }, [billingSettingsQuery.data?.features, page]);

  useEffect(() => {
    if (!selectedCompany) return;
    publishCompanyContext(selectedCompany.id);
  }, [selectedCompany]);

  useEffect(() => {
    if (!selectedFinancialYear) return;
    publishAccountingYear(selectedFinancialYear.id);
  }, [selectedFinancialYear]);

  useEffect(() => {
    const tenant = runtime?.tenant;
    if (!tenant?.corporateId || !defaultCompanyQuery.isFetched) return;

    publishDesktopWorkspace({
      companyId: activeDefaultCompany?.companyId ?? null,
      companyName: activeDefaultCompany?.companyName ?? null,
      corporateId: tenant.corporateId,
      financialYearId: activeDefaultCompany?.financialYearId ?? null,
      financialYearName: activeDefaultCompany?.financialYearName ?? null,
      landingPage: appRootUrl(landingApp),
      tenantCode: tenant.tenantCode,
      tenantName: tenant.tenantName,
      tenantUuid: tenant.uuid
    });
  }, [activeDefaultCompany, defaultCompanyQuery.isFetched, landingApp, runtime?.tenant]);

  useEffect(() => {
    if (!shouldResolveLandingPath) return;
    if (runtimeQuery.isLoading || !defaultCompanyQuery.isFetched) return;

    const landingPage = pageForApp(landingApp);
    setShouldResolveLandingPath(false);
    navigatePage(landingPage, true);
    setPlatformDocumentTitle(titleForPage(landingPage));
  }, [defaultCompanyQuery.isFetched, landingApp, runtimeQuery.isLoading, shouldResolveLandingPath]);

  function selectPage(nextPage: AppPage) {
    const allowedPage = resolveBillingFeaturePage(nextPage, billingSettingsQuery.data?.features);
    navigatePage(allowedPage);
    setPlatformDocumentTitle(titleForPage(allowedPage));
  }

  function navigatePage(nextPage: AppPage, replace = false, search: Record<string, string> = {}) {
    void navigate({
      params: {
        _splat:
          nextPage === "ecommerce.overview"
            ? "ecommerce"
            : nextPage === "qcafe.overview"
              ? "qcafe"
              : nextPage.replaceAll(".", "/")
      },
      replace,
      search,
      to: "/app/$"
    });
  }

  function completeListNavigation(
    nextPage: AppPage,
    replaceHistory = false,
    search?: Record<string, string>
  ) {
    const allowedPage = resolveBillingFeaturePage(nextPage, billingSettingsQuery.data?.features);
    dirtyFormsRef.current.clear();
    setPendingListPage(null);
    if (
      isCrmListPage(allowedPage) ||
      allowedPage.startsWith("application.") ||
      allowedPage.startsWith("core.") ||
      allowedPage.startsWith("billing.") ||
      allowedPage.startsWith("ecommerce.") ||
      allowedPage.startsWith("auditor.") ||
      allowedPage.startsWith("accounts.") ||
      allowedPage.startsWith("hrms.")
    )
      setCrmListRevision((revision) => revision + 1);
    navigatePage(allowedPage, replaceHistory, search);
    setPlatformDocumentTitle(titleForPage(allowedPage));
  }

  function requestListNavigation(nextPage: AppPage, search?: Record<string, string>) {
    if (
      Array.from(dirtyFormsRef.current).some((form) => form.isConnected) ||
      /\/(new|edit)$/.test(location.pathname) ||
      routeSearch.form === "new" ||
      routeSearch.form === "edit"
    ) {
      setPendingListPage({ page: nextPage, ...(search ? { search } : {}) });
      return;
    }
    completeListNavigation(nextPage, false, search);
  }

  function openMobileEnquiries(mobile: string, contactId: number | null) {
    requestListNavigation("crm.enquiries", {
      mobile,
      ...(contactId ? { contactId: String(contactId) } : {})
    });
  }

  function openMobileEnquiry(id: string, mobile: string, contactId: number | null) {
    requestListNavigation("crm.enquiries", {
      record: String(id),
      mobile,
      ...(contactId ? { contactId: String(contactId) } : {})
    });
  }

  function openEnquiryRecord(key: string) {
    void navigate({
      params: { _splat: `crm/enquiries/${encodeURIComponent(key)}` },
      to: "/app/$"
    });
  }

  function openTaskRecord(key: string) {
    if (location.pathname === "/app/crm/tasks/new") {
      requestListNavigation("crm.tasks", { record: key });
      return;
    }
    void navigate({ params: { _splat: `crm/tasks/${encodeURIComponent(key)}` }, to: "/app/$" });
  }

  function openNewTask() {
    void navigate({ params: { _splat: "crm/tasks/new" }, to: "/app/$" });
  }

  function openNewContact() {
    void navigate({ params: { _splat: "crm/contacts/new" }, to: "/app/$" });
  }

  useEffect(() => {
    if (activeApp !== "crm") return;

    function openCrmShortcut(event: KeyboardEvent) {
      if (!event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("input, textarea, select, [contenteditable=true]"))
      ) {
        return;
      }

      if (!event.altKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        if (safePage !== "crm.enquiries.new") requestListNavigation("crm.enquiries.new");
      }
      if (
        !event.altKey &&
        event.key.toLowerCase() === "c" &&
        safePage === "crm.contacts" &&
        location.pathname === "/app/crm/contacts" &&
        !window.getSelection()?.toString()
      ) {
        event.preventDefault();
        openNewContact();
      }
    }

    window.addEventListener("keydown", openCrmShortcut);
    return () => window.removeEventListener("keydown", openCrmShortcut);
  });

  function openReportEnquiries(filters: EnquiryReportFilters) {
    void navigate({
      params: { _splat: "crm/enquiries" },
      search: { report: "1", ...filters },
      to: "/app/$"
    });
    setPlatformDocumentTitle("All Enquiries");
  }

  function markUnsavedFormChanges(event: FormEvent<HTMLElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const form = target.closest("form, [data-codexsun-draft-form]");
    if (form) dirtyFormsRef.current.add(form);
  }

  function selectBillingRecord(nextPage: AppPage, recordId: string) {
    const allowedPage = resolveBillingFeaturePage(nextPage, billingSettingsQuery.data?.features);
    const path = `/app/${allowedPage.replaceAll(".", "/")}`;
    void navigate({
      to: allowedPage === nextPage ? `${path}/${encodeURIComponent(recordId)}` : path
    });
    setPlatformDocumentTitle(titleForPage(allowedPage));
  }

  function selectAuditorRecord(recordId: string | null) {
    void navigate({
      params: { _splat: "auditor/clients" },
      search: recordId ? { record: recordId } : {},
      to: "/app/$"
    });
  }

  function publishLandingApp(nextLandingApp: PlatformAppId) {
    if (!activeDefaultCompany) return;
    defaultSelectionMutation.mutate({
      companyId: activeDefaultCompany.companyId,
      financialYearId: activeDefaultCompany.financialYearId,
      landingApp: nextLandingApp,
      status: "active"
    });
  }

  async function handleLogout() {
    await logout("tenant");
    queryClient.removeQueries({ queryKey: ["zetro"] });
    window.location.assign("/login");
  }

  function updateGlobalDefault(companyId: number, financialYearId: number) {
    defaultSelectionMutation.mutate({
      companyId,
      financialYearId,
      landingApp,
      status: "active"
    });
  }

  const telegramWorkspace = safePage.startsWith("chat.telegram");
  const activeWorkspaceTitle = telegramWorkspace
    ? "Telegram"
    : (platformAppRegistry.find((app) => app.id === activeApp)?.label ?? "Application");
  const showingCrmContact =
    safePage === "crm.contacts" && /^\/app\/crm\/contacts\/[^/]+\/show$/.test(location.pathname);
  const docsCatalog = useKnowledgeCatalog(docsKnowledgeGateway, activeApp === "docs");
  const selectedDocKey = new URLSearchParams(location.searchStr).get("page") ?? "";
  const openDocPage = (page: string) => {
    void navigate({ to: "/app/$", params: { _splat: "docs/library" }, search: { page } });
  };
  const menuItems = telegramWorkspace
    ? chatTelegramMenuItems(safePage, requestListNavigation)
    : [
        ...appMenuItemsFor(
          activeApp,
          safePage === "crm.enquiries.new" ? "crm.enquiries" : safePage,
          (nextPage) => requestListNavigation(nextPage as AppPage),
          billingSettingsQuery.data?.features,
          crmCounts,
          enabledApps.includes("billing"),
          chatCounts,
          crmTaskCount
        ),
        ...(activeApp === "docs"
          ? buildKnowledgeMenu(docsCatalog.data?.pages ?? [], selectedDocKey, openDocPage)
          : [])
      ];
  const workspaceItems = appWorkspaceItems(switchableApps, activeApp).map((item) => ({
    ...item,
    active: item.active && !telegramWorkspace,
    onSelect: () =>
      item.appId === "ecommerce"
        ? void navigate({ params: { _splat: "ecommerce" }, to: "/app/$" })
        : requestListNavigation(pageForApp(item.appId))
  }));
  const addonWorkspaceItems = workspaceItems.filter((item) => deskAddonAppIds.includes(item.appId));
  const appLauncherItems = [
    ...workspaceItems.filter((item) => !deskAddonAppIds.includes(item.appId)),
    ...(switchableApps.includes("chat")
      ? [chatTelegramLauncherItem(telegramWorkspace, () => requestListNavigation("chat.telegram"))]
      : [])
  ];

  const contextError =
    defaultCompanyQuery.isSuccess && runtime?.tenant && !activeDefaultCompany
      ? new Error("Configure an active Default Company before opening the tenant workspace.")
      : companiesQuery.isSuccess && runtime?.tenant && !selectedCompany
        ? new Error("No active company is available for this tenant.")
        : financialYearsQuery.isSuccess && runtime?.tenant && !selectedFinancialYear
          ? new Error("No active financial year is available for this tenant.")
          : null;

  const bootstrapLoading =
    runtimeQuery.isLoading ||
    companiesQuery.isLoading ||
    financialYearsQuery.isLoading ||
    defaultCompanyQuery.isLoading ||
    (!selectedCompany && !contextError) ||
    (!selectedFinancialYear && !contextError) ||
    (activeApp === "billing" && billingSettingsQuery.isLoading);
  const bootstrapError =
    (runtimeQuery.isError && !runtimeQuery.isFetching ? runtimeQuery.error : null) ??
    (companiesQuery.isError && !companiesQuery.isFetching ? companiesQuery.error : null) ??
    (financialYearsQuery.isError && !financialYearsQuery.isFetching
      ? financialYearsQuery.error
      : null) ??
    (defaultCompanyQuery.isError && !defaultCompanyQuery.isFetching
      ? defaultCompanyQuery.error
      : null) ??
    (activeApp === "billing" && billingSettingsQuery.isError && !billingSettingsQuery.isFetching
      ? billingSettingsQuery.error
      : null) ??
    contextError;
  const bootstrapRequestsSettled =
    !runtimeQuery.isFetching &&
    !companiesQuery.isFetching &&
    !financialYearsQuery.isFetching &&
    !defaultCompanyQuery.isFetching &&
    (activeApp !== "billing" || !billingSettingsQuery.isFetching);
  const showBootstrapError = Boolean(bootstrapError) && bootstrapRequestsSettled;

  if (showBootstrapError) {
    return <TenantBootstrapErrorScreen error={bootstrapError} />;
  }

  if (bootstrapLoading) {
    return <GlobalLoader message={workspaceLoadingMessage} steady />;
  }

  return (
    <WorkspaceNavigationProvider
      headerTarget={applicationHeaderTarget}
      inlineForms={
        activeApp === "application" ||
        safePage.startsWith("core.") ||
        routeSearch.form === "new" ||
        routeSearch.form === "edit"
      }
      search={location.search}
      onSearchChange={(search) => {
        void navigate({ to: location.pathname, search, replace: true });
      }}
    >
      <TenantMainLayout
        notifications={platformNotifications.notifications}
        onNotificationDismiss={platformNotifications.dismiss}
        {...(safePage.startsWith("qcafe.")
          ? { headerContent: <QCafeAppHeader page={safePage} /> }
          : {})}
        fullBleed={safePage.startsWith("chat.") && safePage !== "chat.telegram.settings"}
        hideAppHeader={safePage.startsWith("chat.") && safePage !== "chat.telegram.settings"}
        headerActionsAlignment={
          activeApp === "application" || safePage.startsWith("core.") || activeApp === "billing"
            ? "workspace"
            : safePage === "hrms.employees"
              ? location.pathname === "/app/hrms/employees"
                ? "workspace"
                : "form"
              : safePage === "crm.enquiries.new"
                ? "form"
                : safePage === "crm.tasks" && location.pathname === "/app/crm/tasks/new"
                  ? "form"
                  : safePage === "crm.enquiries" ||
                      safePage === "crm.tasks" ||
                      (safePage === "crm.contacts" && location.pathname === "/app/crm/contacts")
                    ? "workspace"
                    : "edge"
        }
        appItems={appLauncherItems}
        addonAppItems={addonWorkspaceItems}
        brand={{
          href: telegramWorkspace ? "/app/chat/telegram" : appRootUrl(activeApp),
          ...(companyBranding.lightLogoUrl ? { logoSrc: companyBranding.lightLogoUrl } : {}),
          ...(companyBranding.darkLogoUrl ? { logoDarkSrc: companyBranding.darkLogoUrl } : {}),
          logoAlt: `${companyBranding.brandName ?? "Company"} logo`,
          options: activeCompanies.map((company) => ({
            id: String(company.id),
            subtitle: accountingYear,
            title: companyBrandName(company)
          })),
          optionsLabel: "Company",
          onOptionSelect: (id) => {
            if (!selectedFinancialYear) return;
            updateGlobalDefault(Number(id), selectedFinancialYear.id);
          },
          onSecondaryOptionSelect: (id) => {
            if (!selectedCompany) return;
            updateGlobalDefault(selectedCompany.id, Number(id));
          },
          ...(selectedCompany ? { selectedOptionId: String(selectedCompany.id) } : {}),
          ...(selectedFinancialYear
            ? { selectedSecondaryOptionId: String(selectedFinancialYear.id) }
            : {}),
          secondaryOptions: activeFinancialYears.map((year) => ({
            id: String(year.id),
            title: year.name
          })),
          secondaryOptionsLabel: "Financial year",
          subtitle: selectedFinancialYear
            ? selectedFinancialYear.name
            : `${activeWorkspaceTitle.toLowerCase()} workspace`,
          title: companyBranding.brandName ?? activeWorkspaceTitle
        }}
        headerTitle={activePageTitle}
        {...(showingCrmContact
          ? {
              headerContent: <CrmContactApplicationHeader contact={crmContactHeader} />
            }
          : {})}
        headerActions={
          <>
            {activeApp === "application" ||
            safePage.startsWith("core.") ? null : safePage.startsWith("ecommerce.") ? (
              <EcommerceStorefrontControls gateway={ecommerceStorefrontRuntimeGateway} />
            ) : safePage === "hrms.employees" ? (
              location.pathname === "/app/hrms/employees" ? (
                <Button
                  key="new-hrms-employee"
                  size="sm"
                  className="h-7 px-3"
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    void navigate({ to: "/app/$", params: { _splat: "hrms/employees/new" } });
                  }}
                >
                  <PlusIcon className="size-4" />
                  New employee
                </Button>
              ) : (
                <Button
                  key="save-hrms-employee"
                  size="sm"
                  className="h-7 px-3"
                  type="submit"
                  form={employeeFormId}
                  aria-keyshortcuts="Control+S"
                >
                  {location.pathname.endsWith("/edit") ? "Update employee" : "Save employee"}
                  <kbd className="ml-1 rounded bg-background/15 px-1.5 py-0.5 text-[10px] font-medium text-background/75">
                    Ctrl S
                  </kbd>
                </Button>
              )
            ) : safePage === "crm.contacts" && location.pathname === "/app/crm/contacts" ? (
              <Button
                size="sm"
                className="h-7 px-3"
                aria-keyshortcuts="Control+C"
                onClick={openNewContact}
              >
                <PlusIcon className="size-4" />
                New
                <kbd className="ml-1 rounded bg-background/15 px-1.5 py-0.5 text-[10px] font-medium text-background/75">
                  Ctrl C
                </kbd>
              </Button>
            ) : safePage === "crm.enquiries" ? (
              <Button
                key="new-enquiry"
                size="sm"
                className="h-7 px-3"
                type="button"
                aria-keyshortcuts="Control+E"
                onClick={(event) => {
                  event.preventDefault();
                  requestListNavigation("crm.enquiries.new");
                }}
              >
                <PlusIcon className="size-4" />
                New enquiry
                <kbd className="ml-1 rounded bg-background/15 px-1.5 py-0.5 text-[10px] font-medium text-background/75">
                  Ctrl E
                </kbd>
              </Button>
            ) : safePage === "crm.tasks" && location.pathname === "/app/crm/tasks" ? (
              <Button
                key="new-task"
                size="sm"
                className="h-7 px-3"
                type="button"
                onClick={openNewTask}
              >
                <PlusIcon className="size-4" />
                New task
              </Button>
            ) : safePage === "crm.tasks" && location.pathname === "/app/crm/tasks/new" ? (
              <Button
                key="save-task"
                size="sm"
                className="h-7 px-3"
                type="submit"
                form="crm-new-task-form"
                aria-keyshortcuts="Control+S"
              >
                Save task
                <kbd className="ml-1 rounded bg-background/15 px-1.5 py-0.5 text-[10px] font-medium text-background/75">
                  Ctrl S
                </kbd>
              </Button>
            ) : safePage === "crm.tasks" &&
              /^\/app\/crm\/tasks\/[^/]+$/.test(location.pathname) &&
              location.pathname !== "/app/crm/tasks/new" &&
              taskEditAction ? (
              <Button
                key="edit-task"
                size="sm"
                className="h-7 px-3"
                type="button"
                onClick={taskEditAction.run}
              >
                Edit
              </Button>
            ) : safePage === "crm.enquiries.new" ? (
              <Button
                key="save-enquiry"
                size="sm"
                className="h-7 px-3"
                type="submit"
                form={newEnquiryFormId}
                aria-keyshortcuts="Control+S"
              >
                Save enquiry
                <kbd className="ml-1 rounded bg-background/15 px-1.5 py-0.5 text-[10px] font-medium text-background/75">
                  Ctrl S
                </kbd>
              </Button>
            ) : safePage.startsWith("sportsclub.") ? (
              renderSportsclubHeaderAction(safePage, location.pathname, handleSportsclubNavigate)
            ) : null}
            <div
              ref={setApplicationHeaderTarget}
              className="flex items-center gap-2 [&_button]:h-7 [&_button]:px-3 [&_button]:text-xs"
            />
          </>
        }
        hideSidebarBrand={
          safePage.startsWith("qcafe.") ||
          activeApp === "ecommerce" ||
          activeApp === "crm" ||
          activeApp === "marketing" ||
          activeApp === "hrms" ||
          activeApp === "chat" ||
          activeApp === "frappe" ||
          activeApp === "sportsclub"
        }
        homeHref={telegramWorkspace ? "/app/chat/telegram" : appRootUrl(activeApp)}
        menuItems={menuItems}
        omitWorkspaceBreadcrumb

        onLogout={handleLogout}
        onOpenSettings={() =>
          requestListNavigation(
            activeApp === "codeit"
              ? "codeit.settings"
              : activeApp === "qcafe"
                ? "qcafe.settings"
                : telegramWorkspace
                  ? "chat.telegram.settings"
                  : "application.settings"
          )
        }
        settingsActive={
          safePage === "codeit.settings" ||
          safePage === "qcafe.settings" ||
          safePage === "application.settings" ||
          safePage === "chat.telegram.settings"
        }
        user={signedInUser}
        versionLabel={`v ${__APP_VERSION__}`}
        workspaceName={activeWorkspaceTitle}
        zetroDrawer={
          switchableApps.includes("zetro") ? (
            <Suspense fallback={null}>
              <ZetroChatDrawer
                key={`${runtime?.tenant?.uuid ?? "tenant"}:${signedInUser.email}`}
                scopeKey={`${runtime?.tenant?.uuid ?? "tenant"}:${signedInUser.email}`}
              />
            </Suspense>
          ) : null
        }
      >
        <main
          className={
            safePage.startsWith("qcafe.") &&
            safePage !== "qcafe.menu" &&
            safePage !== "qcafe.settings"
              ? "w-full min-w-0"
              : safePage.startsWith("chat.")
                ? "flex flex-1 min-h-0 w-full flex-col overflow-hidden"
                : "mx-auto w-[calc(100%-2rem)] max-w-[92rem] space-y-5 py-4 lg:w-[calc(100%-3rem)] lg:py-5"
          }
          onChangeCapture={markUnsavedFormChanges}
          onInputCapture={markUnsavedFormChanges}
        >
          <Suspense
            key={
              safePage.startsWith("qcafe.")
                ? "qcafe"
                : safePage.startsWith("application.") ||
                    safePage.startsWith("core.") ||
                    safePage.startsWith("billing.") ||
                    safePage.startsWith("ecommerce.") ||
                    safePage.startsWith("auditor.") ||
                    safePage.startsWith("accounts.") ||
                    safePage.startsWith("hrms.") ||
                    safePage === "crm.contacts" ||
                    safePage === "crm.status" ||
                    safePage === "crm.priority" ||
                    safePage === "crm.list-in" ||
                    safePage === "logicx-erp.schemes"
                  ? `${safePage}:${crmListRevision}`
                  : `${safePage}:${location.href}`
            }
            fallback={
              <GlobalLoader
                className="min-h-[32rem]"
                fullScreen={false}
                message={`Loading ${activeWorkspaceTitle.toLowerCase()}...`}
              />
            }
          >
            {safePage === "blog.overview" || safePage === "blog.articles" ? (
              <BlogsEditorWorkspace host={blogEditorHost} />
            ) : null}
            {safePage === "hrms.employees" ? <EmployeeWorkspace gateway={employeeGateway} /> : null}
            {safePage === "hrms.attendance" ? (
              <HrmsAttendanceWorkspace gateway={attendanceGateway} />
            ) : null}
            {safePage === "hrms.overview" ? (
              <HrmsOverviewWorkspace
                gateway={hrmsOverviewGateway}
                currentUserName={signedInUser.name}
                onOpenAttendance={() => requestListNavigation("hrms.attendance")}
                onOpenEmployees={() => requestListNavigation("hrms.employees")}
              />
            ) : null}
            {safePage === "codexsun.frontdesk" ||
            safePage === "codexsun.workspace" ||
            safePage === "codexsun.approvals" ? (
              <CodexsunHost
                surface={
                  safePage === "codexsun.workspace"
                    ? "workspace"
                    : safePage === "codexsun.approvals"
                      ? "approvals"
                      : "frontdesk"
                }
              />
            ) : null}
            {safePage === "docs.library" ? (
              <DocsKnowledgeWorkspace
                gateway={docsKnowledgeGateway}
                selectedKey={selectedDocKey}
                onSelect={openDocPage}
              />
            ) : null}
            {safePage === "docs.overview" || safePage === "docs.guide" ? (
              <DocsOverviewWorkspace
                gateway={docsOverviewGateway}
                guide={safePage === "docs.guide"}
                onNavigate={requestListNavigation}
              />
            ) : null}
            {safePage === "himsx.overview" || safePage === "himsx.guide" ? (
              <HimsxOverviewWorkspace
                gateway={himsxOverviewGateway}
                guide={safePage === "himsx.guide"}
                onNavigate={requestListNavigation}
              />
            ) : null}
            {safePage.startsWith("marketing.") ? (
              <MarketingHost page={safePage} companyId={activeDefaultCompany?.companyId ?? null} />
            ) : null}
            {safePage.startsWith("sites.") ? (
              <SitesOverviewWorkspace
                gateway={sitesOverviewGateway}
                guide={safePage === "sites.guide"}
                siteGateway={siteGateway}
                view={
                  safePage === "sites.sites"
                    ? "portfolios"
                    : safePage === "sites.guide"
                      ? "guide"
                      : "studio"
                }
                onNavigate={requestListNavigation}
              />
            ) : null}
            {safePage === "auditor.overview" ? <AuditorOverviewWorkspace /> : null}
            {ecommerceModulePages.includes(safePage as EcommerceModulePage) ? (
              <EcommerceModuleWorkspace
                page={safePage as EcommerceModulePage}
                onOpenStore={openPublicStorefront}
              />
            ) : null}
            {safePage === "tconnect.overview" ? (
              <TconnectWorkspace gateway={tconnectGateway} />
            ) : null}
            {safePage === "sportsclub.overview" ? (
              <SportsclubOverviewWorkspace
                userRole="admin"
                currentUserName={signedInUser.name || "Club Administrator"}
                onOpenWorkspace={(tab) => {
                  requestListNavigation(`sportsclub.${tab}` as AppPage);
                }}
              />
            ) : null}
            {safePage === "sportsclub.members" ? (
              <SportsclubMemberWorkspace
                {...getSportsclubRouteProps(safePage, location.pathname, handleSportsclubNavigate)}
              />
            ) : null}
            {safePage === "sportsclub.masters" ? (
              <SportsclubMasterWorkspace
                {...getSportsclubRouteProps(safePage, location.pathname, handleSportsclubNavigate)}
              />
            ) : null}
            {safePage === "sportsclub.programs" ? (
              <SportsclubProgramWorkspace
                {...getSportsclubRouteProps(safePage, location.pathname, handleSportsclubNavigate)}
              />
            ) : null}
            {safePage === "sportsclub.sessions" ? (
              <SportsclubSessionWorkspace
                {...getSportsclubRouteProps(safePage, location.pathname, handleSportsclubNavigate)}
              />
            ) : null}
            {safePage === "sportsclub.attendance" ? (
              <SportsclubAttendanceWorkspace
                {...getSportsclubRouteProps(safePage, location.pathname, handleSportsclubNavigate)}
              />
            ) : null}
            {safePage === "sportsclub.progress" ? (
              <SportsclubProgressWorkspace
                {...getSportsclubRouteProps(safePage, location.pathname, handleSportsclubNavigate)}
              />
            ) : null}
            {safePage === "sportsclub.events" ? (
              <SportsclubEventWorkspace
                {...getSportsclubRouteProps(safePage, location.pathname, handleSportsclubNavigate)}
              />
            ) : null}
            {safePage === "sportsclub.enquiries" ? (
              <SportsclubEnquiryWorkspace
                {...getSportsclubRouteProps(safePage, location.pathname, handleSportsclubNavigate)}
              />
            ) : null}
            {safePage === "ecommerce.overview" ? (
              <EcommerceOverviewWorkspace gateway={ecommerceOverviewGateway} />
            ) : null}
            {safePage === "ecommerce.categories" ? <ProductCategoriesWorkspace /> : null}
            {safePage === "ecommerce.products" ? <ProductWorkspace /> : null}
            {safePage === "ecommerce.brands-strip" ? <BrandsWorkspace /> : null}
            {safePage === "logicx-erp.overview" ? (
              <LogicxErpOverviewWorkspace gateway={logicxErpOverviewGateway} />
            ) : null}
            {safePage === "logicx-erp.schemes" ? (
              <LogicxErpSchemeWorkspace gateway={logicxErpSchemeGateway} />
            ) : null}
            {safePage === "frappe.overview" ? <FrappeOverviewWorkspace /> : null}
            {safePage === "zetro.chat" ? (
              <ZetroChatWorkspace
                scopeKey={`${runtime?.tenant?.uuid ?? "tenant"}:${signedInUser.email}`}
              />
            ) : null}
            {safePage === "frappe.contacts" ? <FrappeContactImportWorkspace /> : null}
            {safePage === "frappe.enquiries" ? <FrappeEnquiryImportWorkspace /> : null}
            {safePage === "frappe.activities" ? <FrappeActivityImportWorkspace /> : null}
            {safePage === "frappe.call-logs" ? <FrappeCallLogImportWorkspace /> : null}
            {safePage === "frappe.export.contacts" ? <FrappeContactExportWorkspace /> : null}
            {safePage === "frappe.export.enquiries" ? <FrappeEnquiryExportWorkspace /> : null}
            {safePage === "frappe.export.activities" ? <FrappeActivityExportWorkspace /> : null}
            {safePage === "frappe.export.call-logs" ? <FrappeCallLogExportWorkspace /> : null}
            {safePage === "frappe.availability" ? <FrappeAvailabilityWorkspace /> : null}
            {safePage === "frappe.live-sync" ? <FrappeLiveSyncWorkspace /> : null}
            {safePage === "frappe.live-sync-queue" ? <FrappeLiveSyncQueueWorkspace /> : null}
            {safePage === "frappe.connection" ? <FrappeConnectionWorkspace /> : null}
            {safePage === "frappe.users" ? <FrappeUserSyncWorkspace /> : null}
            {safePage === "frappe.user-mapping" ? <FrappeUserMappingWorkspace /> : null}
            {safePage === "frappe.identity-audit" ? <FrappeIdentityAuditWorkspace /> : null}
            {safePage === "auditor.clients" ? (
              <AuditorClientWorkspace
                gateway={auditorClientGateway}
                initialRecordId={recordIdFromUrl()}
                onRecordNavigate={selectAuditorRecord}
              />
            ) : null}
            {safePage.startsWith("qcafe.") ? (
              <QCafeWebApp
                appearanceSettings={<QCafeAppearance />}
                workspace={
                  safePage === "qcafe.dashboard"
                    ? "overview"
                    : safePage === "qcafe.kitchen"
                      ? "kitchen"
                      : safePage === "qcafe.settings"
                        ? "settings"
                        : safePage === "qcafe.menu"
                          ? "menu"
                          : safePage === "qcafe.kot"
                            ? "kot"
                            : safePage === "qcafe.take-away"
                              ? "take-away"
                              : safePage === "qcafe.booking"
                                ? "booking"
                                : "pos"
                }
                onWorkspaceChange={(workspace) =>
                  requestListNavigation(
                    workspace === "pos"
                      ? "qcafe.overview"
                      : workspace === "kot"
                        ? "qcafe.kot"
                        : workspace === "booking"
                          ? "qcafe.booking"
                          : "qcafe.take-away"
                  )
                }
              />
            ) : null}
            {safePage === "crm.overview" ? (
              <CrmOverviewWorkspace
                currentUserName={signedInUser.name}
                onOpenPage={(page) => requestListNavigation(page)}
              />
            ) : null}
            {safePage === "crm.reports" ? (
              <CrmReportsWorkspace
                onOpenEnquiries={openReportEnquiries}
                onViewChange={setCrmReportTitle}
              />
            ) : null}
            {safePage === "crm.contacts" ? (
              <CrmContactWorkspace
                key={`${safePage}:${crmListRevision}`}
                basePath="/app/crm/contacts"
                hideSinglePagePagination
                showListHeader={false}
                onOpenEnquiry={openEnquiryRecord}
                onShowContextChange={setCrmContactHeader}
              />
            ) : null}
            {safePage === "crm.contact-360" ? <Contact360Workspace key={safePage} /> : null}
            {safePage === "crm.activities" ? (
              <ActivitiesWorkspace
                key={`${safePage}:${crmListRevision}`}
                onOpenEnquiry={(id) => openEnquiryRecord(String(id))}
              />
            ) : null}
            {safePage === "crm.sops" ? <SopWorkspace /> : null}
            {safePage === "crm.schedules" ? <SchedulerWorkspace view="schedules" /> : null}
            {safePage === "crm.reminders" ? <SchedulerWorkspace view="reminders" /> : null}
            {safePage === "crm.leads" ? <LeadWorkspace /> : null}
            {safePage === "crm.tasks" ? (
              <TaskWorkspace
                key={`${safePage}:${location.pathname}:${crmListRevision}`}
                initialRecordKey={taskRecordKeyFromLocation(location.href)}
                initialCreate={location.pathname === "/app/crm/tasks/new"}
                onOpenRecord={openTaskRecord}
                onCloseCreate={() => completeListNavigation("crm.tasks", true)}
                onCancelCreate={() => requestListNavigation("crm.tasks")}
                onEditActionChange={setTaskEditAction}
              />
            ) : null}
            {safePage === "crm.duties" ? <MyDutiesWorkspace /> : null}
            {safePage === "crm.duty-reporting" ? <DutyReportingWorkspace /> : null}
            {safePage === "crm.closures" ? (
              <ClosureWorkspace
                key={`${safePage}:${crmListRevision}`}
                onOpenEnquiry={(id) => openEnquiryRecord(String(id))}
              />
            ) : null}
            {safePage === "crm.call-logs" ? (
              <CallLogWorkspace key={`${safePage}:${crmListRevision}`} />
            ) : null}
            {safePage === "crm.enquiries" ? (
              <EnquiryWorkspace
                key={`${safePage}:${location.href}:${crmListRevision}`}
                currentUserEmail={signedInUser.email}
                reportFilters={reportFiltersFromLocation()}
                mobileFilter={mobileFilterFromLocation(location.href)}
                initialRecordKey={enquiryRecordKeyFromLocation(location.href)}
                onOpenRecord={openEnquiryRecord}
                onClearMobileFilter={() => requestListNavigation("crm.enquiries")}
                onBackToReports={() => requestListNavigation("crm.reports")}
              />
            ) : null}
            {safePage === "crm.enquiries.new" ? (
              <EnquiryWorkspace
                key={`${safePage}:${crmListRevision}`}
                currentUserEmail={signedInUser.email}
                initialCreate
                onOpenRecord={openEnquiryRecord}
                onSeeMoreEnquiries={openMobileEnquiries}
                onOpenEnquiry={openMobileEnquiry}
                onCloseCreate={() => completeListNavigation("crm.enquiries", true)}
                onCancelCreate={() => requestListNavigation("crm.enquiries")}
              />
            ) : null}
            {safePage === "crm.my-job" ? (
              <EnquiryWorkspace
                key={safePage}
                scope="assigned"
                currentUserEmail={signedInUser.email}
                onOpenRecord={openEnquiryRecord}
              />
            ) : null}
            {safePage === "crm.my-calls" ? (
              <EnquiryWorkspace
                key={safePage}
                scope="created"
                currentUserEmail={signedInUser.email}
                onOpenRecord={openEnquiryRecord}
              />
            ) : null}
            {safePage === "crm.list-in" ? (
              <ListInWorkspace key={`${safePage}:${crmListRevision}`} />
            ) : null}
            {safePage === "crm.status" ? <StatusWorkspace key={safePage} /> : null}
            {safePage === "crm.priority" ? <PriorityWorkspace key={safePage} /> : null}
            {safePage === "codeit.overview" ? (
              <CodeitOverview
                standaloneUrl={codeitStandaloneUrl()}
                onOpenSettings={() => requestListNavigation("codeit.settings")}
              />
            ) : null}
            {safePage === "codeit.settings" ? (
              <CodeitSettings standaloneUrl={codeitStandaloneUrl()} />
            ) : null}
            {safePage === "application.overview" ? (
              <ApplicationOverview
                companyName={selectedCompany ? companyBrandName(selectedCompany) : "â€”"}
                financialYear={selectedFinancialYear?.name ?? "â€”"}
                tenantName={runtime?.tenant?.tenantName ?? "â€”"}
                signedInEmail={signedInUser.email}
                enabledApps={switchableApps}
                landingApp={landingApp}
                onNavigate={requestListNavigation}
                onOpenApp={(appId) => requestListNavigation(pageForApp(appId))}
              />
            ) : null}
            {safePage === "application.landing" ? (
              <LandingDesk
                enabledApps={enabledApps}
                landingApp={landingApp}
                onPublish={publishLandingApp}
                saving={defaultSelectionMutation.isPending}
              />
            ) : null}
            {safePage === "application.profile" ? <ApplicationProfile /> : null}
            {safePage === "application.settings" ? (
              <ApplicationSettings
                companyName={selectedCompany ? companyBrandName(selectedCompany) : "â€”"}
                financialYear={selectedFinancialYear?.name ?? "â€”"}
                onNavigate={requestListNavigation}
                signedInEmail={signedInUser.email}
                tenantName={runtime?.tenant?.tenantName ?? "â€”"}
                zetroEnabled={switchableApps.includes("zetro")}
              />
            ) : null}
            {safePage === "application.access.users" ? <TenantUserWorkspace /> : null}
            {safePage === "application.access.roles" ? <TenantRoleWorkspace /> : null}
            {safePage === "application.access.permissions" ? <TenantPermissionWorkspace /> : null}
            {safePage === "application.access.user-roles" ? <TenantUserRoleWorkspace /> : null}
            {safePage === "application.access.role-permissions" ? (
              <TenantRolePermissionWorkspace />
            ) : null}
            {safePage === "application.access.controls" ? <TenantAccessControlWorkspace /> : null}
            {safePage === "billing.overview" ? (
              <BillingOverview onNavigate={selectPage} onNavigateToRecord={selectBillingRecord} />
            ) : null}
            {safePage === "billing.quotation" ? <QuotationWorkspace /> : null}
            {safePage === "billing.quotation.print" ? <QuotationPrintRoutePage /> : null}
            {safePage === "billing.sales" ? (
              <BillingSales initialRecordId={recordIdFromUrl()} />
            ) : null}
            {safePage === "billing.sales.print" ? <SalesPrintRoutePage /> : null}
            {safePage === "billing.purchase" ? (
              <PurchaseWorkspace initialRecordId={recordIdFromUrl()} />
            ) : null}
            {safePage === "billing.purchase.print" ? <PurchasePrintRoutePage /> : null}
            {safePage === "billing.export-sales" ? (
              <ExportSalesWorkspace initialRecordId={recordIdFromUrl()} />
            ) : null}
            {safePage === "billing.export-sales.print" ? <ExportSalesPrintRoutePage /> : null}
            {safePage === "billing.payment" ? (
              <PaymentWorkspace initialRecordId={recordIdFromUrl()} />
            ) : null}
            {safePage === "billing.receipt" ? (
              <ReceiptWorkspace initialRecordId={recordIdFromUrl()} />
            ) : null}
            {safePage === "billing.reports.customer-statement" ? (
              <CustomerStatementWorkspace />
            ) : null}
            {safePage === "billing.reports.customer-summary" ? <CustomerSummaryWorkspace /> : null}
            {safePage === "billing.reports.supplier-statement" ? (
              <SupplierStatementWorkspace />
            ) : null}
            {safePage === "billing.reports.supplier-summary" ? <SupplierSummaryWorkspace /> : null}
            {safePage === "billing.reports.stock-statement" ? <StockStatementWorkspace /> : null}
            {safePage === "billing.reports.gst-statement" ? <GstStatementWorkspace /> : null}
            {safePage === "billing.settings" ? <BillingSettingsWorkspace /> : null}
            {safePage === "billing.document-settings" ? <DocumentSettingsWorkspace /> : null}
            {safePage === "accounts.overview" ? <AccountsOverviewWorkspace /> : null}
            {safePage === "accounts.ledger-groups" ? <LedgerGroupsWorkspace /> : null}
            {safePage === "accounts.ledgers" ? <LedgersWorkspace /> : null}
            {safePage === "accounts.journal" ? (
              <AccountingWorkspace initialRecordId={recordIdFromUrl()} />
            ) : null}
            {safePage === "accounts.ledger" ? (
              <AccountingLedgerWorkspace initialRecordId={recordIdFromUrl()} />
            ) : null}
            {safePage === "accounts.periods" ? (
              <AccountingPeriodsWorkspace initialRecordId={recordIdFromUrl()} />
            ) : null}
            {safePage === "accounts.cash-book" ? <CashBookWorkspace /> : null}
            {safePage === "accounts.bank-book" ? <BankBookWorkspace /> : null}
            {safePage.startsWith("mail.") ? (
              <MailWorkspace mailbox={mailboxForPage(safePage)} />
            ) : null}
            {safePage === "notes.overview" ? <NotesWorkspace /> : null}
            {safePage === "chat.telegram" ? (
              <ChatTelegramWorkspace
                currentUserEmail={signedInUser.email}
                onOpenSettings={() => requestListNavigation("chat.telegram.settings")}
              />
            ) : null}
            {safePage === "chat.telegram.settings" ? (
              <ChatTelegramSettingsWorkspace
                onCreateConversation={() => requestListNavigation("chat.groups")}
              />
            ) : null}
            {safePage.startsWith("chat.") && !telegramWorkspace ? (
              <ChatWorkspace
                currentUserEmail={signedInUser.email}
                filterKind={chatFilterForPage(safePage)}
              />
            ) : null}
            {safePage === "task-manager.overview" || safePage === "task-manager.todos" ? (
              <TaskManagerWorkspace desk="tenant" />
            ) : null}
            {safePage === "core.organisation.company" ? <CompanyWorkspace /> : null}
            {safePage === "core.organisation.financial-year" ? <FinancialYearWorkspace /> : null}
            {safePage === "core.organisation.default-company" ? (
              <DefaultCompanyWorkspace
                landingApps={landingAppOptions(switchableApps)}
                onSaved={() => {
                  void defaultCompanyQuery.refetch();
                  void financialYearsQuery.refetch();
                }}
              />
            ) : null}
            {renderOwnedLocationPage(safePage)}
            {renderOwnedCommonMasterPage(safePage)}
            {safePage === "core.master.contact" ? <ContactWorkspace key={safePage} /> : null}
            {safePage === "core.master.product" ? <ProductWorkspace key={safePage} /> : null}
            {safePage === "core.master.work-order" ? <WorkOrderWorkspace key={safePage} /> : null}
          </Suspense>
        </main>
        <AlertDialog
          open={pendingListPage !== null}
          onOpenChange={(open) => {
            if (!open) setPendingListPage(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Keep or discard changes?</AlertDialogTitle>
              <AlertDialogDescription>
                Your changes have not been saved. Keep editing, or discard them and open the list.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep editing</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={() => {
                  if (pendingListPage)
                    completeListNavigation(pendingListPage.page, false, pendingListPage.search);
                }}
              >
                Discard changes
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TenantMainLayout>
    </WorkspaceNavigationProvider>
  );
}

function TenantBootstrapErrorScreen({ error }: { error: unknown }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md rounded-md border border-border bg-card p-6 shadow-sm">
        <div className="text-base font-semibold">Application setup could not be loaded</div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {error instanceof Error ? error.message : "An unexpected setup error occurred."}
        </p>
        <Button className="mt-5" onClick={() => window.location.reload()}>
          Retry workspace setup
        </Button>
      </div>
    </main>
  );
}

function landingAppOptions(apps: PlatformAppId[]): LandingAppOption[] {
  return apps.map((app) => ({
    label:
      platformAppRegistry.find((definition) => definition.id === app)?.label ??
      (app === "application"
        ? "Application"
        : app.replaceAll("-", " ").replace(/^./, (c) => c.toUpperCase())),
    value: app
  }));
}

function uniqueApps(apps: PlatformAppId[]) {
  return Array.from(new Set(["application" as PlatformAppId, ...apps]));
}

function isCrmListPage(page: AppPage) {
  return (
    page === "crm.contacts" ||
    page === "crm.enquiries" ||
    page === "crm.tasks" ||
    page === "crm.activities" ||
    page === "crm.closures" ||
    page === "crm.call-logs" ||
    page === "crm.sops" ||
    page === "crm.schedules" ||
    page === "crm.reminders" ||
    page === "crm.duties" ||
    page === "crm.duty-reporting" ||
    page === "crm.list-in"
  );
}

function pageFromUrl(landingApp: PlatformAppId | null, pathname: string): AppPage {
  const marketingPage = marketingPageFromPath(pathname);
  if (marketingPage) return marketingPage;
  const [, , app, ...children] = pathname.split("/");
  if (!app) return pageForApp(landingApp ?? "application");
  if (
    app === "application" &&
    children[0] === "access" &&
    ["users", "roles", "permissions", "user-roles", "role-permissions"].includes(
      children[1] ?? ""
    ) &&
    (children.length === 2 ||
      (children.length === 3 && children[2] === "new") ||
      (children.length === 4 && /^\d+$/.test(children[2] ?? "") && children[3] === "edit"))
  ) {
    return `application.access.${children[1]}` as AppPage;
  }
  if (
    app === "hrms" &&
    children[0] === "employees" &&
    (children.length === 1 ||
      (children.length === 2 && children[1] === "new") ||
      (children.length === 3 && Boolean(children[1]) && children[2] === "edit"))
  )
    return "hrms.employees";
  if (app === "hrms" && children[0] === "attendance" && children.length === 1)
    return "hrms.attendance";

  if (
    app === "crm" &&
    children[0] === "enquiries" &&
    children.length === 2 &&
    children[1] &&
    children[1] !== "new"
  )
    return "crm.enquiries";

  if (
    app === "crm" &&
    children[0] === "tasks" &&
    (children.length === 1 || (children.length === 2 && Boolean(children[1])))
  )
    return "crm.tasks";

  if (
    app === "crm" &&
    (children[0] === "schedules" || children[0] === "reminders") &&
    children.length === 1
  )
    return children[0] === "schedules" ? "crm.schedules" : "crm.reminders";

  if (
    app === "crm" &&
    children[0] === "contacts" &&
    (children.length === 1 ||
      (children.length === 2 && children[1] === "new") ||
      (children.length === 3 && (children[2] === "edit" || children[2] === "show")))
  ) {
    return "crm.contacts";
  }

  if (
    app === "logicx-erp" &&
    children[0] === "schemes" &&
    (children.length === 1 ||
      (children.length === 2 && Boolean(children[1])) ||
      (children.length === 3 && children[2] === "edit"))
  ) {
    return "logicx-erp.schemes";
  }

  if (
    app === "billing" &&
    ["quotation", "sales", "purchase", "export-sales", "payment", "receipt"].includes(
      children[0] ?? ""
    )
  ) {
    if (
      children.length === 3 &&
      children[2] === "print" &&
      !["payment", "receipt"].includes(children[0]!)
    )
      return `billing.${children[0]}.print` as AppPage;
    if (
      children.length === 1 ||
      (children.length === 2 && Boolean(children[1])) ||
      (children.length === 3 &&
        (children[2] === "edit" || children[2] === "show" || children[2] === "print"))
    ) {
      return `billing.${children[0]}` as AppPage;
    }
  }

  if (app === "core") {
    const suffix = children.at(-1);
    const baseChildren = suffix === "edit" ? children.slice(0, -2) : children.slice(0, -1);
    const base = `core.${baseChildren.join(".")}`;
    if (
      (isCommonMasterPage(base) || CORE_RECORD_PAGES.has(base)) &&
      (suffix === "new" ||
        suffix === "edit" ||
        (children.length === baseChildren.length + 1 && Boolean(suffix)))
    ) {
      return base as AppPage;
    }
  }

  if (app === "sportsclub") {
    const entity = children[0];
    if (
      entity &&
      [
        "members",
        "masters",
        "programs",
        "sessions",
        "attendance",
        "progress",
        "events",
        "enquiries"
      ].includes(entity)
    ) {
      return `sportsclub.${entity}` as AppPage;
    }
    return "sportsclub.overview";
  }

  if (app === "frappe" && children.length === 1 && children[0] === "enquiry-sync")
    return "frappe.live-sync-queue";

  const key = `${app}.${children.filter(Boolean).join(".") || "overview"}`;
  if (
    key === "hrms.overview" ||
    key === "hrms.employees" ||
    key === "hrms.attendance" ||
    key === "codexsun.frontdesk" ||
    key === "codexsun.workspace" ||
    key === "codexsun.approvals" ||
    key === "docs.overview" ||
    key === "docs.guide" ||
    key === "docs.library" ||
    key === "codeit.overview" ||
    key === "codeit.settings" ||
    key === "himsx.overview" ||
    key === "himsx.guide" ||
    key === "sites.overview" ||
    key === "sites.studio" ||
    key === "sites.sites" ||
    key === "sites.guide" ||
    key === "zetro.chat" ||
    key === "frappe.overview" ||
    key === "frappe.contacts" ||
    key === "frappe.enquiries" ||
    key === "frappe.activities" ||
    key === "frappe.call-logs" ||
    key === "frappe.export.contacts" ||
    key === "frappe.export.enquiries" ||
    key === "frappe.export.activities" ||
    key === "frappe.export.call-logs" ||
    key === "frappe.availability" ||
    key === "frappe.live-sync" ||
    key === "frappe.live-sync-queue" ||
    key === "frappe.connection" ||
    key === "frappe.users" ||
    key === "frappe.user-mapping" ||
    key === "frappe.identity-audit" ||
    key === "auditor.overview" ||
    key === "auditor.clients" ||
    key === "tconnect.overview" ||
    key.startsWith("sportsclub.") ||
    key === "ecommerce.overview" ||
    key === "qcafe.dashboard" ||
    key === "qcafe.overview" ||
    key === "qcafe.menu" ||
    key === "qcafe.settings" ||
    key === "qcafe.kot" ||
    key === "qcafe.take-away" ||
    key === "qcafe.kitchen" ||
    key === "qcafe.booking" ||
    ecommerceModulePages.includes(key as EcommerceModulePage) ||
    key === "ecommerce.categories" ||
    key === "ecommerce.products" ||
    key === "ecommerce.brands-strip" ||
    key === "logicx-erp.overview" ||
    key === "logicx-erp.schemes" ||
    key === "crm.overview" ||
    key === "crm.reports" ||
    key === "crm.enquiries" ||
    key === "crm.leads" ||
    key === "crm.tasks" ||
    key === "crm.activities" ||
    key === "crm.closures" ||
    key === "crm.call-logs" ||
    key === "crm.sops" ||
    key === "crm.schedules" ||
    key === "crm.reminders" ||
    key === "crm.duties" ||
    key === "crm.duty-reporting" ||
    key === "crm.enquiries.new" ||
    key === "crm.my-job" ||
    key === "crm.my-calls" ||
    key === "crm.contacts" ||
    key === "crm.contact-360" ||
    key === "crm.list-in" ||
    key === "crm.status" ||
    key === "crm.priority" ||
    key === "blog.overview" ||
    key === "blog.articles" ||
    key === "application.overview" ||
    key === "application.landing" ||
    key === "application.profile" ||
    key === "application.settings" ||
    key === "application.access.users" ||
    key === "application.access.roles" ||
    key === "application.access.permissions" ||
    key === "application.access.user-roles" ||
    key === "application.access.role-permissions" ||
    key === "application.access.controls" ||
    key === "billing.overview" ||
    key === "billing.quotation" ||
    key === "billing.quotation.print" ||
    key === "billing.desk" ||
    key === "billing.sales" ||
    key === "billing.sales.print" ||
    key === "billing.purchase" ||
    key === "billing.purchase.print" ||
    key === "billing.export-sales" ||
    key === "billing.export-sales.print" ||
    key === "billing.payment" ||
    key === "billing.receipt" ||
    key === "billing.reports.customer-statement" ||
    key === "billing.reports.customer-summary" ||
    key === "billing.reports.supplier-statement" ||
    key === "billing.reports.supplier-summary" ||
    key === "billing.reports.stock-statement" ||
    key === "billing.reports.gst-statement" ||
    key === "billing.settings" ||
    key === "billing.document-settings" ||
    key === "accounts.overview" ||
    key === "accounts.ledger-groups" ||
    key === "accounts.ledgers" ||
    key === "accounts.journal" ||
    key === "accounts.ledger" ||
    key === "accounts.periods" ||
    key === "accounts.cash-book" ||
    key === "accounts.bank-book" ||
    key === "mail.inbox" ||
    key === "mail.outbox" ||
    key === "mail.drafts" ||
    key === "mail.scheduled" ||
    key === "mail.sent" ||
    key === "mail.failed" ||
    key === "mail.trash" ||
    key === "notes.overview" ||
    key === "chat.overview" ||
    key === "chat.direct" ||
    key === "chat.groups" ||
    key === "chat.channels" ||
    key === "chat.broadcast" ||
    key === "chat.telegram" ||
    key === "chat.telegram.settings" ||
    key === "task-manager.overview" ||
    key === "task-manager.todos" ||
    key === "core.common.location.countries" ||
    key === "core.common.location.states" ||
    key === "core.common.location.districts" ||
    key === "core.common.location.cities" ||
    key === "core.common.location.pincodes" ||
    key === "core.organisation.company" ||
    key === "core.organisation.financial-year" ||
    key === "core.organisation.default-company" ||
    key === "core.master.contact" ||
    key === "core.master.product" ||
    key === "core.master.work-order" ||
    isCommonMasterPage(key)
  ) {
    return (key === "billing.desk" ? "billing.overview" : key) as AppPage;
  }
  if (key === "mail.overview") return "mail.inbox";
  return pageForApp(landingApp ?? "application");
}

function tenantPathMatchesPage(pathname: string, page: AppPage): boolean {
  if (page.startsWith("sportsclub.")) {
    if (
      page === "sportsclub.overview" &&
      (pathname === "/app/sportsclub" || pathname === "/app/sportsclub/overview")
    ) {
      return true;
    }
    const entity = page.slice("sportsclub.".length);
    const regex = new RegExp(`^/app/sportsclub/${entity}(?:/new|/[^/]+(?:/edit)?)?$`);
    return regex.test(pathname);
  }
  if (page === "hrms.employees")
    return /^\/app\/hrms\/employees(?:\/new|\/[^/]+\/edit)?$/.test(pathname);
  if (page === "ecommerce.overview" && pathname === "/app/ecommerce") return true;
  if (page === "qcafe.overview" && pathname === "/app/qcafe") return true;
  const canonicalPath = `/app/${page.replaceAll(".", "/")}`;
  if (pathname === canonicalPath) return true;
  if (page === "crm.enquiries") return Boolean(enquiryKeyFromPath(pathname));
  if (page === "crm.tasks") return /^\/app\/crm\/tasks(?:\/[^/]+)?$/.test(pathname);
  if (
    [
      "billing.quotation",
      "billing.sales",
      "billing.purchase",
      "billing.export-sales",
      "billing.payment",
      "billing.receipt"
    ].includes(page)
  ) {
    const prefix = `/app/${page.replaceAll(".", "/")}/`;
    const tail = pathname.slice(prefix.length);
    if (!pathname.startsWith(prefix) || !tail) return false;
    const segments = tail.split("/");
    return (
      (segments.length === 1 && Boolean(segments[0])) ||
      (segments.length === 2 &&
        Boolean(segments[0]) &&
        (segments[1] === "edit" || segments[1] === "show" || segments[1] === "print"))
    );
  }
  if (
    page.startsWith("application.access.") ||
    page === "crm.contacts" ||
    page === "logicx-erp.schemes" ||
    (page.startsWith("core.") && (isCommonMasterPage(page) || CORE_RECORD_PAGES.has(page)))
  ) {
    const prefix = `${canonicalPath}/`;
    if (!pathname.startsWith(prefix)) return false;
    const segments = pathname.slice(prefix.length).split("/");
    return (
      (segments.length === 1 && Boolean(segments[0])) ||
      (segments.length === 2 &&
        Boolean(segments[0]) &&
        (segments[1] === "edit" || (page === "crm.contacts" && segments[1] === "show")))
    );
  }
  if (
    [
      "billing.quotation.print",
      "billing.sales.print",
      "billing.purchase.print",
      "billing.export-sales.print",
      "billing.payment.print",
      "billing.receipt.print"
    ].includes(page)
  ) {
    const segments = pathname.slice(`/app/billing/${page.split(".")[1]}/`.length).split("/");
    return segments.length === 2 && Boolean(segments[0]) && segments[1] === "print";
  }
  return false;
}

function LandingDesk({
  enabledApps,
  landingApp,
  onPublish,
  saving
}: {
  enabledApps: PlatformAppId[];
  landingApp: PlatformAppId;
  onPublish: (app: PlatformAppId) => void;
  saving: boolean;
}) {
  const [draftLandingApp, setDraftLandingApp] = useState<PlatformAppId>(landingApp);
  const dirty = draftLandingApp !== landingApp;

  useEffect(() => {
    setDraftLandingApp(landingApp);
  }, [landingApp]);

  const choices = landingAppChoices(enabledApps);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Landing Desk</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose which enabled app opens first for this workspace.
          </p>
        </div>
        <Button
          disabled={!dirty || saving}
          icon={<RocketIcon />}
          onClick={() => onPublish(draftLandingApp)}
        >
          {saving ? "Publishing..." : "Publish live"}
        </Button>
      </div>

      <div className="rounded-md border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-normal">Default landing app</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Only enabled apps are available as landing choices.
            </p>
          </div>
          <StatusBadge tone={dirty ? "amber" : "green"}>
            {dirty ? "Draft not live" : "Live"}
          </StatusBadge>
        </div>

        <RadioGroup
          value={draftLandingApp}
          onValueChange={(value) => setDraftLandingApp(value as PlatformAppId)}
          className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3"
        >
          {choices.map((choice) => {
            const Icon = choice.id === "zetro" ? ZetroLogo : choice.icon;
            const selected = draftLandingApp === choice.id;

            return (
              <Label
                key={choice.id}
                className={`flex min-h-[98px] cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors ${
                  selected ? "border-border bg-muted/70" : "bg-background hover:bg-muted/35"
                }`}
              >
                <RadioGroupItem value={choice.id} className="mt-1" />
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-md ${choice.iconClass}`}
                >
                  {choice.iconSrc ? (
                    <img alt="" className="size-8 object-contain" src={choice.iconSrc} />
                  ) : (
                    <Icon className="size-5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{choice.label}</span>
                  </span>
                  <span className="mt-2 block text-sm font-normal leading-5 text-muted-foreground">
                    {choice.description}
                  </span>
                </span>
              </Label>
            );
          })}
        </RadioGroup>
      </div>
    </section>
  );
}

function ApplicationProfile() {
  return (
    <Card
      title="Application Profile"
      description="Platform identity, workspace access, and tenant context."
    >
      <div className="flex flex-wrap gap-2">
        <StatusBadge tone="green">Always enabled</StatusBadge>
      </div>
    </Card>
  );
}

function BillingSales({ initialRecordId }: { initialRecordId?: string | undefined }) {
  return <SalesWorkspace initialRecordId={initialRecordId} />;
}

function BillingOverview({
  onNavigate,
  onNavigateToRecord
}: {
  onNavigate: (page: AppPage) => void;
  onNavigateToRecord: (page: AppPage, recordId: string) => void;
}) {
  const pages = {
    payment: "billing.payment",
    purchase: "billing.purchase",
    receipt: "billing.receipt",
    sales: "billing.sales"
  } as const;
  return (
    <BillingDashboardWorkspace
      onNavigate={(target) => onNavigate(pages[target])}
      onNavigateToRecord={(target) => {
        const page =
          target.kind === "export-sales"
            ? "billing.export-sales"
            : pages[target.kind as keyof typeof pages];
        if (page) onNavigateToRecord(page, target.documentId);
      }}
    />
  );
}

function reportFiltersFromLocation(): EnquiryReportFilters | undefined {
  const search = new URLSearchParams(window.location.search);
  if (search.get("report") !== "1") return undefined;
  const filters: EnquiryReportFilters = {};
  for (const key of [
    "fromDate",
    "toDate",
    "listInId",
    "createdBy",
    "assignedUserId",
    "filter"
  ] as const) {
    const value = search.get(key);
    if (value) filters[key] = value;
  }
  return filters;
}

function mobileFilterFromLocation(href: string) {
  const search = new URL(href, window.location.origin).searchParams;
  const mobile = search.get("mobile");
  if (!mobile || !/^\d{7,15}$/.test(mobile)) return undefined;
  const contactIdValue = search.get("contactId");
  const parsedContactId =
    contactIdValue && /^[1-9]\d*$/.test(contactIdValue) ? Number(contactIdValue) : null;
  const contactId =
    parsedContactId && Number.isSafeInteger(parsedContactId) ? parsedContactId : null;
  return { mobile, contactId };
}

function enquiryRecordKeyFromLocation(href: string) {
  const url = new URL(href, window.location.origin);
  return enquiryKeyFromPath(url.pathname) ?? url.searchParams.get("record") ?? undefined;
}

function taskRecordKeyFromLocation(href: string) {
  const record = new URL(href, window.location.origin).searchParams.get("record");
  if (record) return record;
  const match = /^\/app\/crm\/tasks\/([^/]+)$/.exec(new URL(href, window.location.origin).pathname);
  if (!match || match[1] === "new") return undefined;
  try {
    return decodeURIComponent(match[1]!);
  } catch {
    return undefined;
  }
}

function enquiryKeyFromPath(pathname: string) {
  const match = /^\/app\/crm\/enquiries\/([^/]+)$/.exec(pathname);
  if (!match || match[1] === "new") return undefined;
  try {
    return decodeURIComponent(match[1]!);
  } catch {
    return undefined;
  }
}

function recordIdFromUrl() {
  return new URLSearchParams(window.location.search).get("record") || undefined;
}

function isBillingFeaturePageDisabled(
  page: AppPage,
  features: BillingNavigationFeatures | undefined
) {
  if (!features) return false;
  if (page.startsWith("billing.quotation")) return !features.quotation;
  if (page.startsWith("billing.export-sales")) return !features.exportSales;
  return false;
}

function resolveBillingFeaturePage(
  page: AppPage,
  features: BillingNavigationFeatures | undefined
): AppPage {
  return isBillingFeaturePageDisabled(page, features) ? "billing.overview" : page;
}

function signedInTenantUser() {
  const identity = getSessionIdentity();
  const email = identity?.email || "user@codexsun.app";
  const name = identity?.name || email.split("@")[0] || "User";
  return {
    email,
    fallback: userInitials(name),
    name
  };
}

function userInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "U";
}

function renderOwnedLocationPage(page: AppPage) {
  if (page === "core.common.location.countries") return <CountryWorkspace />;
  if (page === "core.common.location.states") return <StateWorkspace />;
  if (page === "core.common.location.districts") return <DistrictWorkspace />;
  if (page === "core.common.location.cities") return <CityWorkspace />;
  if (page === "core.common.location.pincodes") return <PincodeWorkspace />;
  return null;
}

function renderOwnedCommonMasterPage(page: AppPage) {
  if (page === "core.common.accounts.ledger-groups") return <LedgerGroupsWorkspace />;
  if (page === "core.common.accounts.ledgers") return <LedgersWorkspace />;
  if (page === "core.common.contacts.contact-groups") return <ContactGroupsWorkspace />;
  if (page === "core.common.contacts.contact-types") return <ContactTypesWorkspace />;
  if (page === "core.common.contacts.address-types") return <AddressTypesWorkspace />;
  if (page === "core.common.contacts.bank-names") return <BankNamesWorkspace />;
  if (page === "core.common.products.product-groups") return <ProductGroupsWorkspace />;
  if (page === "core.common.products.product-categories") return <ProductCategoriesWorkspace />;
  if (page === "core.common.products.product-types") return <ProductTypesWorkspace />;
  if (page === "core.common.products.units") return <UnitsWorkspace />;
  if (page === "core.common.products.hsn-codes") return <HsnCodesWorkspace />;
  if (page === "core.common.products.taxes") return <TaxesWorkspace />;
  if (page === "core.common.products.brands") return <BrandsWorkspace />;
  if (page === "core.common.products.colours") return <ColoursWorkspace />;
  if (page === "core.common.products.sizes") return <SizesWorkspace />;
  if (page === "core.common.products.styles") return <StylesWorkspace />;
  if (page === "core.common.workorder.work-order-types") return <WorkOrderTypesWorkspace />;
  if (page === "core.common.workorder.transports") return <TransportsWorkspace />;
  if (page === "core.common.workorder.warehouses") return <WarehousesWorkspace />;
  if (page === "core.common.workorder.destinations") return <DestinationsWorkspace />;
  if (page === "core.common.workorder.stock-rejection-types")
    return <StockRejectionTypesWorkspace />;
  if (page === "core.common.others.currencies") return <CurrenciesWorkspace />;
  if (page === "core.common.others.priorities") return <PrioritiesWorkspace />;
  if (page === "core.common.others.payment-terms") return <PaymentTermsWorkspace />;
  if (page === "core.common.others.sales-types") return <SalesTypesWorkspace />;
  if (page === "core.common.others.months") return <MonthsWorkspace />;
  return null;
}

function titleForPage(page: AppPage) {
  const labels: Partial<Record<AppPage, string>> = {
    "marketing.consents": "Consent",
    "marketing.contents": "Content",
    "marketing.email-campaigns": "Email Campaigns",
    "marketing.conversations": "Conversations",
    "marketing.brands": "Brands",
    "marketing.campaigns": "Campaigns",
    "marketing.captures": "Capture forms",
    "marketing.submissions": "Submissions",
    "marketing.connections": "Connections",
    "marketing.leads": "Leads",
    "marketing.qualifications": "Qualifications",
    "marketing.conversions": "Sales conversions",
    "marketing.outcomes": "Outcomes",
    "marketing.followups": "Follow-ups",
    "hrms.overview": "HRMS",
    "hrms.employees": "Employees",
    "hrms.attendance": "Attendance",
    "codexsun.frontdesk": "Zuno Front Desk",
    "codexsun.workspace": "Desktop Workspace",
    "codexsun.approvals": "Mobile Approvals",
    "docs.overview": "Docs",
    "docs.guide": "Getting Started",
    "docs.library": "Developer documentation",
    "codeit.overview": "Codeit",
    "codeit.settings": "Codeit Settings",
    "himsx.overview": "Himsx",
    "himsx.guide": "Getting Started",
    "sites.overview": "Site Studio",
    "sites.studio": "Site Studio",
    "sites.sites": "Client Portfolios",
    "sites.guide": "Developer Guide",
    "qcafe.dashboard": "Overview",
    "qcafe.overview": "POS",
    "qcafe.menu": "Master",
    "qcafe.settings": "Settings",
    "qcafe.kot": "KOT",
    "qcafe.take-away": "Parcel - Take away",
    "qcafe.booking": "Booking",
    "qcafe.kitchen": "Kitchen",
    "frappe.overview": "Frappe",
    "frappe.contacts": "Import mobile customers",
    "frappe.enquiries": "Import enquiries",
    "frappe.activities": "Import activities",
    "frappe.call-logs": "Import call logs",
    "frappe.export.contacts": "Export contacts",
    "frappe.export.enquiries": "Export enquiries",
    "frappe.export.activities": "Export activities",
    "frappe.export.call-logs": "Export call logs",
    "frappe.availability": "Server availability",
    "frappe.live-sync": "Live sync",
    "frappe.live-sync-queue": "Live sync queue",
    "frappe.connection": "Frappe connection",
    "frappe.users": "Frappe users",
    "frappe.user-mapping": "User mapping",
    "frappe.identity-audit": "Identity audit",
    "auditor.overview": "Overview",
    "auditor.clients": "Clients",
    "tconnect.overview": "Business network",
    "sportsclub.overview": "Sports Club",
    "sportsclub.members": "Students",
    "sportsclub.masters": "Masters",
    "sportsclub.programs": "Curriculum",
    "sportsclub.sessions": "Batches",
    "sportsclub.attendance": "Attendance",
    "sportsclub.progress": "Assessments",
    "sportsclub.events": "Events",
    "sportsclub.enquiries": "Admissions",
    "ecommerce.overview": "Overview",
    "ecommerce.catalog": "Catalog",
    "ecommerce.storefront": "Storefront",
    "ecommerce.categories": "Categories",
    "ecommerce.products": "Products",
    "ecommerce.brands-strip": "Brands Strip",
    "ecommerce.campaign-events": "Campaign Events",
    "ecommerce.organisation": "Storefront Organisation",
    "ecommerce.product-information": "Items",
    "ecommerce.product-attributes": "Attributes",
    "ecommerce.product-specifications": "Specifications",
    "ecommerce.product-collections": "Collections",
    "ecommerce.product-variants": "Variants",
    "ecommerce.product-images": "Images",
    "ecommerce.catalog-data-source": "Data Sources",
    "ecommerce.storefront-sliders": "Sliders",
    "ecommerce.promotions": "Promotions",
    "ecommerce.featured-cards": "Featured Cards",
    "ecommerce.season-strips": "Season Strips",
    "ecommerce.service-banner": "Service Banner",
    "ecommerce.trusted-strip": "Trusted Strip",
    "logicx-erp.overview": "Overview",
    "logicx-erp.schemes": "Schemes",
    "crm.overview": "Overview",
    "crm.reports": "List in",
    "crm.enquiries": "All Enquiries",
    "crm.leads": "Leads",
    "crm.tasks": "Tasks",
    "crm.activities": "Activities",
    "crm.closures": "Closure Approvals",
    "crm.call-logs": "Call Logs",
    "crm.sops": "SOPs",
    "crm.schedules": "Schedules",
    "crm.reminders": "Reminders",
    "crm.duties": "Duties",
    "crm.duty-reporting": "Duty Reporting",
    "crm.enquiries.new": "New enquiry",
    "crm.my-job": "My Job",
    "crm.my-calls": "My Calls",
    "crm.contacts": "Contacts",
    "crm.contact-360": "Contact 360",
    "crm.list-in": "List In",
    "crm.status": "Status",
    "crm.priority": "Priority",
    "blog.overview": "Dashboard",
    "blog.articles": "Articles",
    "application.overview": "Overview",
    "application.landing": "Landing Desk",
    "application.profile": "Application Profile",
    "application.settings": "Application Settings",
    "application.access.users": "Users",
    "application.access.roles": "Roles",
    "application.access.permissions": "Permissions",
    "application.access.user-roles": "User Roles",
    "application.access.role-permissions": "Role Permissions",
    "application.access.controls": "Access Control",
    "billing.overview": "Overview",
    "billing.quotation": "Quotation",
    "billing.sales": "Sales",
    "billing.purchase": "Purchase",
    "billing.export-sales": "Export Sales",
    "billing.payment": "Payment",
    "billing.receipt": "Receipt",
    "billing.reports.customer-statement": "Customer Statement",
    "billing.reports.customer-summary": "Customer Summary",
    "billing.reports.supplier-statement": "Supplier Statement",
    "billing.reports.supplier-summary": "Supplier Summary",
    "billing.reports.stock-statement": "Stock Statement",
    "billing.reports.gst-statement": "GST Statement",
    "billing.settings": "Billing Settings",
    "billing.document-settings": "Document Settings",
    "accounts.overview": "Overview",
    "accounts.ledger-groups": "Ledger Groups",
    "accounts.ledgers": "Ledgers",
    "accounts.journal": "Journals",
    "accounts.ledger": "Ledger",
    "accounts.periods": "Accounting Periods",
    "accounts.cash-book": "Cash Book",
    "accounts.bank-book": "Bank Book",
    "mail.inbox": "Inbox",
    "mail.outbox": "Outbox",
    "mail.drafts": "Drafts",
    "mail.scheduled": "Scheduled",
    "mail.sent": "Sent",
    "mail.failed": "Failed",
    "mail.trash": "Trash",
    "notes.overview": "Notes",
    "chat.overview": "All Chats",
    "chat.direct": "Chat",
    "chat.telegram": "Telegram",
    "chat.telegram.settings": "Telegram Settings",
    "chat.groups": "Group",
    "chat.channels": "Channel",
    "chat.broadcast": "Broadcast",
    "task-manager.overview": "Task Manager",
    "task-manager.todos": "Todo",
    "core.common.location.cities": "Cities",
    "core.common.location.countries": "Countries",
    "core.common.location.districts": "Districts",
    "core.common.location.pincodes": "Pincodes",
    "core.common.location.states": "States",
    "core.common.contacts.address-types": "Address Types",
    "core.common.contacts.bank-names": "Bank Names",
    "core.common.contacts.contact-groups": "Contact Groups",
    "core.common.contacts.contact-types": "Contact Types",
    "core.common.accounts.ledger-groups": "Ledger Groups",
    "core.common.accounts.ledgers": "Ledgers",
    "core.common.others.currencies": "Currencies",
    "core.common.others.months": "Months",
    "core.common.others.payment-terms": "Payment Terms",
    "core.common.others.priorities": "Priorities",
    "core.common.others.sales-types": "Sales Types",
    "core.common.products.brands": "Brands",
    "core.common.products.colours": "Colours",
    "core.common.products.hsn-codes": "HSN Codes",
    "core.common.products.product-categories": "Product Categories",
    "core.common.products.product-groups": "Product Groups",
    "core.common.products.product-types": "Product Types",
    "core.common.products.sizes": "Sizes",
    "core.common.products.styles": "Styles",
    "core.common.products.taxes": "Taxes",
    "core.common.products.units": "Units",
    "core.common.workorder.destinations": "Destinations",
    "core.common.workorder.stock-rejection-types": "Stock Rejection Types",
    "core.common.workorder.transports": "Transports",
    "core.common.workorder.warehouses": "Warehouses",
    "core.common.workorder.work-order-types": "Work Order Types",
    "core.organisation.company": "Company",
    "core.organisation.financial-year": "Financial Years",
    "core.organisation.default-company": "Default Company",
    "core.master.contact": "Contact",
    "core.master.product": "Product",
    "core.master.work-order": "Work Order"
  };
  return labels[page] ?? "Application";
}

function isCommonMasterPage(page: string): page is AppPage {
  return COMMON_MASTER_PAGES.has(page);
}

const CORE_RECORD_PAGES = new Set<string>([
  "core.common.location.countries",
  "core.common.location.states",
  "core.common.location.districts",
  "core.common.location.cities",
  "core.common.location.pincodes",
  "core.master.contact",
  "core.master.product",
  "core.master.work-order",
  "core.organisation.company",
  "core.organisation.financial-year"
]);

const COMMON_MASTER_PAGES = new Set<string>([
  "core.common.accounts.ledger-groups",
  "core.common.accounts.ledgers",
  "core.common.contacts.address-types",
  "core.common.contacts.bank-names",
  "core.common.contacts.contact-groups",
  "core.common.contacts.contact-types",
  "core.common.others.currencies",
  "core.common.others.months",
  "core.common.others.payment-terms",
  "core.common.others.priorities",
  "core.common.others.sales-types",
  "core.common.products.brands",
  "core.common.products.colours",
  "core.common.products.hsn-codes",
  "core.common.products.product-categories",
  "core.common.products.product-groups",
  "core.common.products.product-types",
  "core.common.products.sizes",
  "core.common.products.styles",
  "core.common.products.taxes",
  "core.common.products.units",
  "core.common.workorder.destinations",
  "core.common.workorder.stock-rejection-types",
  "core.common.workorder.transports",
  "core.common.workorder.warehouses",
  "core.common.workorder.work-order-types"
]);

function appFromPage(
  page: AppPage,
  landingApp: PlatformAppId,
  enabledApps: PlatformAppId[]
): PlatformAppId {
  if (page.startsWith("codeit.")) return enabledApps.includes("codeit") ? "codeit" : landingApp;
  if (page.startsWith("hrms.")) return enabledApps.includes("hrms") ? "hrms" : landingApp;
  if (page.startsWith("codexsun."))
    return enabledApps.includes("codexsun") ? "codexsun" : landingApp;
  if (page.startsWith("docs.")) return enabledApps.includes("docs") ? "docs" : landingApp;
  if (page.startsWith("himsx.")) return enabledApps.includes("himsx") ? "himsx" : landingApp;
  if (page.startsWith("marketing."))
    return enabledApps.includes("marketing") ? "marketing" : landingApp;
  if (page.startsWith("sites.")) return enabledApps.includes("sites") ? "sites" : landingApp;
  if (page.startsWith("qcafe")) return enabledApps.includes("qcafe") ? "qcafe" : landingApp;
  if (page.startsWith("frappe")) return enabledApps.includes("frappe") ? "frappe" : landingApp;
  if (page.startsWith("crm")) return enabledApps.includes("crm") ? "crm" : landingApp;
  if (page.startsWith("auditor")) return enabledApps.includes("auditor") ? "auditor" : landingApp;
  if (page.startsWith("tconnect"))
    return enabledApps.includes("tconnect") ? "tconnect" : landingApp;
  if (page.startsWith("sportsclub"))
    return enabledApps.includes("sportsclub") ? "sportsclub" : landingApp;
  if (page.startsWith("ecommerce"))
    return enabledApps.includes("ecommerce") ? "ecommerce" : landingApp;
  if (page.startsWith("logicx-erp"))
    return enabledApps.includes("logicx-erp") ? "logicx-erp" : landingApp;
  if (page.startsWith("blog")) return enabledApps.includes("blog") ? "blog" : landingApp;
  if (page.startsWith("core.organisation")) return "application";
  if (page.startsWith("billing") || page.startsWith("core"))
    return enabledApps.includes("billing") ? "billing" : landingApp;
  if (page.startsWith("task-manager"))
    return enabledApps.includes("task-manager") ? "task-manager" : landingApp;
  if (page.startsWith("accounts"))
    return enabledApps.includes("accounts") ? "accounts" : landingApp;
  if (page.startsWith("devkit") || page.startsWith("project-manager")) return landingApp;
  if (page.startsWith("mail")) return enabledApps.includes("mail") ? "mail" : landingApp;
  if (page.startsWith("notes")) return enabledApps.includes("notes") ? "notes" : landingApp;
  if (page.startsWith("chat")) return enabledApps.includes("chat") ? "chat" : landingApp;
  return "application";
}

function mailboxForPage(page: AppPage) {
  const mailbox = page.startsWith("mail.") ? page.slice("mail.".length) : "inbox";
  return mailbox === "outbox" ||
    mailbox === "drafts" ||
    mailbox === "scheduled" ||
    mailbox === "sent" ||
    mailbox === "failed" ||
    mailbox === "trash"
    ? mailbox
    : "inbox";
}

function chatFilterForPage(page: AppPage): "channel" | "dm" | "group" | "broadcast" | undefined {
  if (page === "chat.direct" || page === "chat.overview") return "dm";
  if (page === "chat.groups") return "group";
  if (page === "chat.channels") return "channel";
  if (page === "chat.broadcast") return "broadcast";
  return "dm";
}

function pageForApp(app: PlatformAppId): AppPage {
  return appRootPage(app);
}

function isAppRootPath(pathname: string) {
  return pathname === "/app" || pathname === "/app/";
}

function codeitStandaloneUrl() {
  if (__CODEXSUN_CODEIT_WEB_URL__) return __CODEXSUN_CODEIT_WEB_URL__;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) return undefined;
  return `http://127.0.0.1:${__CODEXSUN_CODEIT_WEB_PORT__}/codeit/overview`;
}
