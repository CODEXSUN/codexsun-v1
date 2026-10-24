import { Button } from "@codexsun/ui/components/button";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
export function BusinessStatus({ status }: { status: string }) {
  return (
    <WorkspaceStatusBadge
      label={status}
      tone={
        status === "warning"
          ? "warning"
          : status === "failed"
            ? "danger"
            : ["success", "imported", "updated", "existing"].includes(status)
              ? "success"
              : "info"
      }
    />
  );
}
export function BusinessPager({
  page,
  total,
  onChange
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / 100));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-sm">
      <span>
        {total} records · Page {page} of {pages} · 100 per page
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
export function BusinessLoadState({
  busy,
  error,
  empty
}: {
  busy: boolean;
  error: string;
  empty: boolean;
}) {
  return error ? (
    <p role="alert" className="py-4 text-sm text-destructive">
      {error}
    </p>
  ) : busy ? (
    <p role="status" className="py-4 text-sm text-muted-foreground">
      Loading report…
    </p>
  ) : empty ? (
    <p className="py-4 text-sm text-muted-foreground">No records in this view.</p>
  ) : null;
}
