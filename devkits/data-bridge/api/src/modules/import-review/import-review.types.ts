import type { FastifyRequest } from "fastify";
import type { Kysely } from "kysely";
import type { DataMigrationBridgeAccess } from "@codexsun/data-migration-api";
import type { MigrationTenant } from "@codexsun/data-migration-api";

import { commonTableNames } from "../common-tables/index.js";
import { coreMasterTableNames } from "../master-tables/index.js";
export { commonTableNames, coreMasterTableNames };
export const coreTableNames = [...commonTableNames, ...coreMasterTableNames] as const;
export type CommonTableName = (typeof coreTableNames)[number];
export type ImportScope = "common" | "masters";

export type ImportRowReport = {
  rowNumber: number;
  status: "ready" | "existing" | "conflict" | "inserted" | "warning" | "rolled_back";
  message: string;
};
export type ImportReport = {
  phase: "audit" | "complete" | "failed";
  at: string;
  actor: string;
  rows: ImportRowReport[];
};

export type CommonTableImportHost = {
  database: Kysely<unknown>;
  copyCompanyBranding?: (input: {
    sourceId: number;
    sourceDatabase: string;
    targetTenantId: number;
    sourceCompanyId: number;
    targetCompanyId: number;
    paths: Record<string, string>;
    actor: string;
  }) => Promise<{ copied: number; existing: number; warnings: string[] }>;
  copyUsers?: (input: { sourceId: number; targetTenantId: number; actor: string }) => Promise<{
    imported: number;
    existing: number;
    warnings: number;
    rows: Array<{
      sourceId: number;
      targetId: number | null;
      email: string;
      status: "imported" | "existing" | "warning";
      message: string;
    }>;
  }>;
  isCompanySeed?: (row: Record<string, unknown>) => boolean;
  authorize(request: FastifyRequest): Promise<string> | string;
  listTenants(): Promise<Array<{ id: number; label: string; database?: string }>>;
  resolveTenant(id: number): Promise<MigrationTenant>;
  dataMigration: DataMigrationBridgeAccess;
  enqueueBusiness?: (input: {
    runId: string;
    targetTenantId: number;
    actor: string;
    correlationId: string;
  }) => Promise<void>;
  enqueueTransfer?: (input: {
    runId: string;
    targetTenantId: number;
    actor: string;
    correlationId: string;
  }) => Promise<void>;
  enqueueBulk?: (input: {
    runId: string;
    targetTenantId: number;
    actor: string;
    correlationId: string;
  }) => Promise<void>;
};

export type CommonTableImportSummary = {
  id: string;
  sourceId: number;
  targetTenantId: number;
  table: CommonTableName;
  sourceDatabase: string;
  targetDatabase: string;
  rowCount: number;
  importedRows: number;
  skippedRows: number;
  status: "reviewed" | "imported" | "failed";
  updatedAt: string;
};

export type CommonTableOption = {
  table: CommonTableName;
  sourceRows: number | null;
  targetRows: number | null;
  sourceAvailable: boolean;
  targetAvailable: boolean;
  sourceColumns: string[];
  targetColumns: string[];
  missingTargetColumns: string[];
  missingRequiredColumns: string[];
  mismatchedColumns: string[];
  compatible: boolean;
  importStatus: CommonTableImportSummary["status"] | null;
};
