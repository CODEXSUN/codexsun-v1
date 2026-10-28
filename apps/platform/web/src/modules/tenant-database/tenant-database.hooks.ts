import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tenantMaintenanceNote } from "./tenant-database.schema";
import {
  downloadTenantBackup,
  getTenantBackupFiles,
  getTenantRestoreRun,
  getTenantDatabaseDetails,
  listTenantDatabaseStatus,
  migrateTenantDatabase,
  reinstallTenantDatabase,
  requestTenantDatabaseBackup,
  requestTenantDatabaseRestore,
  setupTenantDatabase,
  uploadTenantBackup
} from "./tenant-database.services";
import type { TenantBackupFile } from "./tenant-database.types";

export const tenantDatabaseQueryKey = ["admin", "database", "tenants"] as const;

export function useTenantBackupFilesQuery(tenantId: number | null) {
  return useQuery({
    enabled: tenantId !== null,
    queryFn: () => getTenantBackupFiles(tenantId ?? 0),
    queryKey: [...tenantDatabaseQueryKey, tenantId, "backups"],
    refetchInterval: 5_000
  });
}

export function useTenantRestoreRunQuery(tenantId: number, runId: number | null) {
  return useQuery({
    enabled: runId !== null,
    queryFn: () => getTenantRestoreRun(tenantId, runId ?? 0),
    queryKey: [...tenantDatabaseQueryKey, tenantId, "restores", runId],
    refetchInterval: (query) =>
      query.state.data?.status === "completed" || query.state.data?.status === "failed"
        ? false
        : 2_000
  });
}

export function useTenantBackupMutations(tenantId: number) {
  const client = useQueryClient();
  const done = () => void client.invalidateQueries({ queryKey: tenantDatabaseQueryKey });
  return {
    backup: useMutation({
      mutationFn: () =>
        requestTenantDatabaseBackup(tenantId, tenantMaintenanceNote(tenantId, "Tenant backup")),
      onSuccess: done
    }),
    upload: useMutation({
      mutationFn: (file: File) => uploadTenantBackup(tenantId, file),
      onSuccess: done
    }),
    download: useMutation({
      mutationFn: (file: TenantBackupFile) => downloadTenantBackup(tenantId, file)
    }),
    restore: useMutation({
      mutationFn: (input: { backupRunId: number; sandboxMode: "fresh" | "append" }) =>
        requestTenantDatabaseRestore(tenantId, input),
      onSuccess: done
    })
  };
}

export function useTenantDatabaseQuery() {
  return useQuery({
    queryFn: listTenantDatabaseStatus,
    queryKey: tenantDatabaseQueryKey,
    meta: { suppressGlobalLoader: true },
    refetchInterval: 15_000
  });
}

export function useTenantDatabaseDetailsQuery(
  tenantId: number | null,
  mode: "automatic" | "manual" = "automatic",
  watch = false
) {
  return useQuery({
    enabled: (mode === "automatic" || watch) && tenantId !== null,
    queryFn: () => getTenantDatabaseDetails(tenantId ?? 0),
    queryKey: [...tenantDatabaseQueryKey, tenantId, "details"],
    meta: { suppressGlobalLoader: true },
    refetchInterval: watch ? 5_000 : mode === "automatic" ? 15_000 : false,
    retry: mode === "automatic" ? 3 : false
  });
}

export function useTenantDatabaseMutations() {
  const client = useQueryClient();
  const done = () => {
    void client.invalidateQueries({ queryKey: tenantDatabaseQueryKey });
  };
  return {
    backup: useMutation({
      mutationFn: (tenantId: number) =>
        requestTenantDatabaseBackup(tenantId, tenantMaintenanceNote(tenantId, "Tenant backup")),
      onSuccess: done
    }),
    migrate: useMutation({
      mutationFn: (tenantId: number) =>
        migrateTenantDatabase(tenantId, tenantMaintenanceNote(tenantId, "Tenant migration")),
      onSuccess: done
    }),
    reinstall: useMutation({
      mutationFn: (tenantId: number) =>
        reinstallTenantDatabase(
          tenantId,
          tenantMaintenanceNote(tenantId, "Tenant database re-install")
        ),
      onSuccess: done
    }),
    setup: useMutation({
      mutationFn: (tenantId: number) =>
        setupTenantDatabase(tenantId, tenantMaintenanceNote(tenantId, "Tenant database setup")),
      onSuccess: done
    })
  };
}
