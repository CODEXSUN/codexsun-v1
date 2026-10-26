import { formatCrmDateTime } from "../../crm-time.js";
import { PinLocationText } from "../../pin-location-text.js";
import { WorkspaceTableEmptyState } from "@codexsun/ui/workspace/table";
import type { WorkReport } from "./work-report.types";

export function WorkReportList({
  items,
  total,
  offset = 0
}: {
  items: WorkReport[];
  total?: number | undefined;
  offset?: number;
}) {
  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        {total ?? items.length} {(total ?? items.length) === 1 ? "record" : "records"}
      </p>
      <div className="workspace-scroll overflow-x-auto rounded-md border border-border/70">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-2">#</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Details</th>
              <th className="px-3 py-2">By</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, index) => (
              <tr key={row.uuid} className="border-t border-border/70 align-top">
                <td className="px-3 py-2 text-muted-foreground">{offset + index + 1}</td>
                <td className="px-3 py-2 font-medium capitalize whitespace-nowrap">
                  {row.action === "pin-location"
                    ? "Pin Location"
                    : ["report", "comment", "comment-added"].includes(row.action)
                      ? "Comments"
                      : row.action.replaceAll("-", " ")}
                </td>
                <td className="min-w-56 max-w-xl px-3 py-2">
                  <p className="whitespace-pre-wrap break-words">
                    {row.action === "pin-location" ? (
                      <PinLocationText value={row.body} />
                    ) : (
                      workReportText(row.body) || "—"
                    )}
                  </p>
                  {row.latitude !== null && row.longitude !== null ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <a
                        className="underline"
                        href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {row.latitude}, {row.longitude}
                      </a>
                      {" · Accuracy: "}
                      {row.accuracy_meters ?? "Unknown"} m{" · Captured: "}
                      {row.captured_at ? formatCrmDateTime(row.captured_at) : "—"}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2 break-words">{row.created_by_name || row.created_by}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatCrmDateTime(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 ? (
          <WorkspaceTableEmptyState>No actions reported yet.</WorkspaceTableEmptyState>
        ) : null}
      </div>
    </div>
  );
}

function workReportText(value: string) {
  if (!/<\/?[a-z][^>]*>|&(?:#\d+|#x[\da-f]+|[a-z]+);/iu.test(value)) return value;
  const document = new DOMParser().parseFromString(value, "text/html");
  document.querySelectorAll("script, style, template, noscript").forEach((node) => node.remove());
  document.querySelectorAll("br, hr").forEach((node) => node.replaceWith("\n"));
  document
    .querySelectorAll("p, div, li, tr, blockquote, h1, h2, h3, h4, h5, h6")
    .forEach((node) => node.after("\n"));
  return (document.body.textContent ?? "")
    .replace(/\u00a0/gu, " ")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}
