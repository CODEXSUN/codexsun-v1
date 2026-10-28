import type { DatabaseMaintenanceRun, DatabaseOperation } from "./tenant-database.types";

export type WatchedDatabaseOperation = {
  afterId: number;
  operation: DatabaseOperation;
};

export function watchedDatabaseRun(
  runs: DatabaseMaintenanceRun[],
  watch: WatchedDatabaseOperation
) {
  return runs.find((run) => run.id > watch.afterId && run.operation === watch.operation);
}

export function runningTenantDatabaseRun(runs: DatabaseMaintenanceRun[]) {
  return runs.find(
    (run) => ["setup", "reinstall", "migrate"].includes(run.operation) && run.status === "running"
  );
}
