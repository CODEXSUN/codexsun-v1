import type { WorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import { formatDate as formatWorkspaceDate } from "@codexsun/ui/workspace";
import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Printer } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Checkbox } from "@codexsun/ui/components/checkbox";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import {
  WorkspaceTableEmptyState,
  WorkspaceTableLoadingState,
  WorkspaceTablePanel
} from "@codexsun/ui/workspace/table";
import { formatGstQuantity, formatGstStatementMoney } from "./gst-statement.services";
import type { GstStatementDocument, GstStatementPanel } from "./gst-statement.types";

const gstStatementScrollbarClass =
  "[scrollbar-color:hsl(var(--muted-foreground)/0.35)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-0.5 [&::-webkit-scrollbar]:w-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/35 [&::-webkit-scrollbar-track]:bg-transparent";

export function GstStatementDocumentCard({
  loading,
  onPrint,
  panel,
  side,
  tools
}: {
  loading: boolean;
  onPrint?: (visiblePanel: GstStatementPanel) => void;
  panel: GstStatementPanel | undefined;
  side: "purchase" | "sales";
  tools: WorkspaceListTools;
}) {
  const sales = side === "sales";
  const documents = panel?.documents ?? [];
  const documentSignature = documents.map(documentKey).join("|");
  const [visibleDocumentKeys, setVisibleDocumentKeys] = useState<Set<string>>(
    () => new Set(documents.map(documentKey))
  );
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    setVisibleDocumentKeys(new Set(documents.map(documentKey)));
    setShowHidden(false);
  }, [documentSignature]);

  const visibleDocuments = documents.filter((entry) => visibleDocumentKeys.has(documentKey(entry)));
  const displayedDocuments = showHidden ? documents : visibleDocuments;
  const hiddenDocumentCount = documents.length - visibleDocuments.length;
  const visibleTotals = summarizeDocuments(visibleDocuments);
  const visiblePanel = panel
    ? {
        ...panel,
        ...visibleTotals,
        documentCount: visibleDocuments.length,
        documents: visibleDocuments
      }
    : undefined;
  const allDocumentsVisible = documents.length > 0 && hiddenDocumentCount === 0;
  const documentSelectionState = allDocumentsVisible
    ? true
    : visibleDocuments.length > 0
      ? "indeterminate"
      : false;

  function setDocumentVisible(entry: GstStatementDocument, visible: boolean) {
    const key = documentKey(entry);
    setVisibleDocumentKeys((current) => {
      const next = new Set(current);
      if (visible) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function setAllDocumentsVisible(visible: boolean) {
    setVisibleDocumentKeys(visible ? new Set(documents.map(documentKey)) : new Set());
  }

  return (
    <section className="flex h-full min-w-0 flex-col gap-4 rounded-md border border-border/80 bg-card p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md border border-border/70 bg-muted/40 p-2">
            {sales ? <ArrowUpRight className="size-5" /> : <ArrowDownLeft className="size-5" />}
          </div>
          <div>
            <h2 className="font-semibold">{sales ? "Sales / Outward" : "Purchase / Inward"}</h2>
            <p className="text-sm text-muted-foreground">
              {sales
                ? "Confirmed sales and export sales for this return period."
                : "Confirmed purchase records eligible for the selected period."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <WorkspaceStatusBadge
            label={`${visibleDocuments.length}/${documents.length} shown`}
            tone={sales ? "info" : "success"}
          />
          <Button
            disabled={!visiblePanel || !visibleDocuments.length}
            onClick={() => visiblePanel && onPrint?.(visiblePanel)}
            size="sm"
            type="button"
            variant="outline"
          >
            <Printer className="size-4" />
            Print {sales ? "sales" : "purchase"}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex min-h-6 flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Document report</h3>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground print:hidden">
            <Checkbox
              checked={showHidden}
              disabled={!hiddenDocumentCount}
              onCheckedChange={(checked) => setShowHidden(checked === true)}
            />
            Show hidden ({hiddenDocumentCount})
          </label>
        </div>
        <WorkspaceTablePanel className="flex flex-1 flex-col">
          <div className={`overflow-x-auto ${gstStatementScrollbarClass}`}>
            <table className="w-full min-w-[980px] border-collapse text-xs">
              <thead className="bg-muted/50">
                <tr>
                  {[
                    "Show",
                    "#",
                    "GST No",
                    "Contact name",
                    "Taxable amount",
                    "Tax %",
                    "IGST",
                    "CGST",
                    "SGST",
                    "Invoice total"
                  ].map((heading) => (
                    <th
                      hidden={tools.hidden.includes(heading)}
                      className={`border-b border-border/70 px-3 py-2.5 font-semibold uppercase tracking-wide text-muted-foreground ${["Taxable amount", "Tax %", "IGST", "CGST", "SGST", "Invoice total"].includes(heading) ? "text-right" : "text-left"}`}
                      key={heading}
                    >
                      {heading === "Show" ? (
                        <Checkbox
                          aria-label={`Show all ${sales ? "sales" : "purchase"} documents`}
                          checked={documentSelectionState}
                          onCheckedChange={(checked) => setAllDocumentsVisible(checked === true)}
                        />
                      ) : (
                        heading
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tools.showFilters && (
                  <tr className="border-b border-border/70 bg-white">
                    {[
                      "Show",
                      "#",
                      "GST No",
                      "Contact name",
                      "Taxable amount",
                      "Tax %",
                      "IGST",
                      "CGST",
                      "SGST",
                      "Invoice total"
                    ]
                      .filter((label) => !tools.hidden.includes(label))
                      .map((label) => (
                        <td className="px-4 py-2.5 text-foreground" key={label}>
                          {tools.filterRow(label)}
                        </td>
                      ))}
                  </tr>
                )}
                {displayedDocuments.map((entry) => {
                  const visible = visibleDocumentKeys.has(documentKey(entry));
                  return (
                    <tr
                      className={`border-b border-border/70 last:border-b-0 ${visible ? "" : "bg-muted/20 opacity-60"}`}
                      key={`${entry.documentType}-${entry.documentNumber}`}
                    >
                      <td hidden={tools.hidden.includes("Show")} className="px-3 py-2.5">
                        <Checkbox
                          aria-label={`${visible ? "Hide" : "Show"} ${entry.documentNumber}`}
                          checked={visible}
                          onCheckedChange={(checked) => setDocumentVisible(entry, checked === true)}
                        />
                      </td>
                      <td hidden={tools.hidden.includes("#")} className="px-3 py-2.5">
                        {entry.serial}
                      </td>
                      <td
                        hidden={tools.hidden.includes("GST No")}
                        className="px-3 py-2.5 font-medium"
                      >
                        {entry.gstin || "Unregistered"}
                      </td>
                      <td hidden={tools.hidden.includes("Contact name")} className="px-3 py-2.5">
                        <div className="font-medium">{entry.contactName}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {entry.documentNumber} · {formatDate(entry.documentDate)}
                          {entry.documentType === "export-sale" ? " · Export" : ""}
                        </div>
                      </td>
                      <MoneyCell
                        hidden={tools.hidden.includes("Taxable amount")}
                        value={entry.taxableAmount}
                      />
                      <td
                        hidden={tools.hidden.includes("Tax %")}
                        className="px-3 py-2.5 text-right font-medium"
                      >
                        {entry.taxRates.length
                          ? entry.taxRates.map((rate) => `${rate}%`).join(", ")
                          : "0%"}
                      </td>
                      <MoneyCell hidden={tools.hidden.includes("IGST")} value={entry.igstAmount} />
                      <MoneyCell hidden={tools.hidden.includes("CGST")} value={entry.cgstAmount} />
                      <MoneyCell hidden={tools.hidden.includes("SGST")} value={entry.sgstAmount} />
                      <MoneyCell
                        hidden={tools.hidden.includes("Invoice total")}
                        strong
                        value={entry.invoiceTotal}
                      />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!displayedDocuments.length && loading ? <WorkspaceTableLoadingState /> : null}
          {!displayedDocuments.length && !loading ? (
            <WorkspaceTableEmptyState>
              {documents.length
                ? "All documents are hidden. Use the header checkbox to show them again."
                : `No confirmed ${sales ? "sales" : "purchase"} documents found for this month.`}
            </WorkspaceTableEmptyState>
          ) : null}
        </WorkspaceTablePanel>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-border/70 pt-4 sm:grid-cols-4">
        <PanelTotal label="Taxable" value={visibleTotals.taxableAmount} />
        <PanelTotal label="GST" value={visibleTotals.taxAmount} />
        <PanelTotal label="IGST" value={visibleTotals.igstAmount} />
        <PanelTotal label="Invoice total" value={visibleTotals.invoiceTotal} />
      </div>
    </section>
  );
}

function documentKey(entry: GstStatementDocument) {
  return `${entry.documentType}:${entry.documentNumber}`;
}

function summarizeDocuments(documents: GstStatementDocument[]) {
  return documents.reduce(
    (totals, entry) => ({
      cgstAmount: totals.cgstAmount + entry.cgstAmount,
      igstAmount: totals.igstAmount + entry.igstAmount,
      invoiceTotal: totals.invoiceTotal + entry.invoiceTotal,
      sgstAmount: totals.sgstAmount + entry.sgstAmount,
      taxAmount: totals.taxAmount + entry.igstAmount + entry.cgstAmount + entry.sgstAmount,
      taxableAmount: totals.taxableAmount + entry.taxableAmount
    }),
    {
      cgstAmount: 0,
      igstAmount: 0,
      invoiceTotal: 0,
      sgstAmount: 0,
      taxAmount: 0,
      taxableAmount: 0
    }
  );
}

export function GstStatementHsnCard({
  loading,
  panel,
  side,
  tools
}: {
  loading: boolean;
  panel: GstStatementPanel | undefined;
  side: "purchase" | "sales";
  tools: WorkspaceListTools;
}) {
  const sales = side === "sales";
  const hsn = panel?.hsn ?? [];
  return (
    <section className="min-w-0 space-y-3 rounded-md border border-border/80 bg-card p-4 shadow-sm">
      <header className="flex items-start justify-between gap-3 border-b border-border/70 pb-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md border border-border/70 bg-muted/40 p-2">
            {sales ? <ArrowUpRight className="size-5" /> : <ArrowDownLeft className="size-5" />}
          </div>
          <div>
            <h2 className="font-semibold">
              {sales ? "Sales HSN-wise report" : "Purchase HSN-wise report"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Product movement grouped by HSN code for this return period.
            </p>
          </div>
        </div>
        <WorkspaceStatusBadge
          label={`${hsn.length} HSN ${hsn.length === 1 ? "line" : "lines"}`}
          tone={sales ? "info" : "success"}
        />
      </header>

      <WorkspaceTablePanel>
        <div className={`overflow-x-auto ${gstStatementScrollbarClass}`}>
          <table className="w-full min-w-[820px] border-collapse text-xs">
            <thead className="bg-muted/50">
              <tr>
                {[
                  "HSN code",
                  "Product name",
                  "Total qty",
                  "Taxable amount",
                  "IGST",
                  "CGST",
                  "SGST"
                ].map((heading) => (
                  <th
                    hidden={tools.hidden.includes(heading)}
                    className={`border-b border-border/70 px-3 py-2.5 font-semibold uppercase tracking-wide text-muted-foreground ${["Total qty", "Taxable amount", "IGST", "CGST", "SGST"].includes(heading) ? "text-right" : "text-left"}`}
                    key={heading}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tools.showFilters && (
                <tr className="border-b border-border/70 bg-white">
                  {[
                    "HSN code",
                    "Product name",
                    "Total qty",
                    "Taxable amount",
                    "IGST",
                    "CGST",
                    "SGST"
                  ]
                    .filter((label) => !tools.hidden.includes(label))
                    .map((label) => (
                      <td className="px-4 py-2.5 text-foreground" key={label}>
                        {tools.filterRow(label)}
                      </td>
                    ))}
                </tr>
              )}
              {hsn.map((entry) => (
                <tr
                  className="border-b border-border/70 last:border-b-0"
                  key={`${entry.hsnCode}-${entry.productName}`}
                >
                  <td
                    hidden={tools.hidden.includes("HSN code")}
                    className="px-3 py-2.5 font-medium"
                  >
                    {entry.hsnCode}
                  </td>
                  <td hidden={tools.hidden.includes("Product name")} className="px-3 py-2.5">
                    {entry.productName}
                  </td>
                  <td
                    hidden={tools.hidden.includes("Total qty")}
                    className="px-3 py-2.5 text-right"
                  >
                    {formatGstQuantity(entry.totalQuantity)}
                  </td>
                  <MoneyCell
                    hidden={tools.hidden.includes("Taxable amount")}
                    value={entry.taxableAmount}
                  />
                  <MoneyCell hidden={tools.hidden.includes("IGST")} value={entry.igstAmount} />
                  <MoneyCell hidden={tools.hidden.includes("CGST")} value={entry.cgstAmount} />
                  <MoneyCell hidden={tools.hidden.includes("SGST")} value={entry.sgstAmount} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!hsn.length && loading ? <WorkspaceTableLoadingState /> : null}
        {!hsn.length && !loading ? (
          <WorkspaceTableEmptyState>No HSN movement found for this month.</WorkspaceTableEmptyState>
        ) : null}
      </WorkspaceTablePanel>
    </section>
  );
}

function PanelTotal({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{formatGstStatementMoney(value)}</div>
    </div>
  );
}

function MoneyCell({
  strong,
  value,
  hidden
}: {
  strong?: boolean;
  value: number;
  hidden?: boolean;
}) {
  return (
    <td hidden={hidden} className={`px-3 py-2.5 text-right ${strong ? "font-semibold" : ""}`}>
      {formatGstStatementMoney(value)}
    </td>
  );
}

function formatDate(value: string) {
  return formatWorkspaceDate(value);
}
