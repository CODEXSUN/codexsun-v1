import type { FrappeAvailabilityInput } from "./live-sync.availability.types.js";

export function frappeAvailabilityWindow(settings: FrappeAvailabilityInput, now = new Date()) {
  if (!settings.scheduleEnabled) return { open: true, nextOpenAt: now.toISOString() };
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: settings.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const inside = (date: Date) => {
    const time = formatter.format(date);
    return settings.opensAt < settings.closesAt
      ? time >= settings.opensAt && time < settings.closesAt
      : time >= settings.opensAt || time < settings.closesAt;
  };
  if (inside(now)) return { open: true, nextOpenAt: now.toISOString() };
  const next = new Date(Math.floor(now.getTime() / 60_000) * 60_000 + 60_000);
  for (let minute = 0; minute < 48 * 60; minute++, next.setTime(next.getTime() + 60_000)) {
    if (inside(next)) return { open: false, nextOpenAt: next.toISOString() };
  }
  throw new Error("The configured availability window has no opening within two days.");
}

export function isFrappeUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Cloudflare Tunnel|HTTP (?:429|502|503|504|530)|could not be reached|fetch failed|ECONNREFUSED|ETIMEDOUT|FRAPPE_UPSTREAM/iu.test(
    message
  );
}
