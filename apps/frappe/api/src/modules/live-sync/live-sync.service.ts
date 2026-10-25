import { sql, type Kysely } from "kysely";
import type { FrappeDatabase } from "../connection/index.js";
import type { ExportKind } from "../export/index.js";
import type { LiveSyncSettings } from "./live-sync.types.js";
const kinds: ExportKind[] = ["contacts", "enquiries", "activities", "call-logs"];
export class FrappeLiveSyncService {
  constructor(private readonly database: Kysely<FrappeDatabase>) {}
  async access() {
    const connection = await this.database
      .selectFrom("frappe_connection_settings")
      .select(["enabled", "verification_status"])
      .where("id", "=", 1)
      .executeTakeFirst();
    if (!connection?.enabled) return { enabled: false, outbound: false };
    const settings = await this.database
      .selectFrom("frappe_live_sync_settings")
      .select(["enabled", "paused", "direction"])
      .where("id", "=", 1)
      .executeTakeFirst();
    if (!settings?.enabled) return { enabled: false, outbound: false };
    return {
      enabled: true,
      outbound:
        !settings.paused &&
        settings.direction === "bidirectional" &&
        connection.verification_status === "verified"
    };
  }
  async settings(): Promise<LiveSyncSettings> {
    const row = await this.database
      .selectFrom("frappe_live_sync_settings")
      .selectAll()
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();
    const scheduleMinutes = (
      [1, 5, 15, 30, 60].includes(row.schedule_minutes) ? row.schedule_minutes : 1
    ) as LiveSyncSettings["scheduleMinutes"];
    return {
      enabled: Boolean(row.enabled),
      paused: Boolean(row.paused),
      direction: row.direction === "bidirectional" ? "bidirectional" : "inbound",
      inboundBaseUrl: row.inbound_base_url,
      inboundCheckpointAt: row.inbound_checkpoint_at
        ? new Date(row.inbound_checkpoint_at).toISOString()
        : null,
      scheduleMinutes,
      modules: {
        contacts: Boolean(row.contacts_enabled),
        enquiries: Boolean(row.enquiries_enabled),
        activities: Boolean(row.activities_enabled),
        "call-logs": Boolean(row.call_logs_enabled)
      },
      lastScheduledAt: row.last_scheduled_at ? new Date(row.last_scheduled_at).toISOString() : null,
      updatedAt: new Date(row.updated_at).toISOString(),
      updatedBy: row.updated_by,
      backgroundWorkerEnabled: false
    };
  }
  async save(
    input: Pick<
      LiveSyncSettings,
      "enabled" | "paused" | "direction" | "scheduleMinutes" | "modules"
    >,
    actorEmail: string
  ) {
    await this.database
      .updateTable("frappe_live_sync_settings")
      .set({
        enabled: input.enabled,
        paused: input.paused,
        direction: input.direction,
        schedule_minutes: input.scheduleMinutes,
        contacts_enabled: input.modules.contacts,
        enquiries_enabled: input.modules.enquiries,
        activities_enabled: input.modules.activities,
        call_logs_enabled: input.modules["call-logs"],
        updated_by: actorEmail,
        updated_at: new Date()
      })
      .where("id", "=", 1)
      .execute();
    return this.settings();
  }

  async completeInbound(baseUrl: string, checkpointAt: string) {
    const checkpoint = new Date(checkpointAt);
    if (Number.isNaN(checkpoint.getTime())) throw new Error("Invalid inbound checkpoint.");
    await this.database
      .updateTable("frappe_live_sync_settings")
      .set({ inbound_base_url: baseUrl, inbound_checkpoint_at: checkpoint })
      .where("id", "=", 1)
      .where((eb) =>
        eb.or([
          eb("inbound_base_url", "is", null),
          eb("inbound_base_url", "!=", baseUrl),
          eb("inbound_checkpoint_at", "is", null),
          eb("inbound_checkpoint_at", "<", checkpoint)
        ])
      )
      .execute();
  }
  async dueKinds(now = new Date()) {
    const settings = await this.settings();
    if (!settings.enabled || settings.paused) return [];
    const dueAt = settings.lastScheduledAt
      ? new Date(settings.lastScheduledAt).getTime() + settings.scheduleMinutes * 60_000
      : 0;
    if (dueAt > now.getTime()) return [];
    await sql`UPDATE frappe_live_sync_settings SET last_scheduled_at=${now}, updated_at=UTC_TIMESTAMP() WHERE id=1`.execute(
      this.database
    );
    return kinds.filter((kind) => settings.modules[kind]);
  }
}
