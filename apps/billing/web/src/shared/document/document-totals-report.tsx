import type { ReactNode } from "react";
import { Button } from "@codexsun/ui/components/button";
import { WorkspaceDateRangePicker } from "@codexsun/ui/workspace/date-range-picker";
import { cn } from "@codexsun/ui/lib/utils";

export type BillingDocumentReportRecord = {
  amount: number;
  date: string;
  documentNumber: string;
  partyName: string;
  subtotal?: number;
  taxAmount?: number;
};

export type BillingDocumentTotalsViewMode = "bill" | "month" | "party";

const totalsViewOptions: Array<{ label: string; value: BillingDocumentTotalsViewMode }> = [
  { label: "Bill-wise", value: "bill" },
  { label: "Month-wise", value: "month" },
  { label: "Party-wise", value: "party" }
];

export function BillingDocumentListControls({
  columnSearchAction,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onTotalsViewChange,
  totalsView
}: {
  columnSearchAction?: ReactNode;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onTotalsViewChange: (value: BillingDocumentTotalsViewMode) => void;
  totalsView: BillingDocumentTotalsViewMode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <WorkspaceDateRangePicker
        fromDate={dateFrom}
        toDate={dateTo}
        onValueChange={({ fromDate, toDate }) => {
          onDateFromChange(fromDate);
          onDateToChange(toDate);
        }}
      />
      {columnSearchAction}
      <div
        aria-label="Totals view"
        className="flex h-8 items-center rounded-md border border-border/80 bg-white p-0.5"
        role="group"
      >
        {totalsViewOptions.map((option) => (
          <Button
            aria-pressed={totalsView === option.value}
            className={cn(
              "h-6 rounded px-2.5 text-xs font-medium shadow-none",
              totalsView === option.value
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            key={option.value}
            onClick={() => onTotalsViewChange(option.value)}
            type="button"
            variant="ghost"
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function BillingDocumentTotalsTable({
  primaryLabel = "Taxable",
  records,
  secondaryLabel = "GST",
  totalsView
}: {
  primaryLabel?: string;
  records: BillingDocumentReportRecord[];
  secondaryLabel?: string;
  totalsView: Exclude<BillingDocumentTotalsViewMode, "bill">;
}) {
  const rows = buildRows(records, totalsView);

  return (
    <>
      <thead className="bg-muted/50">
        <tr>
          {[
            totalsView === "party" ? "Party" : "Month",
            "Documents",
            primaryLabel,
            secondaryLabel,
            "Total"
          ].map((heading) => (
            <th
              className={cn(
                "border-b border-border/70 px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                [primaryLabel, secondaryLabel, "Total"].includes(heading)
                  ? "text-right"
                  : "text-left"
              )}
              key={heading}
            >
              {heading}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr className="border-b border-border/70 last:border-b-0 hover:bg-muted/20" key={row.key}>
            <td className="px-4 py-2.5 font-medium">{row.label}</td>
            <td className="px-4 py-2.5 text-muted-foreground">{row.count}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{money(row.subtotal)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{money(row.taxAmount)}</td>
            <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
              {money(row.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </>
  );
}

function buildRows(
  records: BillingDocumentReportRecord[],
  totalsView: Exclude<BillingDocumentTotalsViewMode, "bill">
) {
  const groups = new Map<
    string,
    { amount: number; count: number; label: string; subtotal: number; taxAmount: number }
  >();

  for (const record of records) {
    const key = totalsView === "party" ? partyKey(record.partyName) : reportPeriodKey(record.date);
    const current = groups.get(key) ?? {
      amount: 0,
      count: 0,
      label: totalsView === "party" ? key : reportPeriodLabel(key),
      subtotal: 0,
      taxAmount: 0
    };
    current.amount += record.amount;
    current.count += 1;
    current.subtotal += record.subtotal ?? 0;
    current.taxAmount += record.taxAmount ?? 0;
    groups.set(key, current);
  }

  return [...groups.entries()]
    .map(([key, row]) => ({ ...row, key }))
    .sort((left, right) =>
      totalsView === "party"
        ? left.label.localeCompare(right.label, undefined, { sensitivity: "base" })
        : right.key.localeCompare(left.key)
    );
}

function partyKey(partyName: string) {
  const normalized = partyName.trim();
  return normalized || "Unknown party";
}

function reportPeriodKey(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
}

function reportPeriodLabel(key: string) {
  if (key === "Unknown date") return key;
  const [year, month] = key.split("-").map(Number);
  const parsedYear = year ?? Number.NaN;
  const parsedMonth = month ?? Number.NaN;
  if (!Number.isInteger(parsedYear) || !Number.isInteger(parsedMonth)) return "Unknown date";
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(
    new Date(parsedYear, parsedMonth - 1, 1)
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { currency: "INR", style: "currency" }).format(value);
}
