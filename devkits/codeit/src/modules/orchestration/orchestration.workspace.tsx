/**
 * Codeit Orchestration Workspace Component
 *
 * Supervisor control plane for managing concurrent worker execution,
 * path leases, dependency tracking, and integration progress.
 */

import { useCallback, useEffect, useState } from "react";
import { AlertCircleIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Card, CardContent } from "@codexsun/ui/components/card";
import { OrchestrationService } from "./orchestration.services";
import type {
  AssignmentItem,
  OrchestrationWorkspaceProps,
  PathLeaseItem
} from "./orchestration.types";
import { SupervisorDashboard } from "./supervisor-dashboard";

const service = new OrchestrationService();

export function OrchestrationWorkspace({ runUuid, className = "" }: OrchestrationWorkspaceProps) {
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [leases, setLeases] = useState<PathLeaseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const activeLeases = await service.getActiveLeases(runUuid);
      setLeases(activeLeases);

      if (runUuid) {
        const runAssignments = await service.getAssignments(runUuid);
        setAssignments(runAssignments);
      } else {
        setAssignments([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load orchestration status";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [runUuid]);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => {
      void loadData();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleCancelAssignment = async (uuid: string) => {
    const target = assignments.find((a) => a.uuid === uuid);
    if (!target) return;
    try {
      await service.failAssignment(uuid, target.worker_id, "Manually cancelled by supervisor");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancellation failed");
    }
  };

  const handleHeartbeat = async (uuid: string) => {
    const target = assignments.find((a) => a.uuid === uuid);
    if (!target) return;
    try {
      await service.sendHeartbeat(uuid, { worker_id: target.worker_id });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Heartbeat failed");
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Workspace Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <ShieldCheckIcon className="size-5 text-primary" />
            Supervisor Orchestration Plane
          </h2>
          <p className="text-sm text-muted-foreground">
            Multi-worker coordination, disjoint path lease enforcement, and dependency validation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCwIcon className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="flex items-center gap-2 p-3 text-sm text-destructive">
            <AlertCircleIcon className="size-4 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Live Supervisor Dashboard */}
      <SupervisorDashboard
        runUuid={runUuid}
        assignments={assignments}
        leases={leases}
        maxConcurrency={2}
        isLoading={isLoading}
        onRefresh={() => void loadData()}
        onCancel={handleCancelAssignment}
        onHeartbeat={handleHeartbeat}
      />
    </div>
  );
}
