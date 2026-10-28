import { submissionSchema } from "./submission.schema";
import type { SubmissionInput } from "./submission.types";

export const importFields = [
  "captureUuid",
  "sourceKey",
  "name",
  "email",
  "phone",
  "message",
  "privacyConsent",
  "sourceReference",
  "sourceConsentAt",
  "sourceNoticeVersion"
] as const;
export type ImportField = (typeof importFields)[number];
export type ImportMapping = Record<ImportField, string>;
export type ImportSource = { columns: string[]; rows: Record<string, unknown>[] };

export function readImport(text: string, csv: boolean): ImportSource {
  const rows: unknown = csv ? readCsv(text) : JSON.parse(text);
  if (
    !Array.isArray(rows) ||
    !rows.length ||
    rows.length > 100 ||
    rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))
  ) {
    throw new Error("The file must contain 1 to 100 records.");
  }
  const records = rows as Record<string, unknown>[];
  const columns = [...new Set(records.flatMap((row) => Object.keys(row)))];
  return { columns, rows: records };
}

export function mapImport(source: ImportSource, mapping: ImportMapping): SubmissionInput[] {
  const selected = Object.values(mapping).filter(Boolean);
  if (new Set(selected).size !== selected.length)
    throw new Error("Map each source column only once.");
  const rows = source.rows.map((row, index) => {
    const input: Record<string, unknown> = {};
    for (const field of importFields) {
      const column = mapping[field];
      if (column) input[field] = row[column];
    }
    for (const field of ["email", "phone", "message"] as const) input[field] ??= "";
    if (typeof input.privacyConsent === "string") {
      const value = input.privacyConsent.trim().toLowerCase();
      input.privacyConsent = value === "true" ? true : value === "false" ? false : value;
    }
    const result = submissionSchema.safeParse(input);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new Error(
        `Row ${index + 1}: ${issue?.path.join(".") || "record"} ${issue?.message || "is invalid"}`
      );
    }
    return result.data;
  });
  const keys = rows.map((row) => `${row.captureUuid}:${row.sourceKey}`);
  if (new Set(keys).size !== keys.length)
    throw new Error("Duplicate capture and source keys in the file.");
  return rows;
}

function readCsv(text: string): Record<string, string>[] {
  const records: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false,
    closed = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else value += char;
    } else if (char === '"' && !value && !closed) quoted = true;
    else if (char === "," || char === "\n" || char === "\r") {
      row.push(value);
      value = "";
      closed = false;
      if (char !== ",") {
        if (char === "\r" && input[i + 1] === "\n") i++;
        records.push(row);
        row = [];
      }
    } else if (closed || char === '"') throw new Error("Invalid CSV quote.");
    else value += char;
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  if (row.length || value || closed) {
    row.push(value);
    records.push(row);
  }
  const headers = records.shift()?.map((header) => header.trim()) ?? [];
  if (
    !headers.length ||
    headers.some((header) => !header) ||
    new Set(headers).size !== headers.length
  )
    throw new Error("CSV headers must be present and unique.");
  return records.map((cells, index) => {
    if (cells.length !== headers.length)
      throw new Error(`CSV row ${index + 2} has the wrong number of columns.`);
    return Object.fromEntries(headers.map((header, column) => [header, cells[column]!]));
  });
}
