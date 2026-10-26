import { WorkspaceTableEmptyState } from "@codexsun/ui/workspace/table";
import { capitalize, formatDateTime } from "./enquiry.view-utils";
import { PinLocationText } from "../../pin-location-text.js";
import type { EnquiryActivity } from "./enquiry.types";

export function EnquiryActivityPanel({
  activity,
  loading
}: {
  activity: EnquiryActivity[];
  loading: boolean;
}) {
  return (
    <section className="min-h-[34rem] bg-card p-4">
      <p className="mb-3 text-xs text-muted-foreground">
        {activity.length} {activity.length === 1 ? "record" : "records"}
      </p>
      {loading ? <p className="text-sm text-muted-foreground">Loading activity…</p> : null}
      <div className="workspace-scroll overflow-x-auto rounded-md border border-border/70">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Details</th>
              <th className="px-3 py-2">By</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((entry) => (
              <tr className="border-t border-border/70" key={entry.id}>
                <td className="px-3 py-2 font-medium">
                  {entry.action === "pin-location"
                    ? "Pin Location"
                    : capitalize(entry.action.replaceAll("-", " "))}
                </td>
                <td className="px-3 py-2">
                  {entry.action === "pin-location" ? (
                    <PinLocationText value={entry.details} />
                  ) : (
                    entry.details
                  )}
                </td>
                <td className="px-3 py-2">{entry.createdBy}</td>
                <td className="px-3 py-2">{formatDateTime(entry.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && activity.length === 0 ? (
          <WorkspaceTableEmptyState>No activity has been recorded.</WorkspaceTableEmptyState>
        ) : null}
      </div>
    </section>
  );
}
