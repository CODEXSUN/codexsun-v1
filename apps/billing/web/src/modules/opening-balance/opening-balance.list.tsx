import type { WorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import { Button } from "@codexsun/ui/components/button";
import { WorkspaceTablePanel } from "@codexsun/ui/workspace/table";
import type { OpeningBalance } from "./opening-balance.types";
export function OpeningBalanceList({
  items,
  onEdit,
  canEdit,
  tools
}: {
  items: OpeningBalance[];
  onEdit: (item: OpeningBalance) => void;
  canEdit: boolean;
  tools: WorkspaceListTools;
}) {
  return (
    <WorkspaceTablePanel>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            {!tools.hidden.includes("Party") && <th className="p-3">PARTY</th>}
            {!tools.hidden.includes("Role") && <th className="p-3">ROLE</th>}
            {!tools.hidden.includes("Opening") && <th className="p-3">OPENING</th>}
            {!tools.hidden.includes("Source") && <th className="p-3">SOURCE</th>}
            {!tools.hidden.includes("Action") && <th className="p-3">ACTION</th>}
          </tr>
        </thead>
        <tbody>
          {tools.showFilters && (
            <tr className="border-b border-border/70 bg-white">
              {["Party", "Role", "Opening", "Source", "Action"]
                .filter((label) => !tools.hidden.includes(label))
                .map((label) => (
                  <td className="px-4 py-2.5 text-foreground" key={label}>
                    {label === "Action" ? null : tools.filterRow(label)}
                  </td>
                ))}
            </tr>
          )}
          {items.map((item) => (
            <tr key={item.id} className="border-b">
              <td hidden={tools.hidden.includes("Party")} className="p-3">
                {item.contactName}
              </td>
              <td hidden={tools.hidden.includes("Role")} className="p-3">
                {item.partyRole}
              </td>
              <td hidden={tools.hidden.includes("Opening")} className="p-3">
                {item.currencyCode} {item.amount.toFixed(2)}
              </td>
              <td hidden={tools.hidden.includes("Source")} className="p-3">
                {item.assignLegacy ? "Reviewed legacy assignment" : "Manual opening"}
              </td>
              <td hidden={tools.hidden.includes("Action")} className="p-3">
                <Button variant="outline" disabled={!canEdit} onClick={() => onEdit(item)}>
                  Edit
                </Button>
              </td>
            </tr>
          ))}
          {!items.length ? (
            <tr>
              <td colSpan={5} className="p-4 text-muted-foreground">
                No scoped openings. Legacy values remain unchanged.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </WorkspaceTablePanel>
  );
}
