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
import type { EmailCampaignRecord, EmailCampaignStatus } from "./email-campaign.types";

const columnDefinitions = [
  { id: "name", label: "Campaign Name", defaultVisible: true },
  { id: "subject", label: "Subject Line", defaultVisible: true },
  { id: "fromEmail", label: "Sender Email", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "audience", label: "Audience / Sent", defaultVisible: true },
  { id: "scheduledAt", label: "Scheduled", defaultVisible: true },
  { id: "createdAt", label: "Created", defaultVisible: false }
];

export function EmailCampaignList({
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
  items: EmailCampaignRecord[];
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
  onSelectRecord: (record: EmailCampaignRecord) => void;
  onNew: () => void;
}) {
  const [showColumnFilters, setShowColumnFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(columnDefinitions.map((c) => [c.id, c.defaultVisible]))
  );

  const activeColumnFilterCount = Object.values(columnFilters).filter(Boolean).length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const toggleColumn = (id: string) => {
    setVisibleColumns((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const statusTone = (st: EmailCampaignStatus): "success" | "warning" | "neutral" | "danger" => {
    switch (st) {
      case "approved":
      case "completed":
        return "success";
      case "pending_approval":
      case "scheduled":
      case "sending":
        return "warning";
      case "rejected":
      case "cancelled":
        return "danger";
      case "paused":
      case "draft":
      default:
        return "neutral";
    }
  };

  return (
    <WorkspacePage
      title="Email Campaigns"
      description="Create, schedule, and dispatch marketing email campaigns through verified senders with suppression safety."
      technicalName="page.marketing.email-campaign.list"
      actions={
        <Button onClick={onNew}>
          New Email Campaign
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Unified CRM-tone Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search email campaigns..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 w-64 text-sm"
          />

          <WorkspaceDateRangePicker
            fromDate={fromDate}
            toDate={toDate}
            onValueChange={onDateRangeChange ?? (() => {})}
          />

          <Button
            variant={showColumnFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowColumnFilters(!showColumnFilters)}
            className="relative"
          >
            <SlidersHorizontal className="mr-1 size-3.5" />
            Column filters
            {activeColumnFilterCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.2 text-[10px] text-primary-foreground">
                {activeColumnFilterCount}
              </span>
            ) : null}
          </Button>

          {activeColumnFilterCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearColumnFilters}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear filters ({activeColumnFilterCount})
            </Button>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Status: {status === "all" ? "All" : status}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {["all", "draft", "pending_approval", "approved", "scheduled", "sending", "completed", "paused", "rejected", "cancelled"].map(
                  (s) => (
                    <DropdownMenuCheckboxItem
                      key={s}
                      checked={status === s}
                      onCheckedChange={() => onStatusChange(s)}
                    >
                      {s === "all" ? "All statuses" : s.replace("_", " ")}
                    </DropdownMenuCheckboxItem>
                  )
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {columnDefinitions.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={visibleColumns[c.id] ?? false}
                    onCheckedChange={() => toggleColumn(c.id)}
                  >
                    {c.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden rounded-md border md:block">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.name ? <TableHead>Campaign Name</TableHead> : null}
                {visibleColumns.subject ? <TableHead>Subject Line</TableHead> : null}
                {visibleColumns.fromEmail ? <TableHead>Sender Email</TableHead> : null}
                {visibleColumns.status ? <TableHead>Status</TableHead> : null}
                {visibleColumns.audience ? <TableHead>Audience / Sent</TableHead> : null}
                {visibleColumns.scheduledAt ? <TableHead>Scheduled</TableHead> : null}
                {visibleColumns.createdAt ? <TableHead>Created</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* First White tbody Row for Inline Column Filtering */}
              {showColumnFilters ? (
                <TableRow className="bg-background hover:bg-background">
                  {visibleColumns.name ? (
                    <TableCell className="p-1">
                      <WorkspaceColumnFilter
                        label="Name"
                        value={columnFilters.name ?? ""}
                        onChange={(val: string) => onColumnFilterChange("name", val)}
                        onHide={() => setShowColumnFilters(false)}
                      />
                    </TableCell>
                  ) : null}
                  {visibleColumns.subject ? (
                    <TableCell className="p-1">
                      <WorkspaceColumnFilter
                        label="Subject"
                        value={columnFilters.subject ?? ""}
                        onChange={(val: string) => onColumnFilterChange("subject", val)}
                        onHide={() => setShowColumnFilters(false)}
                      />
                    </TableCell>
                  ) : null}
                  {visibleColumns.fromEmail ? (
                    <TableCell className="p-1">
                      <WorkspaceColumnFilter
                        label="Sender"
                        value={columnFilters.fromEmail ?? ""}
                        onChange={(val: string) => onColumnFilterChange("fromEmail", val)}
                        onHide={() => setShowColumnFilters(false)}
                      />
                    </TableCell>
                  ) : null}
                  {visibleColumns.status ? <TableCell className="p-1" /> : null}
                  {visibleColumns.audience ? <TableCell className="p-1" /> : null}
                  {visibleColumns.scheduledAt ? <TableCell className="p-1" /> : null}
                  {visibleColumns.createdAt ? <TableCell className="p-1" /> : null}
                </TableRow>
              ) : null}

              {items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={Object.values(visibleColumns).filter(Boolean).length}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    No email campaigns found.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow
                    key={row.uuid}
                    onClick={() => onSelectRecord(row)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    {visibleColumns.name ? (
                      <TableCell className="font-medium text-foreground">
                        {row.name}
                      </TableCell>
                    ) : null}
                    {visibleColumns.subject ? (
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {row.subject}
                      </TableCell>
                    ) : null}
                    {visibleColumns.fromEmail ? (
                      <TableCell className="text-muted-foreground">
                        {row.fromEmail}
                      </TableCell>
                    ) : null}
                    {visibleColumns.status ? (
                      <TableCell>
                        <WorkspaceStatusBadge
                          label={row.status.replace("_", " ")}
                          tone={statusTone(row.status)}
                        />
                      </TableCell>
                    ) : null}
                    {visibleColumns.audience ? (
                      <TableCell className="text-xs text-muted-foreground">
                        {row.sentCount} sent / {row.totalRecipients} total
                        {row.suppressedCount > 0 ? (
                          <span className="ml-1 text-amber-600">({row.suppressedCount} suppressed)</span>
                        ) : null}
                      </TableCell>
                    ) : null}
                    {visibleColumns.scheduledAt ? (
                      <TableCell className="text-xs text-muted-foreground">
                        {row.scheduledAt ? formatDateTime(row.scheduledAt) : "—"}
                      </TableCell>
                    ) : null}
                    {visibleColumns.createdAt ? (
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(row.createdAt)}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Responsive Cards */}
        <div className="space-y-3 md:hidden">
          {items.length === 0 ? (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              No email campaigns found.
            </div>
          ) : (
            items.map((row) => (
              <div
                key={row.uuid}
                onClick={() => onSelectRecord(row)}
                className="cursor-pointer space-y-2 rounded-md border p-4 hover:bg-muted/50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{row.name}</span>
                  <WorkspaceStatusBadge
                    label={row.status.replace("_", " ")}
                    tone={statusTone(row.status)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{row.subject}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>From: {row.fromEmail}</span>
                  <span>{row.sentCount}/{row.totalRecipients} sent</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <WorkspacePagination
          page={page}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[25, 50, 100]}
          showingLabel={buildShowingLabel(page, pageSize, totalCount)}
          singularLabel="email campaign"
          totalCount={totalCount}
          totalPages={totalPages}
          onNextPage={() => onPageChange(Math.min(totalPages, page + 1))}
          onPageChange={onPageChange}
          onPreviousPage={() => onPageChange(Math.max(1, page - 1))}
          onRowsPerPageChange={onPageSizeChange}
        />
      </div>
    </WorkspacePage>
  );
}
