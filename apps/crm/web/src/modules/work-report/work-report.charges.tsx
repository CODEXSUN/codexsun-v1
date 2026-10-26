import { Button } from "@codexsun/ui/components/button";
import { Badge } from "@codexsun/ui/components/badge";
import { Input } from "@codexsun/ui/components/input";
import { Textarea } from "@codexsun/ui/components/textarea";
import { WorkspaceTableEmptyState } from "@codexsun/ui/workspace/table";
import { formatDateTime } from "@codexsun/ui/workspace/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useWorkReports, workReportKey } from "./work-report.hooks";
import { createWorkReport } from "./work-report.services";
import type { WorkReportPayload, WorkReportTarget } from "./work-report.types";

type ChargeAction = "charge" | "collection";

export function WorkChargesWorkspace({
  target,
  active = true
}: {
  target: WorkReportTarget;
  active?: boolean;
}) {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const history = useWorkReports(target, page, "charges", active);
  const [selectedAction, setSelectedAction] = useState<ChargeAction | null>(null);
  const [amount, setAmount] = useState("");
  const [body, setBody] = useState("");
  const retry = useRef<WorkReportPayload | null>(null);
  const totals = history.data?.amounts;
  const charged = totals?.charges ?? 0;
  const collected = totals?.collections ?? 0;
  const outstanding = Math.max(0, charged - collected);
  const action = selectedAction ?? (outstanding > 0 ? "collection" : "charge");
  const save = useMutation({
    mutationFn: createWorkReport,
    onSuccess: async (_, payload) => {
      retry.current = null;
      setAmount("");
      setBody("");
      setPage(1);
      await client.invalidateQueries({ queryKey: workReportKey(target) });
      setSelectedAction(null);
      toast.success(payload.action === "charge" ? "Charge initiated" : "Collection recorded");
    },
    onError: (error) => toast.error("Could not save charge", { description: error.message })
  });
  return (
    <section className="space-y-4 bg-card p-4">
      {history.error ? (
        <p role="alert" className="text-sm text-destructive">
          {history.error.message}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3" aria-label="Charge totals">
        <AmountSummary label="Initiated charges" value={charged} />
        <AmountSummary label="Collected" value={collected} />
        <AmountSummary label="Outstanding" value={outstanding} />
      </div>
      {outstanding > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200"
          role="status"
        >
          <Badge
            variant="outline"
            className="border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-700 dark:bg-violet-900/50 dark:text-violet-200"
          >
            Collection pending
          </Badge>
          <span>{formatCurrency(outstanding)} awaits collection details and confirmation.</span>
        </div>
      ) : null}
      <div className="space-y-3 rounded-md border border-border/70 p-3">
        <div className="flex flex-wrap gap-2" aria-label="Charge action">
          <Button
            type="button"
            variant={action === "charge" ? "default" : "outline"}
            aria-pressed={action === "charge"}
            disabled={save.isPending}
            onClick={() => setSelectedAction("charge")}
          >
            {outstanding > 0 ? "Initiate another charge" : "Initiate charge"}
          </Button>
          {outstanding > 0 ? (
            <Button
              type="button"
              variant={action === "collection" ? "default" : "outline"}
              aria-pressed={action === "collection"}
              disabled={save.isPending}
              onClick={() => setSelectedAction("collection")}
            >
              Collect charge
            </Button>
          ) : null}
        </div>
        <form
          className="grid gap-3 sm:grid-cols-[minmax(10rem,0.45fr)_minmax(16rem,1fr)_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (save.isPending) return;
            if (Number(amount) <= 0 || !Number.isFinite(Number(amount))) {
              toast.error("Enter an amount greater than zero.");
              return;
            }
            if (action === "collection" && Number(amount) > outstanding) {
              toast.error(`Collection cannot exceed ${formatCurrency(outstanding)} outstanding.`);
              return;
            }
            if (action === "collection" && !body.trim()) {
              toast.error("Enter collection notes before confirming.");
              return;
            }
            const normalizedBody = body.trim();
            const normalizedAmount = Number(amount);
            const previous = retry.current;
            if (
              !previous ||
              previous.enquiryId !== target.enquiryId ||
              previous.taskId !== target.taskId ||
              previous.action !== action ||
              previous.body !== normalizedBody ||
              previous.amount !== normalizedAmount
            ) {
              retry.current = {
                ...target,
                action,
                body: normalizedBody,
                amount: normalizedAmount,
                requestId: crypto.randomUUID(),
                latitude: null,
                longitude: null,
                accuracyMeters: null,
                capturedAt: null
              };
            }
            if (retry.current) save.mutate(retry.current);
          }}
        >
          <label className="space-y-1 text-sm font-medium">
            <span>{action === "charge" ? "Charge amount" : "Collected amount"} (₹)</span>
            <Input
              type="number"
              min="0.01"
              max={action === "collection" ? outstanding : undefined}
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={save.isPending || (action === "collection" && outstanding <= 0)}
              required
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>
              {action === "collection" ? "Collection notes *" : "Charge details (optional)"}
            </span>
            <Textarea
              className="h-11 min-h-11 resize-none"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={10000}
              rows={1}
              disabled={save.isPending}
              required={action === "collection"}
            />
          </label>
          <Button
            type="submit"
            disabled={save.isPending || (action === "collection" && outstanding <= 0)}
          >
            {save.isPending
              ? "Saving…"
              : action === "charge"
                ? "Initiate charge"
                : "Confirm collection"}
          </Button>
        </form>
      </div>
      <div>
        <p className="mb-3 text-xs text-muted-foreground">
          {history.data?.total ?? 0} {(history.data?.total ?? 0) === 1 ? "record" : "records"}
        </p>
        <div className="workspace-scroll overflow-x-auto rounded-md border border-border/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-12 px-3 py-2">#</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Details</th>
                <th className="px-3 py-2">By</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {(history.data?.items ?? []).map((row, index) => (
                <tr key={row.uuid} className="border-t border-border/70 align-top">
                  <td className="px-3 py-2 text-muted-foreground">
                    {(page - 1) * 100 + index + 1}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {row.action === "charge" ? "Charge initiated" : "Collected"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium">
                    {formatCurrency(Number(row.amount ?? 0))}
                  </td>
                  <td className="min-w-48 px-3 py-2 whitespace-pre-wrap">{row.body || "—"}</td>
                  <td className="px-3 py-2">{row.created_by_name || row.created_by}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatDateTime(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!history.isLoading && (history.data?.items.length ?? 0) === 0 ? (
            <WorkspaceTableEmptyState>No charges have been recorded.</WorkspaceTableEmptyState>
          ) : null}
        </div>
        {(history.data?.total ?? 0) > 100 ? (
          <div className="mt-3 flex items-center justify-end gap-3 text-sm">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span>
              Page {page} of {Math.ceil((history.data?.total ?? 0) / 100)}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page * 100 >= (history.data?.total ?? 0)}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function AmountSummary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/70 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{formatCurrency(value)}</p>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);
}
