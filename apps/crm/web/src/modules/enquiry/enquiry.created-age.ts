export function enquiryCreatedAge(value: string, now = Date.now()) {
  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) return "—";
  const minutes = Math.max(0, Math.floor((now - created) / 60_000));
  if (minutes === 0) return "just now";
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${minutes % 60} m ago` : `${minutes} m ago`;
}
