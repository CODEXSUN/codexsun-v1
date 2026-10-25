export type LegacyRecord = Record<string, string | number | null>;
export type LegacyPhase = "core" | "masters" | "billing";
export type LegacyPrepared = {
  phase: LegacyPhase;
  sourceTable: string;
  sourceKey: string;
  targetTable: string;
  source: LegacyRecord;
  data: LegacyRecord;
  issues: string[];
  stageId: number | null;
  targetId: number | null;
};
export type LegacyReference = { field: string; row: LegacyPrepared | undefined };
export type LegacyMapping = {
  phase: LegacyPhase;
  sourceTable: string;
  sourceKey: string;
  targetTable: string;
  columns: Record<string, string>;
};
