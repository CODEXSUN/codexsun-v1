import { useWorkspaceQueryValue } from "@codexsun/ui/workspace/navigation";
import { useStockStatementControls } from "./stock-statement.controls";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { cn } from "@codexsun/ui/lib/utils";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspacePagination } from "@codexsun/ui/workspace/pagination";
import { StockStatementForm } from "./stock-statement.form";
import { useStockStatement } from "./stock-statement.hooks";
import { StockStatementList } from "./stock-statement.list";
import { StockStatementPrint } from "./stock-statement.print";
import { formatStockQuantity, formatStockStatementMoney } from "./stock-statement.services";
import type { StockStatement } from "./stock-statement.types";

export function StockStatementWorkspace() {
  const [from, setFrom] = useWorkspaceQueryValue("from", "");
  const [to, setTo] = useWorkspaceQueryValue("to", "");
  const [page, setPage] = useWorkspaceQueryValue("page", 1);
  const [pageSize, setPageSize] = useWorkspaceQueryValue("pageSize", 50);
  const [printStatement, setPrintStatement] = useState<StockStatement>();
  const query = useStockStatement({ from, page, pageSize, search: "", to });
  const statement = query.data;

  useEffect(() => {
    if (!statement) return;
    if (!from) setFrom(statement.from);
    if (!to) setTo(statement.to);
  }, [from, statement, to]);

  const { tools, entries, toolbar, search, totals } = useStockStatementControls(
    statement?.items ?? []
  );
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));

  function handlePrint() {
    if (!statement) return;
    setPrintStatement({ ...statement, ...totals, items: entries, total: entries.length, search });
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()));
  }

  return (
    <WorkspacePage
      variant="list"
      className="billing-document-print-page"
      actions={
        <div className="flex gap-2 print:hidden">
          <Button disabled={!statement || query.isFetching} onClick={handlePrint} type="button">
            <Printer className="size-4" />
            Print
          </Button>
        </div>
      }
      description="Opening stock, purchase inward, sales outward, and calculated closing stock."
      technicalName="page.billing.reports.stock-statement"
      title="Stock Statement"
    >
      <main className="space-y-4">
        {toolbar}
        <StockStatementForm
          from={from || statement?.from || ""}
          onFromChange={(value) => {
            setFrom(value);
            setPage(1);
          }}
          onToChange={(value) => {
            setTo(value);
            setPage(1);
          }}
          to={to || statement?.to || ""}
        />
        {query.isError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {query.error instanceof Error
              ? query.error.message
              : "Stock Statement could not be loaded."}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <StockStatementTotal
            label="Opening qty"
            value={formatStockQuantity(totals.openingQuantity)}
          />
          <StockStatementTotal
            label="Inward qty"
            value={formatStockQuantity(totals.inwardQuantity)}
          />
          <StockStatementTotal
            label="Outward qty"
            value={formatStockQuantity(totals.outwardQuantity)}
          />
          <StockStatementTotal
            label="Closing qty"
            strong
            value={formatStockQuantity(totals.closingQuantity)}
          />
          <StockStatementTotal
            label="Purchase value"
            value={formatStockStatementMoney(totals.purchaseValue)}
          />
          <StockStatementTotal
            label="Sales value"
            value={formatStockStatementMoney(totals.salesValue)}
          />
        </div>
        <StockStatementList
          tools={tools}
          entries={entries.slice(
            (Math.min(page, totalPages) - 1) * pageSize,
            Math.min(page, totalPages) * pageSize
          )}
          loading={query.isLoading}
        />
        <WorkspacePagination
          onNextPage={() => setPage(Math.min(totalPages, Math.min(page, totalPages) + 1))}
          onPageChange={setPage}
          onPreviousPage={() => setPage(Math.max(1, Math.min(page, totalPages) - 1))}
          onRowsPerPageChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
          page={Math.min(page, totalPages)}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[10, 20, 50, 100, 200, 500]}
          showingLabel={`${Math.min(pageSize, Math.max(0, entries.length - (Math.min(page, totalPages) - 1) * pageSize))} products on this page`}
          singularLabel="products"
          totalCount={entries.length}
          totalPages={totalPages}
        />
        <section className="billing-print-area hidden print:block">
          <div>{printStatement ? <StockStatementPrint statement={printStatement} /> : null}</div>
        </section>
      </main>
    </WorkspacePage>
  );
}

function StockStatementTotal({
  label,
  strong,
  value
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-card px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 text-lg", strong ? "font-bold text-primary" : "font-semibold")}>
        {value}
      </div>
    </div>
  );
}
