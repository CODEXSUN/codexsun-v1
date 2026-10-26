import { DutyReportOverview, type ReportOverviewState } from "./duty-report.overview";
import type { DutyReportDrilldown } from "./duty-report.types";
import { useReportOptions, useDutyReportPage } from "./duty-report.hooks";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { DutyReportList } from "./duty-report.list";
import { WorkspacePagination } from "@codexsun/ui/workspace/pagination";
import { buildShowingLabel } from "@codexsun/ui/workspace/utils";
import { listOwnDuties } from "../duty-assignment";
import { DutyReportForm } from "./duty-report.form";
import { createReport, updateReport, type DutyReport } from "./duty-report.services";

export function DutyReportWorkspace() {
  const [overview, setOverview] = useState<ReportOverviewState>({
    view: "sop",
    filters: { search: "", from: "", to: "" }
  });
  const client = useQueryClient();
  const [editing, setEditing] = useState<DutyReport | null | undefined>();
  const [drilldown, setDrilldown] = useState<DutyReportDrilldown | undefined>();
  const [groupLabel, setGroupLabel] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const options = useReportOptions();
  const query = useDutyReportPage(
    search,
    page,
    from,
    to,
    drilldown !== undefined ? options.data?.canViewAll : undefined,
    drilldown ?? {}
  );
  const duties = useQuery({
    queryKey: ["crm", "duties", "own"],
    queryFn: listOwnDuties,
    enabled: editing === null
  });
  const save = useMutation({
    mutationFn: (input: Parameters<typeof createReport>[0]) =>
      editing
        ? updateReport(editing.id, { performedDate: input.performedDate, actions: input.actions })
        : createReport(input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["crm", "duty-reports"] });
      setEditing(undefined);
    }
  });
  const canEdit =
    !!options.data?.canCreate && (!editing || editing.assigneeUserId === options.data.actorUserId);
  if (editing !== undefined)
    return (
      <DutyReportForm
        record={editing}
        duties={duties.data ?? []}
        readOnly={!canEdit}
        busy={save.isPending}
        error={save.error?.message ?? duties.error?.message ?? ""}
        onSave={(input) => save.mutate(input)}
        onClose={() => {
          setEditing(undefined);
          save.reset();
        }}
      />
    );
  if (drilldown === undefined)
    return (
      <DutyReportOverview
        initialState={overview}
        onStateChange={setOverview}
        enabled={options.data?.canViewAll === true}
        canCreate={!!options.data?.canCreate}
        error={options.error?.message ?? ""}
        onCreate={() => {
          save.reset();
          setEditing(null);
        }}
        onOpen={(filters, context) => {
          setDrilldown(filters);
          setSearch(context.search);
          setFrom(context.from);
          setTo(context.to);
          setGroupLabel(context.label);
          setPage(1);
        }}
      />
    );
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 100));
  return (
    <WorkspacePage
      title="Duty Reporting"
      variant="list"
      technicalName="page.crm.duty.reporting"
      actions={
        options.data?.canCreate ? (
          <Button
            onClick={() => {
              save.reset();
              setEditing(null);
            }}
          >
            <Plus className="size-4" />
            New report
          </Button>
        ) : null
      }
    >
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => setDrilldown(undefined)}>
          Back to summary
        </Button>
        <span className="text-sm text-muted-foreground">{groupLabel} - All tenant reports</span>
      </div>
      <WorkspaceFilters
        searchValue={search}
        onSearchValueChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search SOP, user, or actions"
        toolbarAction={
          <>
            <Input
              aria-label="From date"
              type="date"
              className="h-8 w-36"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
            <Input
              aria-label="To date"
              type="date"
              className="h-8 w-36"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              aria-label="Refresh duty reports"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              <RefreshCw className="size-4" />
            </Button>
          </>
        }
      />
      {query.error || options.error ? (
        <p role="alert" className="text-sm text-destructive">
          {(query.error ?? options.error)?.message}
        </p>
      ) : null}
      <DutyReportList
        items={query.data?.items ?? []}
        loading={query.isLoading || options.isLoading}

        onOpen={(row) => {
          save.reset();
          setEditing(row);
        }}
      />
      <WorkspacePagination
        page={page}
        rowsPerPage={100}
        rowsPerPageOptions={[100]}
        totalCount={total}
        totalPages={pages}
        singularLabel="report"
        showingLabel={buildShowingLabel(page, 100, total)}
        onPageChange={setPage}
        onNextPage={() => setPage(Math.min(pages, page + 1))}
        onPreviousPage={() => setPage(Math.max(1, page - 1))}
      />
    </WorkspacePage>
  );
}
