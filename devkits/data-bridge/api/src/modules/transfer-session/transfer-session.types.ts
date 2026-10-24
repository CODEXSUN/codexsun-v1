export type TransferField = {
  target: string;
  source: string | null;
  mode: "source" | "default" | "value" | "uuid" | "now";
  value: string | number | null;
};
export type TransferColumn = {
  name: string;
  type: string;
  required: boolean;
  generated: boolean;
  primary: boolean;
  parent: string | null;
};
export type TransferRow = {
  reuse?: { targetId: number; before: Record<string, unknown>; sourceCount: number };
  sourceId: number;
  source: Record<string, unknown>;
  data: Record<string, unknown>;
  target: Record<string, unknown> | null;
  status: "ready" | "existing" | "warning" | "imported";
  message: string;
};
export type TransferSession = {
  context?: {
    group: "common" | "masters" | "billing";
    targetTables: string[];
    businessRunId?: string;
  };
  selectedRows?: number;
  warningRows?: number;
  id: string;
  revision: number;
  stage: number;
  status: "draft" | "prepared" | "queued" | "completed" | "failed";
  sourceId: number;
  targetTenantId: number;
  sourceDatabase: string;
  targetDatabase: string;
  sourceTable: string;
  targetTable: string;
  fields: TransferField[];
  schemaHash: string;
  rows: TransferRow[];
  actor: string;
  updatedAt: string;
  message: string;
};

export type TransferParentMapping = {
  sourceTable: string;
  targetTable: string;
  fields: TransferField[];
};
