import { useState } from "react";
import type { BusinessReport } from "./business-import.types.js";
import { BusinessPager, BusinessStatus } from "./business-import.presentation.js";
export function BusinessUsers({ report }: { report: BusinessReport["users"] }) {
  const [page, setPage] = useState(1);
  if (!report)
    return (
      <p className="py-4 text-sm text-muted-foreground">
        This report has no completed user transfer.
      </p>
    );
  const current = Math.min(page, Math.max(1, Math.ceil(report.rows.length / 100)));
  return (
    <section>
      <h3 className="mb-3 font-semibold">User import</h3>
      <p className="mb-3 text-sm">
        Imported {report.imported} | Existing preserved {report.existing} | Warnings{" "}
        {report.warnings}
      </p>
      <div className="overflow-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["Source ID", "Target ID", "Email", "Result", "Details"].map((label) => (
                <th className="p-3" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.slice((current - 1) * 100, current * 100).map((row) => (
              <tr className="border-b" key={row.sourceId}>
                <td className="p-3">{row.sourceId || "-"}</td>
                <td className="p-3">{row.targetId ?? "-"}</td>
                <td className="p-3">{row.email || "-"}</td>
                <td className="p-3">
                  <BusinessStatus status={row.status} />
                </td>
                <td className="p-3">{row.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <BusinessPager page={current} total={report.rows.length} onChange={setPage} />
    </section>
  );
}
