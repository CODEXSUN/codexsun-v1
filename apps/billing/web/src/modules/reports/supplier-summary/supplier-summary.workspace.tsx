import { useSupplierSummaryControls } from "./supplier-summary.controls";
import { Printer } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { cn } from "@codexsun/ui/lib/utils";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { useSupplierSummary } from "./supplier-summary.hooks";
import { SupplierSummaryList } from "./supplier-summary.list";
import { SupplierSummaryPrint } from "./supplier-summary.print";
import { formatSupplierSummaryMoney } from "./supplier-summary.services";

export function SupplierSummaryWorkspace() {
  const query = useSupplierSummary();
  const summary = query.data;
  const { tools, entries, toolbar, search } = useSupplierSummaryControls(summary?.items ?? []);
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
      description="One payable outstanding balance per supplier for the active financial year. Credit includes opening balance."
      technicalName="page.billing.reports.supplier-summary"
      title="Supplier Summary"
    >
      <main className="space-y-4">
        {query.isError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {query.error instanceof Error
              ? query.error.message
              : "Supplier Summary could not be loaded."}
          </div>
        ) : null}
        {toolbar}
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTotal label="Debit" value={summary?.totalDebit ?? 0} />
          <SummaryTotal label="Credit" value={summary?.totalCredit ?? 0} />
          <SummaryTotal label="Outstanding balance" strong value={summary?.totalBalance ?? 0} />
        </div>
        <SupplierSummaryList tools={tools} entries={entries} loading={query.isLoading} />
        <section className="billing-print-area hidden print:block">
          <div>
            {summary && !query.isError ? (
              <SupplierSummaryPrint summary={summary} entries={entries} search={search} />
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
        {formatSupplierSummaryMoney(value)}
      </div>
    </div>
  );
}
