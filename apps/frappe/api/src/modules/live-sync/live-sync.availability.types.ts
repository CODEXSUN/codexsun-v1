export type FrappeAvailability = {
  scheduleEnabled: boolean;
  timezone: string;
  opensAt: string;
  closesAt: string;
  status: "unknown" | "online" | "offline" | "closed";
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  reason: string | null;
};
export type FrappeAvailabilityInput = Pick<
  FrappeAvailability,
  "scheduleEnabled" | "timezone" | "opensAt" | "closesAt"
>;
export type FrappeReadiness = { ready: boolean; reason: string | null; retryAt: string };
