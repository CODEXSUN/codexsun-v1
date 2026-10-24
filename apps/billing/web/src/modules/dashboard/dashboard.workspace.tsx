import {
  FileText,
  IndianRupee,
  ReceiptIndianRupee,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  UserRound
} from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { GlobalLoader } from "@codexsun/ui/components/global-loader";
import { getTenantUserIdentity } from "../../shared/api/tenant-context";
import { useBillingDashboard } from "./dashboard.hooks";
import type { DashboardRecent } from "./dashboard.types";
import {
  CashPositionWidget,
  DashboardKpiCard,
  DashboardWidget,
  MonthlyTotalsWidget,
  OutstandingContactsWidget,
  RecentTransactionsWidget,
  TransactionMovementWidget
} from "./dashboard.widgets";

export type BillingDashboardListTarget = "payment" | "purchase" | "receipt" | "sales";
export type BillingDashboardRecordTarget = Pick<DashboardRecent, "documentId" | "kind">;

export function BillingDashboardWorkspace({
  onNavigate,
  onNavigateToRecord
}: {
  onNavigate?: (target: BillingDashboardListTarget) => void;
  onNavigateToRecord?: (target: BillingDashboardRecordTarget) => void;
}) {
  const query = useBillingDashboard();
  const dashboard = query.data;
  const signedInUser = getTenantUserIdentity();
  const openList = (target: BillingDashboardListTarget) => {
    if (onNavigate) {
      onNavigate(target);
      return;
    }
    window.location.assign(`/billing/${target}`);
  };
  const openRecord = (target: BillingDashboardRecordTarget) => {
    if (onNavigateToRecord) {
      onNavigateToRecord(target);
      return;
    }
    const path = target.kind === "export-sales" ? "export-sales" : target.kind;
    window.location.assign(`/billing/${path}?record=${encodeURIComponent(target.documentId)}`);
  };

  if (query.isLoading) {
    return <GlobalLoader className="min-h-[32rem]" fullScreen={false} />;
  }

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-md border bg-card shadow-sm">
        <div className="relative min-h-36 p-5 md:p-6">
          <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-gradient-to-l from-emerald-100 via-teal-50 to-transparent md:block" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span className="grid size-14 place-items-center rounded-md bg-emerald-600 text-white">
                <ReceiptText className="size-7" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase text-muted-foreground">Billing</p>
                <h1 className="mt-1 text-3xl font-semibold">Billing Desk</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Fast company and financial-year projections for billing operations.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border bg-background/90 px-4 py-2 text-sm font-medium">
                <UserRound className="size-4" />
                Signed in as {signedInUser.name}
              </span>
              <Button
                aria-label="Refresh dashboard"
                onClick={() => void query.refetch()}
                size="icon"
                type="button"
                variant="outline"
              >
                <RefreshCw className={query.isFetching ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>
        </div>
      </div>
      {query.isError ? (
        <DashboardWidget title="Dashboard unavailable">
          <div className="py-8 text-sm text-rose-600">
            {query.error instanceof Error
              ? query.error.message
              : "Billing dashboard could not be loaded."}
          </div>
        </DashboardWidget>
      ) : null}
      {dashboard ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DashboardKpiCard
              accentClass="bg-emerald-600"
              icon={<ReceiptIndianRupee className="size-5" />}
              metric={dashboard.metrics.sales}
              onNavigate={() => openList("sales")}
              title="Total Sales"
            />
            <DashboardKpiCard
              accentClass="bg-sky-600"
              icon={<ShoppingBag className="size-5" />}
              metric={dashboard.metrics.purchase}
              onNavigate={() => openList("purchase")}
              title="Total Purchase"
            />
            <DashboardKpiCard
              accentClass="bg-amber-500"
              icon={<FileText className="size-5" />}
              metric={dashboard.metrics.receipt}
              onNavigate={() => openList("receipt")}
              title="Receipts"
            />
            <DashboardKpiCard
              accentClass="bg-rose-600"
              icon={<IndianRupee className="size-5" />}
              metric={dashboard.metrics.payment}
              onNavigate={() => openList("payment")}
              title="Payments"
            />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)]">
            <TransactionMovementWidget
              financialYearName={dashboard.financialYearName}
              months={dashboard.monthly}
            />
            <RecentTransactionsWidget entries={dashboard.recent} onNavigate={openRecord} />
          </div>
          <MonthlyTotalsWidget months={dashboard.monthly} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)]">
            <OutstandingContactsWidget entries={dashboard.outstanding} />
            <CashPositionWidget
              payment={dashboard.metrics.payment}
              receipt={dashboard.metrics.receipt}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}
