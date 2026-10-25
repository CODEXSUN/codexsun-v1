import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@codexsun/ui/components/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@codexsun/ui/components/table";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { WorkspaceColumnFilter } from "@codexsun/ui/workspace/column-filter";
import { WorkspacePagination } from "@codexsun/ui/workspace/pagination";
import { WorkspaceDateRangePicker } from "@codexsun/ui/workspace/date-range-picker";
import { buildShowingLabel, formatDateTime } from "@codexsun/ui/workspace/utils";
import type { ThreadRecord, ThreadStatus } from "./conversation.types";

const columnDefinitions = [
  { id: "contactIdentifier", label: "Contact / Phone", defaultVisible: true },
  { id: "contactName", label: "Contact Name", defaultVisible: true },
  { id: "channel", label: "Channel", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "takeover", label: "Takeover / Automation", defaultVisible: true },
  { id: "lastMessageAt", label: "Last Message", defaultVisible: true },
  { id: "createdAt", label: "Created", defaultVisible: false }
];

export function ConversationList({
  items,
  totalCount,
  search,
  onSearchChange,
  status,
  onStatusChange,
  fromDate = "",
  toDate = "",
  onDateRangeChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  columnFilters,
  onColumnFilterChange,
  onClearColumnFilters,
  onSelectRecord,
  onNew
}: {
  items: ThreadRecord[];
  totalCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  fromDate?: string;
  toDate?: string;
  onDateRangeChange?: (range: { fromDate: string; toDate: string }) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  columnFilters: Record<string, string>;
  onColumnFilterChange: (column: string, value: string) => void;
  onClearColumnFilters: () => void;
  onSelectRecord: (record: ThreadRecord) => void;
  onNew: () => void;
}) {
  const [showColumnFilters, setShowColumnFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(columnDefinitions.map((c) => [c.id, c.defaultVisible]))
  );

  const activeColumnFilterCount = Object.values(columnFilters).filter((v) => Boolean(v?.trim())).length;
  const activeFiltersCount = (status !== "all" ? 1 : 0) + (fromDate || toDate ? 1 : 0) + activeColumnFilterCount;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const toggleColumnVisibility = (colId: string) => {
    setVisibleColumns((prev) => ({ ...prev, [colId]: !prev[colId] }));
  };

  const statusTone = (st: ThreadStatus): "success" | "warning" | "neutral" | "danger" => {
    switch (st) {
      case "open":
        return "success";
      case "resolved":
        return "neutral";
      case "closed":
        return "warning";
      default:
        return "neutral";
    }
  };

  return (
    <WorkspacePage title="Conversations">
      {/* 1. Single Unified Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-3">
        <div className="flex flex-1 flex-wrap items-center gap-2 min-w-[280px]">
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="w-full sm:w-64"
            aria-label="Search conversations"
          />

          <WorkspaceDateRangePicker
            fromDate={fromDate}
            toDate={toDate}
            onValueChange={onDateRangeChange ?? (() => {})}
          />

          <Button
            type="button"
            variant={showColumnFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowColumnFilters(!showColumnFilters)}
            className="gap-1.5"
            aria-label="Toggle column filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Filter</span>
            {activeColumnFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {activeColumnFilterCount}
              </span>
            )}
          </Button>

          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="rounded-md bg-secondary/80 px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                {activeFiltersCount} active {activeFiltersCount === 1 ? "filter" : "filters"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  onSearchChange("");
                  onStatusChange("all");
                  onClearColumnFilters();
                }}
              >
                Clear all
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Status quick select */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Status filter">
                Status: {status === "all" ? "All" : status}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {["all", "open", "resolved", "closed"].map((st) => (
                <DropdownMenuCheckboxItem
                  key={st}
                  checked={status === st}
                  onCheckedChange={() => onStatusChange(st)}
                >
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Columns Visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Columns">
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {columnDefinitions.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={Boolean(visibleColumns[col.id])}
                  onCheckedChange={() => toggleColumnVisibility(col.id)}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button type="button" onClick={onNew} aria-label="New Conversation">
            New Conversation
          </Button>
        </div>
      </div>

      {/* 2. Responsive Table View */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.contactIdentifier && <TableHead>Contact / Phone</TableHead>}
              {visibleColumns.contactName && <TableHead>Contact Name</TableHead>}
              {visibleColumns.channel && <TableHead>Channel</TableHead>}
              {visibleColumns.status && <TableHead>Status</TableHead>}
              {visibleColumns.takeover && <TableHead>Takeover / Automation</TableHead>}
              {visibleColumns.lastMessageAt && <TableHead>Last Message</TableHead>}
              {visibleColumns.createdAt && <TableHead>Created</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* First White Row for Column Search */}
            {showColumnFilters && (
              <TableRow className="bg-card hover:bg-card">
                {visibleColumns.contactIdentifier && (
                  <TableCell className="p-1">
                    <WorkspaceColumnFilter
                      label="Contact / Phone"
                      value={columnFilters.contactIdentifier ?? ""}
                      onChange={(val) => onColumnFilterChange("contactIdentifier", val)}
                      onHide={() => toggleColumnVisibility("contactIdentifier")}
                    />
                  </TableCell>
                )}
                {visibleColumns.contactName && (
                  <TableCell className="p-1">
                    <WorkspaceColumnFilter
                      label="Contact Name"
                      value={columnFilters.contactName ?? ""}
                      onChange={(val) => onColumnFilterChange("contactName", val)}
                      onHide={() => toggleColumnVisibility("contactName")}
                    />
                  </TableCell>
                )}
                {visibleColumns.channel && (
                  <TableCell className="p-1">
                    <WorkspaceColumnFilter
                      label="Channel"
                      value={columnFilters.channel ?? ""}
                      onChange={(val) => onColumnFilterChange("channel", val)}
                      onHide={() => toggleColumnVisibility("channel")}
                    />
                  </TableCell>
                )}
                {visibleColumns.status && <TableCell className="p-1" />}
                {visibleColumns.takeover && <TableCell className="p-1" />}
                {visibleColumns.lastMessageAt && <TableCell className="p-1" />}
                {visibleColumns.createdAt && <TableCell className="p-1" />}
              </TableRow>
            )}

            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={Object.values(visibleColumns).filter(Boolean).length}
                  className="h-32 text-center text-muted-foreground"
                >
                  No conversation threads found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow
                  key={row.uuid}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onSelectRecord(row)}
                >
                  {visibleColumns.contactIdentifier && (
                    <TableCell className="font-medium text-foreground">
                      {row.contactIdentifier}
                    </TableCell>
                  )}
                  {visibleColumns.contactName && (
                    <TableCell>{row.contactName || "—"}</TableCell>
                  )}
                  {visibleColumns.channel && (
                    <TableCell className="capitalize">{row.channel}</TableCell>
                  )}
                  {visibleColumns.status && (
                    <TableCell>
                      <WorkspaceStatusBadge
                        tone={statusTone(row.status)}
                        label={row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                      />
                    </TableCell>
                  )}
                  {visibleColumns.takeover && (
                    <TableCell>
                      {row.isHumanTakeover ? (
                        <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10 dark:bg-purple-950 dark:text-purple-300">
                          Human Takeover
                        </span>
                      ) : row.stopConditionMet ? (
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-700/10 dark:bg-amber-950 dark:text-amber-300">
                          Automation Stopped
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-700/10 dark:bg-green-950 dark:text-green-300">
                          Bot Active
                        </span>
                      )}
                    </TableCell>
                  )}
                  {visibleColumns.lastMessageAt && (
                    <TableCell className="text-muted-foreground">
                      {row.lastMessageAt ? formatDateTime(row.lastMessageAt) : "—"}
                    </TableCell>
                  )}
                  {visibleColumns.createdAt && (
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 3. Mobile Cards View */}
      <div className="divide-y md:hidden">
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No conversation threads found.
          </div>
        ) : (
          items.map((row) => (
            <div
              key={row.uuid}
              onClick={() => onSelectRecord(row)}
              className="flex flex-col gap-2 p-4 hover:bg-muted/30 cursor-pointer active:bg-muted/50"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-sm">{row.contactIdentifier}</span>
                <WorkspaceStatusBadge
                  tone={statusTone(row.status)}
                  label={row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                />
              </div>
              {row.contactName && (
                <div className="text-xs text-muted-foreground">{row.contactName}</div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="capitalize">{row.channel}</span>
                {row.isHumanTakeover ? (
                  <span className="font-medium text-purple-600">Human Takeover</span>
                ) : (
                  <span className="font-medium text-green-600">Bot Active</span>
                )}
                <span>{row.lastMessageAt ? formatDateTime(row.lastMessageAt) : ""}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 4. Pagination */}
      <WorkspacePagination
        page={page}
        rowsPerPage={pageSize}
        rowsPerPageOptions={[10, 20, 50, 100]}
        showingLabel={buildShowingLabel(page, pageSize, totalCount)}
        singularLabel="conversation"
        totalCount={totalCount}
        totalPages={totalPages}
        onNextPage={() => onPageChange(Math.min(totalPages, page + 1))}
        onPageChange={onPageChange}
        onPreviousPage={() => onPageChange(Math.max(1, page - 1))}
        onRowsPerPageChange={onPageSizeChange}
      />
    </WorkspacePage>
  );
}
