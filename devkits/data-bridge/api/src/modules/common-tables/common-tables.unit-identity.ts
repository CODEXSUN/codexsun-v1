import type { Connection, RowDataPacket } from "mysql2/promise";
export async function prepareExistingUnit(
  database: Connection,
  data: Record<string, unknown>,
  columns: string[]
) {
  if (!columns.includes("name") || typeof data.name !== "string")
    return { changed: false, ambiguous: false };
  const [matches] = await database.query<RowDataPacket[]>(
    "SELECT * FROM core_units WHERE LOWER(TRIM(name))=LOWER(TRIM(?)) LIMIT 2",
    [data.name]
  );
  if (matches.length > 1) return { changed: false, ambiguous: true };
  const existing = matches[0];
  if (!existing) return { changed: false, ambiguous: false };
  let changed = data.name !== existing.name;
  data.name = existing.name;
  if (columns.includes("sort_order") && "sort_order" in existing) {
    changed = changed || String(data.sort_order) !== String(existing.sort_order);
    data.sort_order = existing.sort_order;
  }
  return { changed, ambiguous: false };
}
