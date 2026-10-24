export type BusinessTable = {
  table: string;
  sourceTable: string;
  group: "common" | "masters" | "billing";
  status: string;
  sourceRows: number;
  targetRows: number;
  imported: number;
  updated?: number;
  existing: number;
  warnings: number;
  blocked: boolean;
  message: string;
  verified: boolean;
  sourceChanged: boolean;
  references: Array<{ sourceField: string; targetField: string; parentTable: string }>;
};
export type BusinessReport = {
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
  status: string;
  phase: string;
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
export type BusinessRow = {
  reuse?: { targetId: number; before: Record<string, unknown>; sourceCount: number };
  sourceId: number;
  source: Record<string, unknown>;
  data: Record<string, unknown>;
  target: Record<string, unknown> | null;
  status: string;
  message: string;
};
export type BusinessInvoice = {
  table: string;
  sourceId: number;
  targetId: number | null;
  identity: string;
  status: string;
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
export type BusinessWarning = {
  group: string;
  table: string;
  sourceId: number | null;
  message: string;
};
export type ReportPage<T> = { total: number; rows: T[] };
export type InvoiceSelection = { table: string; sourceId: number };
