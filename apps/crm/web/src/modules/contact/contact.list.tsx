import { useRef, type KeyboardEvent } from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@codexsun/ui/components/input";
import { WorkspaceProtectedIndicator } from "@codexsun/ui/workspace/protected-indicator";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import {
  WorkspaceTableEmptyState,
  WorkspaceTableHeaderCell,
  WorkspaceTablePanel,
  WorkspaceTableLoadingState
} from "@codexsun/ui/workspace/table";
import type { ContactRecord } from "./contact.types";

export type ContactColumnFilters = Partial<
  Record<"contact" | "code" | "phone" | "email" | "status", string>
>;

const columns = [
  { id: "contact", label: "Contact" },
  { id: "code", label: "Code" },
  { id: "phone", label: "Phone" },
  { id: "email", label: "Email" },
  { id: "status", label: "Status" }
] as const;

export function CrmContactList({
  loading,
  visibleColumns,
  showInlineFilters,
  columnFilters,
  onColumnFilterChange,
  onHideInlineFilters,
  onView,
  onEdit,
  onForceDelete,
  onToggle,
  records
}: {
  loading: boolean;
  visibleColumns: Record<string, boolean>;
  showInlineFilters: boolean;
  columnFilters: ContactColumnFilters;
  onColumnFilterChange: (column: keyof ContactColumnFilters, value: string) => void;
  onHideInlineFilters: () => void;
  onView?: (record: ContactRecord) => void;
  onEdit: (record: ContactRecord) => void;
  onForceDelete: (record: ContactRecord) => void;
  onToggle: (record: ContactRecord) => void;
  records: ContactRecord[];
}) {
  const shownColumns = columns.filter((column) => visibleColumns[column.id] !== false);
  return (
    <WorkspaceTablePanel>
      <div className="workspace-scroll overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr>
              {shownColumns.map((column) => (
                <WorkspaceTableHeaderCell key={column.id}>{column.label}</WorkspaceTableHeaderCell>
              ))}
              <WorkspaceTableHeaderCell className="text-right">Action</WorkspaceTableHeaderCell>
            </tr>
          </thead>
          <tbody>
            {showInlineFilters ? (
              <tr className="border-b bg-white">
                {shownColumns.map((column) => (
                  <td className="px-4 py-2" key={column.id}>
                    <InlineFilterInput
                      label={column.label}
                      value={columnFilters[column.id] ?? ""}
                      onChange={(value) => onColumnFilterChange(column.id, value)}
                      onHide={onHideInlineFilters}
                    />
                  </td>
                ))}
                <td />
              </tr>
            ) : null}
            {records.map((record) => {
              const locked = record.name.trim() === "-";
              return (
                <tr
                  className={`border-b last:border-0 ${onView && !locked ? "cursor-pointer hover:bg-muted/30" : ""}`}
                  key={record.id}
                  onClick={() => {
                    if (!locked) onView?.(record);
                  }}
                >
                  <td className="px-4 py-3">
                    <button
                      className="font-medium hover:underline"
                      disabled={locked}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (onView) onView(record);
                        else onEdit(record);
                      }}
                    >
                      {record.name}
                    </button>
                  </td>
                  {visibleColumns.code !== false ? (
                    <td className="px-4 py-3">{record.code}</td>
                  ) : null}
                  {visibleColumns.phone !== false ? (
                    <td className="px-4 py-3">{record.primaryPhone || "-"}</td>
                  ) : null}
                  {visibleColumns.email !== false ? (
                    <td className="px-4 py-3">{record.primaryEmail || "-"}</td>
                  ) : null}
                  {visibleColumns.status !== false ? (
                    <td className="px-4 py-3">
                      <WorkspaceStatusBadge
                        label={record.isActive ? "active" : "inactive"}
                        tone={record.isActive ? "success" : "warning"}
                      />
                    </td>
                  ) : null}

                  <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                    {locked ? (
                      <WorkspaceProtectedIndicator />
                    ) : (
                      <WorkspaceRowActions
                        actions={[
                          {
                            id: "force-delete",
                            icon: <Trash2 className="size-4" />,
                            label: "Force delete",
                            onSelect: () => onForceDelete(record),
                            tone: "destructive"
                          }
                        ]}
                        deleteLabel="Suspend"
                        isSuspended={!record.isActive}
                        onDelete={() => onToggle(record)}
                        onEdit={() => onEdit(record)}
                        onRestore={() => onToggle(record)}
                        restoreLabel="Activate"
                        title={record.name}
                        {...(onView ? { onView: () => onView(record) } : {})}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {loading && !records.length ? <WorkspaceTableLoadingState /> : null}
      {!loading && !records.length ? (
        <WorkspaceTableEmptyState>No contacts found.</WorkspaceTableEmptyState>
      ) : null}
    </WorkspaceTablePanel>
  );
}

function InlineFilterInput({
  label,
  value,
  onChange,
  onHide
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onHide: () => void;
}) {
  const escapeStep = useRef(0);

  function handleEscape(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;

    escapeStep.current += 1;
    if (escapeStep.current === 1) event.currentTarget.select();
    else if (escapeStep.current === 2) onChange("");
    else {
      escapeStep.current = 0;
      onHide();
    }
  }

  return (
    <Input
      aria-label={`Filter ${label}`}
      className="h-7 min-w-0 rounded-sm border-border/80 bg-white px-2 text-xs shadow-none"
      maxLength={191}
      value={value}
      onChange={(event) => {
        escapeStep.current = 0;
        onChange(event.target.value);
      }}
      onKeyDown={handleEscape}
    />
  );
}
