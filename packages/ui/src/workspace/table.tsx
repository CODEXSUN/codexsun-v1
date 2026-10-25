"use client";

import { flexRender, type RowData, type SortingState } from "@tanstack/react-table";
import {
  getCoreRowModel,
  getSortedRowModel,
  useLegacyTable,
  type LegacyColumnDef
} from "@tanstack/react-table/legacy";
import { ArrowUpDown } from "lucide-react";
import { useRef, useState, type ReactNode, type ThHTMLAttributes } from "react";
import { cn } from "../lib/utils";
import { GlobalLoader } from "../components/global-loader";

export const workspaceTablePanelClass =
  "overflow-hidden rounded-md border border-border/70 bg-card/95 shadow-sm";

export const workspaceTableHeaderClass =
  "border-b border-border/70 bg-muted/50 px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";

export const workspaceTableRowClass =
  "border-b border-border/70 transition-colors last:border-b-0 hover:bg-muted/20";

export const workspaceTableCellClass = "px-4 py-2.5 text-foreground";

export function WorkspaceTable<T extends RowData>({
  columns,
  data,
  emptyState,
  filterRow,
  isLoading,
  minWidth = "640px",
  mobileRow,
  panelClassName,
  onRowClick
}: {
  columns: LegacyColumnDef<T>[];
  data: T[];
  emptyState?: ReactNode;
  filterRow?: (columnId: string) => ReactNode;
  isLoading?: boolean;
  minWidth?: string;
  mobileRow?: (record: T) => ReactNode;
  panelClassName?: string;
  onRowClick?: (row: T) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const settledData = useRef(data);

  if (!isLoading) settledData.current = data;
  const visibleData = isLoading && data.length === 0 ? settledData.current : data;

  const table = useLegacyTable({
    columns,
    data: visibleData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting }
  });
  const mobileFilters = filterRow
    ? table
        .getVisibleLeafColumns()
        .map((column) => ({ id: column.id, content: filterRow(column.id) }))
        .filter(({ content }) => content !== null && content !== undefined && content !== false)
    : [];

  return (
    <WorkspaceTablePanel {...(panelClassName ? { className: panelClassName } : {})}>
      {mobileRow ? (
        <div className="grid gap-3 p-3 md:hidden">
          {mobileFilters.length ? (
            <div className="grid gap-2 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
              {mobileFilters.map((filter) => (
                <div key={filter.id}>{filter.content}</div>
              ))}
            </div>
          ) : null}
          {table.getRowModel().rows.length === 0 ? (
            isLoading ? (
              <WorkspaceTableLoadingState />
            ) : (
              <WorkspaceTableEmptyState>
                {emptyState ?? "No records found."}
              </WorkspaceTableEmptyState>
            )
          ) : (
            table.getRowModel().rows.map((row) => <div key={row.id}>{mobileRow(row.original)}</div>)
          )}
        </div>
      ) : null}
      <div className={cn("workspace-scroll overflow-x-auto", mobileRow && "hidden md:block")}>
        <table className="w-full border-collapse text-sm" style={{ minWidth }}>
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <WorkspaceTableHeaderCell
                    key={header.id}
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn(
                          "flex items-center gap-1",
                          header.column.getCanSort() && "cursor-pointer select-none"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() ? (
                          <ArrowUpDown className="size-3.5 text-muted-foreground/60" />
                        ) : null}
                      </div>
                    )}
                  </WorkspaceTableHeaderCell>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {filterRow ? (
              <tr className={cn(workspaceTableRowClass, "bg-white hover:bg-white")}>
                {table.getVisibleLeafColumns().map((column) => (
                  <td key={column.id} className={workspaceTableCellClass}>
                    {filterRow(column.id)}
                  </td>
                ))}
              </tr>
            ) : null}
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(workspaceTableRowClass, onRowClick && "cursor-pointer")}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={workspaceTableCellClass}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.getRowModel().rows.length === 0 ? (
        isLoading ? (
          <WorkspaceTableLoadingState />
        ) : (
          <WorkspaceTableEmptyState>{emptyState ?? "No records found."}</WorkspaceTableEmptyState>
        )
      ) : null}
    </WorkspaceTablePanel>
  );
}

export function WorkspaceTablePanel({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(workspaceTablePanelClass, className)}>{children}</div>;
}

export function WorkspaceTableHeaderCell({
  children,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn(workspaceTableHeaderClass, className)} {...props}>
      {children}
    </th>
  );
}

export function WorkspaceTableEmptyState({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-6 py-14 text-center text-sm text-muted-foreground", className)}>
      {children}
    </div>
  );
}

export function WorkspaceTableLoadingState() {
  return <GlobalLoader className="min-h-32" fullScreen={false} />;
}
