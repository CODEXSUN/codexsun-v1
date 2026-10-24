import * as React from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  Lock,
  RefreshCw,
  UserCheck,
  Users,
  XCircle,
  Zap
} from "lucide-react";
import { Badge } from "@codexsun/ui/components/badge";
import { Button } from "@codexsun/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@codexsun/ui/components/card";
import { Progress } from "@codexsun/ui/components/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@codexsun/ui/components/table";
import type { AssignmentItem, PathLeaseItem } from "./orchestration.types.js";

export type { AssignmentItem, PathLeaseItem };

export interface SupervisorDashboardProps {
  runUuid?: string | undefined;
  assignments?: AssignmentItem[] | undefined;
  leases?: PathLeaseItem[] | undefined;
  maxConcurrency?: number | undefined;
  isLoading?: boolean | undefined;
  onRefresh?: (() => void) | undefined;
  onDispatch?:
    | ((req: {
        task_id: string;
        worker_id: string;
        allowed_paths: string[];
        dependencies?: string[];
      }) => void)
    | undefined;
  onHeartbeat?: ((uuid: string) => void) | undefined;
  onCancel?: ((uuid: string) => void) | undefined;
  className?: string | undefined;
}

export function SupervisorDashboard({
  runUuid,
  assignments = [],
  leases = [],
  maxConcurrency = 2,
  isLoading = false,
  onRefresh,
  onDispatch: _onDispatch,
  onHeartbeat,
  onCancel,
  className = ""
}: SupervisorDashboardProps) {
  const [filter, setFilter] = React.useState<"all" | "active" | "completed" | "failed">("all");
  const [now, setNow] = React.useState<number>(Date.now());

  // Update clock every second for live lease expiry countdowns
  React.useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeAssignments = React.useMemo(
    () => assignments.filter((a) => a.state === "active" || a.state === "assigned"),
    [assignments]
  );
  const completedAssignments = React.useMemo(
    () => assignments.filter((a) => a.state === "completed"),
    [assignments]
  );
  const failedAssignments = React.useMemo(
    () =>
      assignments.filter(
        (a) => a.state === "failed" || a.state === "expired" || a.state === "cancelled"
      ),
    [assignments]
  );

  const activeCount = activeAssignments.length;
  const concurrencyPercent = Math.min(100, Math.round((activeCount / maxConcurrency) * 100));

  const filteredAssignments = React.useMemo(() => {
    switch (filter) {
      case "active":
        return activeAssignments;
      case "completed":
        return completedAssignments;
      case "failed":
        return failedAssignments;
      default:
        return assignments;
    }
  }, [assignments, activeAssignments, completedAssignments, failedAssignments, filter]);

  const getSecondsRemaining = (expiryIso: string): number => {
    const expiryTime = new Date(expiryIso).getTime();
    return Math.max(0, Math.round((expiryTime - now) / 1000));
  };

  const renderStateBadge = (state: AssignmentItem["state"]) => {
    switch (state) {
      case "active":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
            role="status"
            aria-label="Active Worker"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            Active
          </Badge>
        );
      case "assigned":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            role="status"
            aria-label="Assigned Worker"
          >
            <Clock className="size-3" />
            Assigned
          </Badge>
        );
      case "completed":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            role="status"
            aria-label="Completed Task"
          >
            <CheckCircle2 className="size-3" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge
            variant="destructive"
            className="gap-1 shadow-none"
            role="status"
            aria-label="Failed Task"
          >
            <XCircle className="size-3" />
            Failed
          </Badge>
        );
      case "expired":
        return (
          <Badge
            variant="destructive"
            className="gap-1 bg-amber-600 text-white shadow-none"
            role="status"
            aria-label="Expired Lease"
          >
            <Clock className="size-3" />
            Expired
          </Badge>
        );
      case "cancelled":
        return (
          <Badge
            variant="secondary"
            className="gap-1"
            role="status"
            aria-label="Cancelled Assignment"
          >
            <AlertTriangle className="size-3" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{state}</Badge>;
    }
  };

  const getDependencyStatus = (depTaskId: string) => {
    const dep = assignments.find((a) => a.task_id === depTaskId);
    if (!dep) {
      return { status: "missing", label: "Unrecorded", variant: "destructive" as const };
    }
    if (dep.state === "completed") {
      return { status: "satisfied", label: "Satisfied", variant: "outline" as const, ok: true };
    }
    if (dep.state === "active" || dep.state === "assigned") {
      return { status: "running", label: "In Progress", variant: "secondary" as const };
    }
    return { status: "unsatisfied", label: dep.state, variant: "destructive" as const };
  };

  return (
    <div
      className={`space-y-6 p-4 sm:p-6 ${className}`}
      role="region"
      aria-label="Supervisor and Worker Orchestration Dashboard"
    >
      {/* Top Header & Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="size-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Supervisor & Worker Orchestration
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Bounded parallel workers, disjoint path leases, dependency gates, and live heartbeats
            {runUuid ? ` for run ${runUuid}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="gap-2"
              aria-label="Refresh Dashboard"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Metrics & Concurrency Meter Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Concurrency Meter Card */}
        <Card className="col-span-1 sm:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="size-4 text-blue-500" />
                Worker Concurrency Meter
              </CardTitle>
              <Badge
                variant={activeCount >= maxConcurrency ? "destructive" : "outline"}
                className={
                  activeCount < maxConcurrency
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : ""
                }
              >
                {activeCount >= maxConcurrency ? "At Concurrency Bound" : "Capacity Available"}
              </Badge>
            </div>
            <CardDescription>
              DEC-07 bounded limit: maximum {maxConcurrency} concurrent implementation workers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold text-2xl">
                {activeCount}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / {maxConcurrency} Active
                </span>
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {concurrencyPercent}% bound
              </span>
            </div>
            <Progress
              value={concurrencyPercent}
              className="h-2.5"
              aria-label="Concurrency Limit Progress"
              aria-valuenow={activeCount}
              aria-valuemin={0}
              aria-valuemax={maxConcurrency}
            />
          </CardContent>
        </Card>

        {/* Total Tasks Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="size-4 text-amber-500" />
              Completed Tasks
            </CardTitle>
            <CardDescription>Finished assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {completedAssignments.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {assignments.length} total dispatched
            </p>
          </CardContent>
        </Card>

        {/* Active Path Locks Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lock className="size-4 text-indigo-500" />
              Disjoint Path Locks
            </CardTitle>
            <CardDescription>Active exclusive leases</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {leases.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Non-overlapping workspace locks</p>
          </CardContent>
        </Card>
      </div>

      {/* Path Lease Locks Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Lock className="size-4 text-indigo-500" />
                Active Path Leases & Conflict Locks
              </CardTitle>
              <CardDescription>
                Disjoint path grants held by active implementation workers
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {leases.length} Leased
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {leases.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No active path leases currently held. All workspace paths are free for dispatch.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path Pattern</TableHead>
                  <TableHead>Worker</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Lock Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leases.map((lease, index) => {
                  const secRemaining = getSecondsRemaining(lease.lease_expiry);
                  return (
                    <TableRow key={`${lease.assignment_uuid}-${lease.path_pattern}-${index}`}>
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {lease.path_pattern}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{lease.worker_id}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {lease.task_id}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs font-mono flex items-center gap-1 ${
                            secRemaining <= 5
                              ? "text-red-500 font-bold"
                              : secRemaining <= 10
                                ? "text-amber-500"
                                : "text-muted-foreground"
                          }`}
                        >
                          <Clock className="size-3" />
                          {secRemaining}s remaining
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 gap-1 text-xs"
                        >
                          <Lock className="size-3" />
                          Exclusive
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Worker Assignments Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Cpu className="size-4 text-primary" />
                Worker Assignments Ledger
              </CardTitle>
              <CardDescription>
                Inspection view for parallel tasks, prerequisites, and live heartbeats
              </CardDescription>
            </div>
            {/* Filter buttons */}
            <div className="flex items-center gap-1 rounded-md border p-1 text-xs">
              <button
                type="button"
                className={`px-2.5 py-1 rounded-sm transition-colors ${
                  filter === "all"
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFilter("all")}
              >
                All ({assignments.length})
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-sm transition-colors ${
                  filter === "active"
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFilter("active")}
              >
                Active ({activeAssignments.length})
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-sm transition-colors ${
                  filter === "completed"
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFilter("completed")}
              >
                Completed ({completedAssignments.length})
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-sm transition-colors ${
                  filter === "failed"
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFilter("failed")}
              >
                Failed/Cancelled ({failedAssignments.length})
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAssignments.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No assignments found matching filter.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAssignments.map((assignment) => {
                const secRemaining = getSecondsRemaining(assignment.lease_expiry);
                const isExpiring = assignment.state === "active" && secRemaining <= 10;

                return (
                  <div
                    key={assignment.uuid}
                    className="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base">{assignment.task_id}</span>
                        <span className="text-xs font-mono text-muted-foreground">
                          ({assignment.uuid})
                        </span>
                        {renderStateBadge(assignment.state)}
                        <span className="text-xs text-muted-foreground font-mono">
                          Attempt #{assignment.attempt}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-1 font-mono text-muted-foreground">
                          <UserCheck className="size-3.5" />
                          {assignment.worker_id}
                        </span>
                        {onHeartbeat && assignment.state === "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => onHeartbeat(assignment.uuid)}
                            aria-label={`Renew heartbeat for ${assignment.task_id}`}
                          >
                            <Activity className="size-3 text-emerald-500" />
                            Heartbeat
                          </Button>
                        )}
                        {onCancel && assignment.state === "active" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onCancel(assignment.uuid)}
                            aria-label={`Cancel ${assignment.task_id}`}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Dependencies Badges */}
                    {assignment.dependencies.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground font-medium">Prerequisites:</span>
                        {assignment.dependencies.map((depId) => {
                          const depInfo = getDependencyStatus(depId);
                          return (
                            <Badge
                              key={depId}
                              variant={depInfo.variant}
                              className={`gap-1 text-xs font-mono ${
                                depInfo.ok
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : ""
                              }`}
                            >
                              {depInfo.ok ? (
                                <CheckCircle2 className="size-3 text-emerald-500" />
                              ) : (
                                <Clock className="size-3" />
                              )}
                              {depId}: {depInfo.label}
                            </Badge>
                          );
                        })}
                      </div>
                    )}

                    {/* Leased Paths */}
                    <div className="flex flex-wrap items-center gap-1 text-xs">
                      <span className="text-muted-foreground font-medium">Allowed Paths:</span>
                      {assignment.allowed_paths.map((p) => (
                        <span
                          key={p}
                          className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"
                        >
                          {p}
                        </span>
                      ))}
                    </div>

                    {/* Heartbeat & Lease Status */}
                    {assignment.state === "active" && (
                      <div className="flex items-center justify-between border-t pt-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Activity className="size-3.5 text-blue-500 animate-pulse" />
                          <span className="text-muted-foreground">
                            Live Heartbeat: Lease expires in{" "}
                            <span
                              className={`font-mono font-semibold ${
                                isExpiring ? "text-red-500 font-bold" : "text-foreground"
                              }`}
                            >
                              {secRemaining}s
                            </span>
                          </span>
                        </div>
                        <span className="text-muted-foreground font-mono">
                          Gen: {assignment.lease_generation}
                        </span>
                      </div>
                    )}

                    {/* Error payload if failed */}
                    {assignment.error_payload && (
                      <div className="rounded bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400 border border-red-500/20">
                        <span className="font-semibold">Error: </span>
                        {String(
                          (assignment.error_payload as Record<string, unknown>).message ??
                            JSON.stringify(assignment.error_payload)
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
