import { useEffect, useState } from "react";
import { DatabaseIcon, DownloadIcon, RefreshCwIcon, RotateCcwIcon, WrenchIcon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@codexsun/ui/components/alert-dialog";
import { Button } from "@codexsun/ui/components/button";
import { GlobalLoader } from "@codexsun/ui/components/global-loader";
import { Spinner } from "@codexsun/ui/components/spinner";
import { WorkspaceDetailTable, WorkspaceShowCard } from "@codexsun/ui/workspace/show";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { useTenantDatabaseDetailsQuery, useTenantDatabaseMutations } from "./tenant-database.hooks";
import {
  runningTenantDatabaseRun,
  watchedDatabaseRun,
  type WatchedDatabaseOperation
} from "./tenant-database.watch";

export function TenantDatabaseControl({ tenantId }: { tenantId: number }) {
  const [confirmReinstall, setConfirmReinstall] = useState(false);
  const [checking, setChecking] = useState(false);
  const [watch, setWatch] = useState<WatchedDatabaseOperation | null>(null);
  const details = useTenantDatabaseDetailsQuery(tenantId, "manual", watch !== null);
  const mutations = useTenantDatabaseMutations();
  const busy =
    checking || watch !== null || Object.values(mutations).some((mutation) => mutation.isPending);
  const database = details.data;
  const watchedRun = watch && database ? watchedDatabaseRun(database.runs, watch) : undefined;
  const setupPending =
    mutations.setup.isPending ||
    (watchedRun?.operation === "setup" && watchedRun.status === "running");
  const reinstallPending =
    mutations.reinstall.isPending ||
    (watchedRun?.operation === "reinstall" && watchedRun.status === "running");

  useEffect(() => {
    if (!watchedRun || (watchedRun.status !== "completed" && watchedRun.status !== "failed"))
      return;
    setWatch(null);
    if (watchedRun.status === "completed") toast.success("Tenant database operation completed");
    else
      toast.error("Tenant database operation failed", {
        description:
          typeof watchedRun.details.error === "string"
            ? watchedRun.details.error
            : "Check the recent database runs."
      });
  }, [watchedRun]);

  const startOperation = async (operation: "setup" | "reinstall" | "migrate") => {
    setChecking(true);
    const current = await details.refetch();
    setChecking(false);
    if (!current.data) {
      showError("Could not check database operations", current.error);
      return;
    }
    const running = runningTenantDatabaseRun(current.data.runs);
    if (running) {
      setWatch({ afterId: running.id - 1, operation: running.operation });
      toast.info("A tenant database operation is already running");
      return;
    }
    const afterId = Math.max(0, ...current.data.runs.map((run) => run.id));
    setWatch({ afterId, operation });
    mutations[operation].mutate(tenantId, {
      onError: async (error) => {
        const result = await details.refetch();
        if (!result.data) {
          toast.error("Could not check the database operation", {
            description:
              "The request ended, but the operation status is unknown. Check the recent runs before retrying."
          });
          return;
        }
        if (!watchedDatabaseRun(result.data.runs, { afterId, operation })) {
          setWatch(null);
          showError("Database operation failed", error);
        }
      },
      onSuccess: () => void details.refetch()
    });
  };

  const runSetup = () => {
    void startOperation("setup");
  };

  const runReinstall = () => {
    setConfirmReinstall(false);
    void startOperation("reinstall");
  };

  const runMaintenance = (operation: "backup" | "migrate") => {
    if (operation === "migrate") {
      void startOperation("migrate");
      return;
    }
    const mutation = mutations[operation];
    mutation.mutate(tenantId, {
      onError: (error) => showError(`Database ${operation} failed`, error),
      onSuccess: () => {
        toast.success(
          operation === "backup" ? "Database backup requested" : "Tenant migrations applied"
        );
        void details.refetch();
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <DatabaseIcon className="size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Tenant database connection</p>
            <p className="text-xs text-muted-foreground">
              Live status is verified directly against the configured database server.
            </p>
          </div>
          {database ? (
            <WorkspaceStatusBadge
              label={database.status === "online" ? "Live" : "Offline"}
              tone={database.status === "online" ? "success" : "danger"}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={details.isFetching || busy}
            onClick={() => void details.refetch()}
          >
            <RefreshCwIcon className={`size-4 ${details.isFetching ? "animate-spin" : ""}`} />
            {details.isFetched ? "Refresh" : "Check connection"}
          </Button>
          <Button type="button" aria-busy={setupPending} disabled={busy} onClick={runSetup}>
            {setupPending ? (
              <Spinner aria-label="Setting up tenant database" />
            ) : (
              <WrenchIcon className="size-4" />
            )}
            {setupPending ? "Setting up..." : "New setup"}
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-busy={reinstallPending}
            disabled={busy}
            onClick={() => setConfirmReinstall(true)}
          >
            {reinstallPending ? (
              <Spinner aria-label="Re-installing tenant database" />
            ) : (
              <RotateCcwIcon className="size-4" />
            )}
            {reinstallPending ? "Re-installing..." : "Re-install"}
          </Button>
        </div>
      </div>

      {watch ? (
        <p role="status" className="text-sm text-muted-foreground">
          {watchedRun
            ? `${watchedRun.operation}: ${watchedRun.status}. `
            : "Starting database operation. "}
          Watching the migration and seed status; this can take several minutes.
        </p>
      ) : null}

      {details.isLoading && !database ? (
        <GlobalLoader className="min-h-40" fullScreen={false} />
      ) : null}
      {!details.isFetched && !details.isFetching ? (
        <WorkspaceShowCard title="Connection not checked">
          <p className="px-4 py-3 text-sm text-muted-foreground">
            Database access is manual. Check the connection to inspect an existing database, or
            choose New setup to install it.
          </p>
        </WorkspaceShowCard>
      ) : null}
      {details.isError ? (
        <WorkspaceShowCard title="Database unavailable">
          <p className="px-4 py-3 text-sm text-destructive">
            {details.error instanceof Error ? details.error.message : "Could not inspect database."}
          </p>
        </WorkspaceShowCard>
      ) : null}
      {database?.connectionMessage ? (
        <WorkspaceShowCard title="Connection unavailable">
          <p className="px-4 py-3 text-sm text-destructive">{database.connectionMessage}</p>
        </WorkspaceShowCard>
      ) : null}
      {database ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <WorkspaceShowCard title="Live connection">
            <WorkspaceDetailTable
              rows={[
                ["Status", database.status === "online" ? "Live connected" : "Offline"],
                ["Connection result", database.connectionMessage ?? "Connected"],
                ["Database", database.databaseName],
                ["Host", database.host],
                ["Port", database.port],
                ["Server version", database.version],
                ["Tables", database.tableCount]
              ]}
            />
          </WorkspaceShowCard>
          <WorkspaceShowCard title="Setup state">
            <WorkspaceDetailTable
              rows={[
                ["Applied migrations", database.migrations.length],
                ["Pending migrations", database.migrationPlan.pending.length],
                ["Migration version", database.migrationPlan.latestApplied?.version ?? "None"],
                ["Latest migration", database.migrationPlan.latestApplied?.name ?? "None"],
                ["Maintenance runs", database.runs.length],
                ["Last operation", database.runs[0]?.operation ?? "None"],
                ["Last result", database.runs[0]?.status ?? "None"]
              ]}
            />
          </WorkspaceShowCard>
          <WorkspaceShowCard title="Maintenance controls">
            <div className="flex flex-wrap gap-2 p-4">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => runMaintenance("migrate")}
              >
                <WrenchIcon className="size-4" />
                Safe migrate
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => runMaintenance("backup")}
              >
                <DownloadIcon className="size-4" />
                Backup
              </Button>
              <p className="text-sm text-muted-foreground">
                Use Super Admin → Database → Tenant Databases to select a backup file and restore it
                to a sandbox.
              </p>
            </div>
          </WorkspaceShowCard>
          <WorkspaceShowCard title="Recent database runs">
            <div className="divide-y divide-border/60">
              {database.runs.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">No maintenance runs yet.</p>
              ) : null}
              {database.runs.slice(0, 5).map((run) => (
                <div className="flex items-center justify-between gap-3 px-4 py-3" key={run.id}>
                  <div>
                    <p className="text-sm font-medium capitalize">{run.operation}</p>
                    <p className="text-xs text-muted-foreground">{run.createdAt}</p>
                  </div>
                  <WorkspaceStatusBadge
                    label={run.status}
                    tone={
                      run.status === "completed"
                        ? "success"
                        : run.status === "failed"
                          ? "danger"
                          : "warning"
                    }
                  />
                </div>
              ))}
            </div>
          </WorkspaceShowCard>
        </div>
      ) : null}

      <AlertDialog open={confirmReinstall} onOpenChange={setConfirmReinstall}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-install tenant database?</AlertDialogTitle>
            <AlertDialogDescription>
              This safely reapplies tenant migrations and repeatable seeds. Existing business
              records are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runReinstall}>Re-install</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function showError(title: string, error: unknown) {
  toast.error(title, {
    description:
      error instanceof Error ? error.message : "The database operation could not complete."
  });
}
