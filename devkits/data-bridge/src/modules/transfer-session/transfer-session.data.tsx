import { useEffect, useState } from "react";
import { Button } from "@codexsun/ui/components/button";
import { Checkbox } from "@codexsun/ui/components/checkbox";
import { WorkspacePagination } from "@codexsun/ui/workspace/pagination";
import { WorkspaceTableHeaderCell } from "@codexsun/ui/workspace/table";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { transfers } from "./transfer-session.services.js";
import type { TransferSession } from "./transfer-session.types.js";
export function TransferPrepare({
  session,
  busy,
  onSave
}: {
  session: TransferSession;
  busy: boolean;
  onSave: (ids: number[]) => void;
}) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void transfers
      .preview(session.id, page)
      .then((data) => {
        if (active) {
          setRows(data.rows);
          setTotal(data.total);
          setError("");
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session.id, page]);
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Select source records / {selected.length} selected</h2>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div className="overflow-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <WorkspaceTableHeaderCell>Select</WorkspaceTableHeaderCell>
              <WorkspaceTableHeaderCell>Source ID</WorkspaceTableHeaderCell>
              <WorkspaceTableHeaderCell>Source data</WorkspaceTableHeaderCell>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={Number(row.id)}>
                <td className="p-3">
                  <Checkbox
                    aria-label={`Select source ${row.id}`}
                    checked={selected.includes(Number(row.id))}
                    onCheckedChange={(checked) =>
                      setSelected((old) =>
                        checked
                          ? [...old, Number(row.id)]
                          : old.filter((id) => id !== Number(row.id))
                      )
                    }
                  />
                </td>
                <td className="p-3">{String(row.id)}</td>
                <td className="p-3">
                  <pre className="whitespace-pre-wrap break-all text-xs">
                    {JSON.stringify(row, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <WorkspacePagination
        page={page}
        rowsPerPage={100}
        rowsPerPageOptions={[100]}
        totalCount={total}
        totalPages={Math.max(1, Math.ceil(total / 100))}
        singularLabel="source rows"
        showingLabel={`Page ${page}`}
        onPageChange={setPage}
        onPreviousPage={() => setPage(page - 1)}
        onNextPage={() => setPage(page + 1)}
      />
      <Button
        disabled={busy || loading || !selected.length || selected.length > 1000}
        onClick={() => onSave(selected)}
      >
        Prepare and audit {selected.length} rows
      </Button>
    </section>
  );
}
export function TransferResults({ session }: { session: TransferSession }) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const rows = session.rows.filter((r) => filter === "all" || r.status === filter);
  const pages = Math.max(1, Math.ceil(rows.length / 100));
  const current = Math.min(page, pages);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {["all", "ready", "imported", "existing", "warning"].map((v) => (
          <Button
            key={v}
            variant={filter === v ? "default" : "outline"}
            onClick={() => {
              setFilter(v);
              setPage(1);
            }}
          >
            {v === "imported" ? "imported / updated" : v} /{" "}
            {session.rows.filter((r) => v === "all" || r.status === v).length}
          </Button>
        ))}
      </div>
      <div className="overflow-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {[
                "Source ID",
                "Result",
                "Extracted source",
                "Prepared target data",
                "Matched target",
                "Details"
              ].map((v) => (
                <WorkspaceTableHeaderCell key={v}>{v}</WorkspaceTableHeaderCell>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.slice((current - 1) * 100, current * 100).map((r) => (
              <tr key={r.sourceId} className={r.status === "warning" ? "bg-amber-500/10" : ""}>
                <td className="p-3 align-top">{r.sourceId}</td>
                <td className="p-3 align-top">
                  <WorkspaceStatusBadge
                    label={r.reuse && r.status === "imported" ? "updated" : r.status}
                    tone={r.status === "warning" ? "warning" : "success"}
                  />
                </td>
                {[r.source, r.data, r.target].map((data, i) => (
                  <td key={i} className="p-3 align-top">
                    <pre className="min-w-48 whitespace-pre-wrap break-all text-xs">
                      {data ? JSON.stringify(data, null, 2) : "No match"}
                    </pre>
                  </td>
                ))}
                <td className="p-3 align-top">{r.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <WorkspacePagination
        page={current}
        rowsPerPage={100}
        rowsPerPageOptions={[100]}
        totalCount={rows.length}
        totalPages={pages}
        singularLabel="records"
        showingLabel={`Page ${current} of ${pages}`}
        onPageChange={setPage}
        onPreviousPage={() => setPage(current - 1)}
        onNextPage={() => setPage(current + 1)}
      />
    </section>
  );
}
