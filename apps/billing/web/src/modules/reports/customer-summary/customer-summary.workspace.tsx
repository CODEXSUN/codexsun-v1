import { useCustomerSummaryControls } from "./customer-summary.controls";
import { Printer } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { cn } from "@codexsun/ui/lib/utils";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { useCustomerSummary } from "./customer-summary.hooks";
import { CustomerSummaryList } from "./customer-summary.list";
import { CustomerSummaryPrint } from "./customer-summary.print";
import { formatCustomerSummaryMoney } from "./customer-summary.services";

export function CustomerSummaryWorkspace() {
  const query = useCustomerSummary();
  const summary = query.data;
  const { tools, entries, toolbar, search } = useCustomerSummaryControls(summary?.items ?? []);
  return (
    <WorkspacePage
      variant="list"
      className="billing-document-print-page"
      actions={
        <div className="flex gap-2 print:hidden">
          <Button
            disabled={!summary || query.isFetching || query.isError}
            onClick={() => window.print()}
            type="button"
          >
            <Printer className="size-4" />
            Print
          </Button>
        </div>
      }
      description="One receivable outstanding balance per customer for the active financial year. Debit includes opening balance."
      technicalName="page.billing.reports.customer-summary"
      title="Customer Summary"
    >
      <main className="space-y-4">
        {query.isError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {query.error instanceof Error
              ? query.error.message
              : "Customer Summary could not be loaded."}
          </div>
        ) : null}
        {toolbar}
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTotal label="Debit" value={summary?.totalDebit ?? 0} />
          <SummaryTotal label="Credit" value={summary?.totalCredit ?? 0} />
          <SummaryTotal label="Outstanding balance" strong value={summary?.totalBalance ?? 0} />
        </div>
        <CustomerSummaryList tools={tools} entries={entries} loading={query.isLoading} />
        <section className="billing-print-area hidden print:block">
          <div>
            {summary && !query.isError ? (
              <CustomerSummaryPrint summary={summary} entries={entries} search={search} />
            ) : null}
          </div>
        </section>
      </main>
    </WorkspacePage>
  );
}

function SummaryTotal({
  label,
  strong,
  value
}: {
  label: string;
  strong?: boolean;
  value: number;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-card px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 text-lg font-semibold", strong && "font-bold text-primary")}>
        {formatCustomerSummaryMoney(value)}
      </div>
    </div>
  );
}
