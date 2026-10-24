import { useWorkspaceQueryValue } from "@codexsun/ui/workspace/navigation";
import { useSupplierStatementControls } from "./supplier-statement.controls";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspacePagination } from "@codexsun/ui/workspace/pagination";
import { cn } from "@codexsun/ui/lib/utils";
import { SupplierStatementForm } from "./supplier-statement.form";
import { useSupplierStatement } from "./supplier-statement.hooks";
import { SupplierStatementList } from "./supplier-statement.list";
import { SupplierStatementPrint } from "./supplier-statement.print";
import {
  formatSupplierStatementMoney,
  getSupplierStatementForPrint
} from "./supplier-statement.services";
import type { SupplierStatement } from "./supplier-statement.types";

export function SupplierStatementWorkspace() {
  const [contactValue, setContactValue] = useWorkspaceQueryValue("contactId", "");
  const contactId = contactValue === "none" ? null : Number(contactValue) || undefined;
  const setContactId = (value: number | null) =>
    setContactValue(value === null ? "none" : String(value));
  const [from, setFrom] = useWorkspaceQueryValue("from", "");
  const [to, setTo] = useWorkspaceQueryValue("to", "");
  const [page, setPage] = useWorkspaceQueryValue("page", 1);
  const [pageSize, setPageSize] = useWorkspaceQueryValue("pageSize", 50);
  const [printStatement, setPrintStatement] = useState<SupplierStatement>();
  const [printing, setPrinting] = useState(false);
  const query = useSupplierStatement({
    contactId: contactId ?? undefined,
    from,
    page,
    pageSize,
    to
  });
  const statement = query.data;
  const visibleStatement = contactId === null ? undefined : statement;

  useEffect(() => {
    if (!statement) return;
    if (!from) setFrom(statement.from);
    if (!to) setTo(statement.to);
    if (contactId === undefined && statement.selectedContact) {
      setContactId(statement.selectedContact.id);
    }
  }, [contactId, from, statement, to]);

  const { tools, entries, toolbar } = useSupplierStatementControls(visibleStatement?.items ?? []);
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));

  async function handlePrint() {
    if (!contactId) return;
    setPrinting(true);
    try {
      const complete = await getSupplierStatementForPrint({
        contactId,
        from: from || statement?.from || "",
        to: to || statement?.to || ""
      });
      setPrintStatement(complete);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Supplier Statement could not be printed."
      );
    } finally {
      setPrinting(false);
    }
  }

  return (
    <WorkspacePage
      variant="list"
      className="billing-document-print-page"
      actions={
        <div className="flex gap-2 print:hidden">
          <Button
            disabled={!contactId || printing}
            onClick={() => void handlePrint()}
            type="button"
          >
            <Printer className="size-4" />
            {printing ? "Preparing..." : "Print"}
          </Button>
        </div>
      }
      description="Supplier purchases, payments, opening balance, and running payable balance."
      technicalName="page.billing.reports.supplier-statement"
      title="Supplier Statement"
    >
      <main className="space-y-4">
        {toolbar}
        <SupplierStatementForm
          contactId={contactId === null ? undefined : (contactId ?? statement?.selectedContact?.id)}
          contacts={statement?.contacts ?? []}
          from={from || statement?.from || ""}
          onContactChange={(value) => {
            setContactId(value ?? null);
            setPage(1);
          }}
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
              : "Supplier Statement could not be loaded."}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SupplierStatementTotal
            label="Opening balance"
            value={visibleStatement?.openingBalance ?? 0}
          />
          <SupplierStatementTotal
            label="Payment debit"
            value={visibleStatement?.periodDebit ?? 0}
          />
          <SupplierStatementTotal
            label="Purchase credit"
            value={visibleStatement?.periodCredit ?? 0}
          />
          <SupplierStatementTotal
            label="Closing balance"
            strong
            value={visibleStatement?.closingBalance ?? 0}
          />
        </div>
        <SupplierStatementList
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
          showingLabel={`${Math.min(pageSize, Math.max(0, entries.length - (Math.min(page, totalPages) - 1) * pageSize))} rows on this page`}
          singularLabel="movements"
          totalCount={entries.length}
          totalPages={totalPages}
        />
        <section className="billing-print-area hidden print:block">
          <div>{printStatement ? <SupplierStatementPrint statement={printStatement} /> : null}</div>
        </section>
      </main>
    </WorkspacePage>
  );
}

function SupplierStatementTotal({
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
      <div className={cn("mt-1 text-lg", strong ? "font-bold text-primary" : "font-semibold")}>
        {formatSupplierStatementMoney(value)}
      </div>
    </div>
  );
}
