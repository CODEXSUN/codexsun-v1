export function diffForHumans(value: string, now = Date.now()) {
  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) return "—";
  const seconds = Math.floor(Math.abs(now - created) / 1_000);
  if (seconds === 0) return "just now";
  const units = [
    [31_536_000, "year"],
    [2_592_000, "month"],
    [604_800, "week"],
    [86_400, "day"],
    [3_600, "hour"],
    [60, "minute"],
    [1, "second"]
  ] as const;
  const [duration, unit] = units.find(([duration]) => seconds >= duration)!;
  const count = Math.floor(seconds / duration);
  return `${count} ${unit}${count === 1 ? "" : "s"} ${created > now ? "from now" : "ago"}`;
}

export function compactCreatedAge(value: string, now = Date.now()) {
  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) return "—";
  const seconds = Math.floor(Math.abs(now - created) / 1_000);
  const units = [
    [31_536_000, "y"],
    [2_592_000, "mo"],
    [604_800, "w"],
    [86_400, "d"],
    [3_600, "h"],
    [60, "m"],
    [1, "s"]
  ] as const;
  const [duration, unit] = units.find(([duration]) => seconds >= duration) ?? [1, "s"];
  const age = `${Math.floor(seconds / duration)} ${unit}`;
  return created > now ? `in ${age}` : age;
}
