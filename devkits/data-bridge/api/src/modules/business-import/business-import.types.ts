import type { TransferField } from "../transfer-session/index.js";
export type BusinessGroup = "common" | "masters" | "billing";
export type BusinessTable = {
  table: string;
  sourceTable: string;
  group: BusinessGroup;
  status: "pending" | "running" | "success" | "warning" | "skipped";
  sourceRows: number;
  targetRows: number;
  imported: number;
  updated?: number;
  existing: number;
  warnings: number;
  cursor: number;
  upperId: number;
  sessions: string[];
  activeSession: string | null;
  warningIds: number[];
  blocked: boolean;
  message: string;
  references: Array<{ sourceField: string; targetField: string; parentTable: string }>;
  fields: TransferField[];
  schemaHash: string;
  sourceHash: string;
  verified: boolean;
  sourceChanged: boolean;
  verificationIssues: Array<{ sourceId: number; message: string }>;
};
export type BusinessRun = {
  users?: {
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
  };
  id: string;
  sourceId: number;
  targetTenantId: number;
  sourceDatabase: string;
  targetDatabase: string;
  actor: string;
  status: "queued" | "running" | "success" | "warning" | "failed";
  phase: "common" | "masters" | "billing" | "invoices" | "users" | "complete";
  at: string;
  updatedAt: string;
  message: string;
  issues: string[];
  tables: BusinessTable[];
  invoiceCount: number;
  invoiceMatched: number;
  invoiceWarnings: number;
  relationships: number;
  orphans: number;
};
export type BusinessSummary = Omit<BusinessRun, "tables"> & {
  tables: Array<
    Omit<
      BusinessTable,
      "fields" | "schemaHash" | "sourceHash" | "warningIds" | "cursor" | "upperId" | "activeSession"
    >
  >;
};
export type InvoiceVerification = {
  table: string;
  sourceId: number;
  targetId: number | null;
  identity: string;
  status: "success" | "warning";
  deleted: boolean;
  message: string;
  children: Array<{
    table: string;
    sourceIds: number[];
    sourceRows: number;
    targetRows: number;
    matched: number;
    differences: number;
    extra: number;
    message: string;
  }>;
};
export type BusinessProgress = (value: Record<string, unknown>) => Promise<void>;
export function businessSummary(run: BusinessRun): BusinessSummary {
  return {
    ...run,
    tables: run.tables.map(
      ({
        fields: _fields,
        schemaHash: _schema,
        sourceHash: _hash,
        warningIds: _warnings,
        cursor: _cursor,
        upperId: _upper,
        activeSession: _active,
        ...entry
      }) => entry
    )
  };
}
