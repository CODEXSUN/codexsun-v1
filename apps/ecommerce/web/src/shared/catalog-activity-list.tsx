import { Card } from "@codexsun/ui/components/card";
import type { CatalogActivityRecord } from "./catalog-activity";

export function CatalogActivityList({
  loading,
  records
}: {
  loading: boolean;
  records: CatalogActivityRecord[];
}) {
  return (
    <Card title="Activity" description="Recent changes by staff users.">
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading activity...</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <ol className="space-y-4">
          {records.map((record) => (
            <li className="border-l-2 border-border pl-4" key={record.id}>
              <p className="text-sm font-medium">{record.summary || record.action}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {record.action} · {record.actorEmail} · {formatDate(record.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}
