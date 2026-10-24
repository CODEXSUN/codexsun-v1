import { getReportCurrencyCode } from "../../shared/api/tenant-context";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@codexsun/ui/lib/utils";
import { formatDate } from "@codexsun/ui/workspace";
import type {
  DashboardKind,
  DashboardMetric,
  DashboardMonth,
  DashboardOutstanding,
  DashboardRecent
} from "./dashboard.types";

const dashboardScrollbarClass =
  "[scrollbar-color:hsl(var(--muted-foreground)/0.35)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-0.5 [&::-webkit-scrollbar]:w-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/35 [&::-webkit-scrollbar-track]:bg-transparent";

export function DashboardWidget({
  children,
  className,
  description,
  title
}: {
  children: ReactNode;
  className?: string;
  description?: string;
  title: string;
}) {
  return (
    <section className={cn("rounded-md border bg-card p-5 shadow-sm", className)}>
      <header>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function DashboardKpiCard({
  accentClass,
  icon,
  metric,
  onNavigate,
  title
}: {
  accentClass: string;
  icon: ReactNode;
  metric: DashboardMetric;
  onNavigate: () => void;
  title: string;
}) {
  return (
    <button
      aria-label={`Open ${title} list`}
      className="w-full cursor-pointer rounded-md border bg-card p-5 text-left text-foreground shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-1 hover:border-primary/30 hover:shadow-md focus-visible:-translate-y-1 focus-visible:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
      onClick={onNavigate}
      type="button"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{money(metric.total)}</div>
        </div>
        <span className={cn("grid size-11 place-items-center rounded-md text-white", accentClass)}>
          {icon}
        </span>
      </div>
      <div className="mt-7 space-y-3 text-sm">
        <ValueRow label="This financial year" value={money(metric.financialYear)} />
        <ValueRow label="This month" value={money(metric.month)} />
        <ValueRow label="Posted documents" value={String(metric.count)} />
      </div>
    </button>
  );
}

export function TransactionMovementWidget({
  financialYearName,
  months
}: {
  financialYearName: string;
  months: DashboardMonth[];
}) {
  const kinds: Array<{ color: string; key: DashboardKind; label: string }> = [
    { color: "#059669", key: "sales", label: "Sales" },
    { color: "#0284c7", key: "purchase", label: "Purchase" },
    { color: "#d97706", key: "receipt", label: "Receipts" },
    { color: "#e11d48", key: "payment", label: "Payments" }
  ];
  const maximum = Math.max(1, ...months.flatMap((month) => kinds.map((kind) => month[kind.key])));
  const chartWidth = Math.max(720, months.length * 72);
  return (
    <DashboardWidget
      className="h-full"
      title="Transaction Movement"
      description={`Monthly confirmed and posted movement for ${financialYearName}.`}
    >
      <div className="mt-5 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {kinds.map((kind) => (
          <span className="inline-flex items-center gap-2" key={kind.key}>
            <span className="size-2 rounded-full" style={{ backgroundColor: kind.color }} />
            {kind.label}
          </span>
        ))}
      </div>
      <div
        className={cn(
          "mt-5 overflow-x-auto rounded-md border bg-background p-3",
          dashboardScrollbarClass
        )}
      >
        <svg
          aria-label="Monthly transaction movement"
          className="h-64 min-w-[720px] w-full"
          role="img"
          viewBox={`0 0 ${chartWidth} 250`}
        >
          <line
            stroke="currentColor"
            className="text-border"
            x1="24"
            x2={chartWidth - 12}
            y1="210"
            y2="210"
          />
          {months.map((month, monthIndex) => {
            const groupX = 36 + monthIndex * 72;
            return (
              <g key={month.month}>
                {kinds.map((kind, kindIndex) => {
                  const value = month[kind.key];
                  const height = (value / maximum) * 170;
                  return (
                    <rect
                      fill={kind.color}
                      key={kind.key}
                      rx="2"
                      width="10"
                      x={groupX + kindIndex * 12}
                      y={210 - height}
                      height={height}
                    >
                      <title>{`${month.label} ${kind.label}: ${money(value)}`}</title>
                    </rect>
                  );
                })}
                <text fill="currentColor" fontSize="11" textAnchor="middle" x={groupX + 18} y="232">
                  {month.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </DashboardWidget>
  );
}

export function MonthlyTotalsWidget({ months }: { months: DashboardMonth[] }) {
  return (
    <DashboardWidget
      title="Monthly Transaction Totals"
      description="Financial-year totals by month for sales, purchases, receipts, and payments."
    >
      <MonthTotals months={months} />
    </DashboardWidget>
  );
}

export function RecentTransactionsWidget({
  entries,
  onNavigate
}: {
  entries: DashboardRecent[];
  onNavigate: (entry: DashboardRecent) => void;
}) {
  return (
    <DashboardWidget
      className="h-full"
      title="Recent Transactions"
      description="Latest document activity from the dashboard projection."
    >
      <div
        className={cn(
          "mt-5 max-h-[21.5rem] space-y-2 overflow-y-auto pr-1",
          dashboardScrollbarClass
        )}
      >
        {entries.length ? (
          entries.map((entry) => (
            <button
              aria-label={`Open ${entry.documentNumber}`}
              className="group block min-h-20 w-full cursor-pointer rounded-md border bg-background px-4 py-3 text-left text-foreground transition-colors hover:border-primary/30 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              key={`${entry.kind}:${entry.documentId}`}
              onClick={() => onNavigate(entry)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">
                    <span
                      className={cn("mr-2 inline-block size-2 rounded-full", kindDot(entry.kind))}
                    />
                    <span className="underline-offset-4 group-hover:underline group-focus-visible:underline">
                      {entry.documentNumber}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.contactName} · {date(entry.date)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{money(entry.amount)}</div>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {entry.kind.replace("-", " ")} · {entry.status}
                  </p>
                </div>
              </div>
            </button>
          ))
        ) : (
          <Empty text="No transactions projected yet." />
        )}
      </div>
    </DashboardWidget>
  );
}

export function OutstandingContactsWidget({ entries }: { entries: DashboardOutstanding[] }) {
  const receivable = entries.filter((entry) => entry.direction === "receivable");
  const payable = entries.filter((entry) => entry.direction === "payable");
  return (
    <DashboardWidget
      title="Outstanding Attention"
      description="Contacts with the highest receivable and payable balances."
    >
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <OutstandingColumn
          entries={receivable}
          title="Customer credit outstanding"
          direction="receivable"
        />
        <OutstandingColumn
          entries={payable}
          title="Supplier debit outstanding"
          direction="payable"
        />
      </div>
    </DashboardWidget>
  );
}

export function CashPositionWidget({
  payment,
  receipt
}: {
  payment: DashboardMetric;
  receipt: DashboardMetric;
}) {
  const net = receipt.financialYear - payment.financialYear;
  return (
    <DashboardWidget
      title="Cash Movement"
      description="Posted receipts less posted payments in the financial year."
    >
      <div className="mt-5 flex items-center justify-between rounded-md border bg-background p-4">
        <div>
          <p className="text-sm text-muted-foreground">Net cash movement</p>
          <p
            className={cn(
              "mt-2 text-2xl font-semibold tabular-nums",
              net < 0 ? "text-rose-600" : "text-emerald-700"
            )}
          >
            {money(net)}
          </p>
        </div>
        {net < 0 ? (
          <ArrowDownRight className="size-8 text-rose-600" />
        ) : (
          <ArrowUpRight className="size-8 text-emerald-600" />
        )}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ValueTile label="Receipts" value={money(receipt.financialYear)} />
        <ValueTile label="Payments" value={money(payment.financialYear)} />
      </div>
    </DashboardWidget>
  );
}

function MonthTotals({ months }: { months: DashboardMonth[] }) {
  const financialYearTotals = months.reduce(
    (totals, month) => ({
      payment: totals.payment + month.payment,
      purchase: totals.purchase + month.purchase,
      receipt: totals.receipt + month.receipt,
      sales: totals.sales + month.sales
    }),
    { payment: 0, purchase: 0, receipt: 0, sales: 0 }
  );

  return (
    <div className={cn("mt-5 max-h-64 overflow-auto rounded-md border", dashboardScrollbarClass)}>
      <table className="w-full min-w-[640px] text-sm">
        <thead className="sticky top-0 z-10 bg-muted/70">
          <tr>
            <th className="px-3 py-2 text-left">Month</th>
            {["Sales", "Purchase", "Receipts", "Payments"].map((value) => (
              <th className="px-3 py-2 text-right" key={value}>
                {value}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr className="border-t" key={month.month}>
              <td className="px-3 py-2 font-medium">{month.label}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(month.sales)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(month.purchase)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(month.receipt)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(month.payment)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 z-10 border-t-2 border-primary/20 bg-muted shadow-[0_-4px_8px_-6px_rgba(15,23,42,0.45)]">
          <tr>
            <th className="px-3 py-2.5 text-left font-semibold" scope="row">
              Year Total
            </th>
            <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
              {money(financialYearTotals.sales)}
            </td>
            <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
              {money(financialYearTotals.purchase)}
            </td>
            <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
              {money(financialYearTotals.receipt)}
            </td>
            <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
              {money(financialYearTotals.payment)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
function OutstandingColumn({
  direction,
  entries,
  title
}: {
  direction: DashboardOutstanding["direction"];
  entries: DashboardOutstanding[];
  title: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <div
        className={cn("mt-3 max-h-[27rem] space-y-2 overflow-y-auto pr-1", dashboardScrollbarClass)}
      >
        {entries.length ? (
          entries.map((entry) => (
            <div
              className="flex min-h-20 items-center justify-between gap-3 rounded-md border bg-background px-4 py-3"
              key={`${direction}:${entry.contactId}`}
            >
              <div>
                <p className="font-medium">{entry.contactName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Settled {money(entry.settledAmount)} of {money(entry.grossAmount)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{money(entry.outstandingAmount)}</p>
                {entry.overLimit ? (
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-rose-600">
                    <AlertTriangle className="size-3" />
                    Over limit
                  </span>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <Empty text={`No ${direction} balances.`} />
        )}
      </div>
    </div>
  );
}
function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
function ValueTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: getReportCurrencyCode(),
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);
}
function date(value: string) {
  return formatDate(value);
}
function kindDot(kind: DashboardRecent["kind"]) {
  return kind === "sales" || kind === "export-sales"
    ? "bg-emerald-600"
    : kind === "purchase"
      ? "bg-sky-600"
      : kind === "receipt"
        ? "bg-amber-500"
        : "bg-rose-600";
}
