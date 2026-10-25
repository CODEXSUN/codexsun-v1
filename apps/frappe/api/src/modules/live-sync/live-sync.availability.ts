import { type Kysely } from "kysely";
import {
  FrappeConnectionAccess,
  requestFrappe,
  type FrappeDatabase,
  type FrappeSettings
} from "../connection/index.js";
import { frappeAvailabilityWindow } from "./live-sync.availability.policy.js";
import type {
  FrappeAvailability,
  FrappeAvailabilityInput,
  FrappeReadiness
} from "./live-sync.availability.types.js";

export class FrappeAvailabilityService {
  constructor(
    private readonly database: Kysely<FrappeDatabase>,
    private readonly secret: string,
    private readonly defaults: FrappeSettings
  ) {}

  async settings(now = new Date()): Promise<FrappeAvailability> {
    const row = await this.row();
    const input = {
      scheduleEnabled: Boolean(row.schedule_enabled),
      timezone: row.timezone,
      opensAt: row.opens_at,
      closesAt: row.closes_at
    };
    const window = frappeAvailabilityWindow(input, now);
    return {
      ...input,
      status: !window.open
        ? "closed"
        : row.connection_status === "online" &&
            (!row.next_check_at || new Date(row.next_check_at) <= now)
          ? "unknown"
          : row.connection_status,
      lastCheckedAt: iso(row.last_checked_at),
      nextCheckAt: window.open ? iso(row.next_check_at) : window.nextOpenAt,
      reason: window.open ? row.last_error : `Sync waits until ${row.opens_at} (${row.timezone}).`
    };
  }

  async save(input: FrappeAvailabilityInput, actor: string) {
    await this.database
      .updateTable("frappe_availability_settings")
      .set({
        schedule_enabled: input.scheduleEnabled,
        timezone: input.timezone,
        opens_at: input.opensAt,
        closes_at: input.closesAt,
        next_check_at: null,
        connection_status: "unknown",
        last_error: null,
        updated_by: actor
      })
      .where("id", "=", 1)
      .execute();
    return this.settings();
  }

  async ready(now = new Date()): Promise<FrappeReadiness> {
    const status = await this.settings(now);
    if (status.status === "closed")
      return { ready: false, reason: status.reason, retryAt: status.nextCheckAt! };
    const configured = await this.database
      .selectFrom("frappe_connection_settings")
      .select(["base_url", "enabled", "verification_status"])
      .where("id", "=", 1)
      .executeTakeFirst();
    if (!configured?.enabled || configured.verification_status !== "verified")
      return {
        ready: false,
        reason: "Verify and enable the Frappe connection first.",
        retryAt: new Date(now.getTime() + 300_000).toISOString()
      };
    const row = await this.row();
    if (
      row.checked_base_url === configured.base_url &&
      row.next_check_at &&
      new Date(row.next_check_at) > now
    )
      return {
        ready: row.connection_status === "online",
        reason: row.last_error,
        retryAt: iso(row.next_check_at)!
      };
    const connection = await new FrappeConnectionAccess(
      this.database,
      this.secret,
      this.defaults
    ).credentials();
    if (!connection)
      return {
        ready: false,
        reason: "Verify and enable the Frappe connection first.",
        retryAt: new Date(now.getTime() + 300_000).toISOString()
      };
    const claim = await this.database
      .updateTable("frappe_availability_settings")
      .set({
        next_check_at: new Date(now.getTime() + 20_000),
        checked_base_url: connection.baseUrl,
        connection_status: "unknown"
      })
      .where("id", "=", 1)
      .where((eb) =>
        eb.or([
          eb("next_check_at", "is", null),
          eb("next_check_at", "<=", now),
          eb("checked_base_url", "!=", connection.baseUrl),
          eb("checked_base_url", "is", null)
        ])
      )
      .executeTakeFirst();
    if (Number(claim.numUpdatedRows) !== 1)
      return {
        ready: false,
        reason: "Checking Frappe connection. Sync is waiting.",
        retryAt: new Date(now.getTime() + 20_000).toISOString()
      };
    try {
      const ping = await requestFrappe<{ message?: string }>(
        "/api/method/ping",
        "GET",
        connection,
        undefined,
        { timeoutMs: 5000 }
      );
      if (ping.message !== "pong")
        throw new Error("Frappe returned an unexpected connection check response.");
      const retryAt = new Date(now.getTime() + 60_000);
      await this.database
        .updateTable("frappe_availability_settings")
        .set({
          connection_status: "online",
          last_checked_at: now,
          next_check_at: retryAt,
          last_error: null
        })
        .where("id", "=", 1)
        .where("checked_base_url", "=", connection.baseUrl)
        .execute();
      return { ready: true, reason: null, retryAt: retryAt.toISOString() };
    } catch (error) {
      return this.unavailable(error, now);
    }
  }

  async unavailable(error: unknown, now = new Date()): Promise<FrappeReadiness> {
    const reason = error instanceof Error ? error.message : "Frappe connection check failed.";
    const retryAt = new Date(now.getTime() + 300_000);
    await this.database
      .updateTable("frappe_availability_settings")
      .set({
        connection_status: "offline",
        last_checked_at: now,
        next_check_at: retryAt,
        last_error: reason.slice(0, 2000)
      })
      .where("id", "=", 1)
      .execute();
    return { ready: false, reason, retryAt: retryAt.toISOString() };
  }

  private row() {
    return this.database
      .selectFrom("frappe_availability_settings")
      .selectAll()
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();
  }
}
function iso(value: Date | string | null) {
  return value ? new Date(value).toISOString() : null;
}
