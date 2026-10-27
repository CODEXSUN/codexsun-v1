export function parseTenantModuleKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    if (value.startsWith("[") || value.startsWith("{")) return [];
    const keys = value.split(",").map((key) => key.trim());
    return keys.every((key) => /^[a-z0-9][a-z0-9.-]*$/u.test(key)) ? keys : [];
  }
}
