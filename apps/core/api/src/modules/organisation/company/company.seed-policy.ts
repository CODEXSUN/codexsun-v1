export function isUntouchedCompanySeed(row: Record<string, unknown>) {
  if (
    Number(row.seed_placeholder) !== 1 ||
    row.name !== "codexsun" ||
    row.code !== "CODEXSUN" ||
    row.status !== "active"
  )
    return false;
  const excluded = new Set([
    "id",
    "uuid",
    "created_by",
    "created_at",
    "updated_at",
    "seed_placeholder",
    "name",
    "code",
    "status"
  ]);
  return Object.entries(row).every(
    ([key, value]) =>
      excluded.has(key) ||
      value === null ||
      value === "" ||
      value === 0 ||
      value === false ||
      value === "[]" ||
      (Array.isArray(value) && value.length === 0)
  );
}
