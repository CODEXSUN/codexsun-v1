import { useCallback, useState } from "react";
import { Button } from "@codexsun/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@codexsun/ui/components/dialog";
import { getBusinessRows } from "./business-import.services.js";
import { useBusinessPage } from "./business-import.hooks.js";
import {
  BusinessStatus,
  BusinessPager,
  BusinessLoadState
} from "./business-import.presentation.js";
import type { BusinessTable, BusinessRow, InvoiceSelection } from "./business-import.types.js";
export function BusinessRows({
  runId,
  table,
  updatedAt,
  invoice,
  onBack
}: {
  runId: string;
  table: BusinessTable;
  updatedAt: string;
  invoice?: InvoiceSelection;
  onBack: () => void;
}) {
  const [page, setPage] = useState(1),
    [status, setStatus] = useState("all"),
    [selected, setSelected] = useState<BusinessRow | null>(null);
  const load = useCallback(
    () => getBusinessRows(runId, table.table, page, status, invoice),
    [runId, table.table, page, status, invoice, updatedAt]
  );
  const { data, busy, error } = useBusinessPage(load);
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button size="sm" variant="outline" onClick={onBack}>
            Back to tables
          </Button>
          <h3 className="mt-3 font-semibold">
            {table.sourceTable} → {table.table}
            {invoice ? ` · Invoice source ${invoice.sourceId}` : ""}
          </h3>
        </div>
        <select
          aria-label="Row result"
          className="h-9 rounded border bg-background px-3 text-sm"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All rows</option>
          <option value="imported">Imported / updated</option>
          <option value="existing">Existing</option>
          <option value="warning">Warnings</option>
        </select>
      </div>
      <BusinessLoadState busy={busy} error={error} empty={!data.rows.length} />
      {!busy && !error && data.rows.length ? (
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr>
                {["Source row", "Result", "Details", "Data"].map((label) => (
                  <th className="p-3" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr className="border-b" key={row.sourceId}>
                  <td className="p-3">{row.sourceId}</td>
                  <td className="p-3">
                    <BusinessStatus
                      status={row.reuse && row.status === "imported" ? "updated" : row.status}
                    />
                  </td>
                  <td className="p-3">{row.message}</td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
                      View data
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <BusinessPager page={page} total={data.total} onChange={setPage} />
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent
          className="max-h-[85vh] overflow-auto sm:max-w-6xl"
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle>
              {table.table} · Source row {selected?.sourceId}
            </DialogTitle>
          </DialogHeader>
          {selected ? (
            <>
              <BusinessStatus
                status={
                  selected.reuse && selected.status === "imported" ? "updated" : selected.status
                }
              />
              <div className="grid gap-4 lg:grid-cols-3">
                {[
                  ["Extracted source", selected.source],
                  ["Prepared target", selected.data],
                  ["Saved target", selected.target]
                ].map(([label, values]) => (
                  <section key={String(label)}>
                    <h4 className="mb-2 font-medium">{String(label)}</h4>
                    <pre className="overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">
                      {values ? JSON.stringify(values, null, 2) : "No matching target record"}
                    </pre>
                  </section>
                ))}
              </div>
              {table.references.length ? (
                <div>
                  <h4 className="mb-2 font-medium">Foreign ID mapping</h4>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        {["Parent", "Source field / ID", "Target field / ID"].map((label) => (
                          <th className="p-2" key={label}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.references.map((ref) => (
                        <tr className="border-t" key={ref.targetField}>
                          <td className="p-2">{ref.parentTable}</td>
                          <td className="p-2">
                            {ref.sourceField}: {String(selected.source[ref.sourceField] ?? "—")}
                          </td>
                          <td className="p-2">
                            {ref.targetField}: {String(selected.data[ref.targetField] ?? "—")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <p className="text-sm">{selected.message}</p>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
