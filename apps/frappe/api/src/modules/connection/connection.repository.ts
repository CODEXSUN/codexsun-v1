import type { Kysely } from "kysely";
import type { FrappeDatabase } from "./connection.types.js";
import type { FrappeConnectionInput } from "./connection.types.js";
import { decryptFrappeCredential, encryptFrappeCredential } from "./connection.secrets.js";
import { sql } from "kysely";
import { createHash } from "node:crypto";
import {
  EnquiryNumbering,
  type EnquiryDatabase,
  type EnquiryListOptions
} from "@codexsun/crm-api/enquiry-sync";

export class FrappeConnectionRepository {
  constructor(private readonly database: Kysely<FrappeDatabase>) {}

  connection() {
    return this.database
      .selectFrom("frappe_connection_settings")
      .selectAll()
      .where("id", "=", 1)
      .executeTakeFirst();
  }

  async importState() {
    const row = await this.database
      .selectFrom("frappe_import_state")
      .select(["completed_at", "completed_by"])
      .where("id", "=", 1)
      .executeTakeFirst();
    return {
      completedAt: row?.completed_at ? new Date(row.completed_at).toISOString() : null,
      completedBy: row?.completed_by ?? null
    };
  }

  async completeImport(actorEmail: string) {
    await this.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable("frappe_import_state")
        .set({
          completed_at: new Date().toISOString().slice(0, 19).replace("T", " "),
          completed_by: actorEmail
        })
        .where("id", "=", 1)
        .where("completed_at", "is", null)
        .execute();
      await transaction
        .updateTable("frappe_connection_settings")
        .set({ enabled: false })
        .where("id", "=", 1)
        .execute();
    });
    return this.importState();
  }

  async provider(moduleKey: string): Promise<"local" | "frappe"> {
    const row = await this.database
      .selectFrom("frappe_data_sources")
      .select("provider")
      .where("module_key", "=", moduleKey)
      .executeTakeFirst();
    return row?.provider ?? "local";
  }

  async saveProvider(moduleKey: string, provider: "local" | "frappe", actorEmail: string) {
    const values = { provider, updated_by: actorEmail };
    await this.database
      .insertInto("frappe_data_sources")
      .values({ module_key: moduleKey, ...values })
      .onDuplicateKeyUpdate(values)
      .execute();
    return this.provider(moduleKey);
  }

  async saveConnection(input: FrappeConnectionInput, encryptionSecret: string) {
    const current = await this.connection();
    const values = {
      connection_name: input.connectionName,
      base_url: input.baseUrl,
      api_key_ciphertext: input.apiKey
        ? encryptFrappeCredential(input.apiKey, encryptionSecret, "key")
        : (current?.api_key_ciphertext ?? null),
      api_secret_ciphertext: input.apiSecret
        ? encryptFrappeCredential(input.apiSecret, encryptionSecret, "secret")
        : (current?.api_secret_ciphertext ?? null),
      enabled: input.enabled,
      verification_status: "unverified" as const,
      last_checked_at: null,
      last_verified_at: null
    };
    await this.database
      .insertInto("frappe_connection_settings")
      .values({ id: 1, ...values })
      .onDuplicateKeyUpdate(values)
      .execute();
    return this.connection();
  }

  async credentials(encryptionSecret: string) {
    const row = await this.connection();
    if (!row) return null;
    return {
      row,
      settings: {
        baseUrl: row.base_url,
        apiKey: row.api_key_ciphertext
          ? decryptFrappeCredential(row.api_key_ciphertext, encryptionSecret, "key")
          : "",
        apiSecret: row.api_secret_ciphertext
          ? decryptFrappeCredential(row.api_secret_ciphertext, encryptionSecret, "secret")
          : "",
        enabled: Boolean(row.enabled)
      }
    };
  }

  async recordVerification(status: "verified" | "failed") {
    const checkedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    await this.database
      .updateTable("frappe_connection_settings")
      .set({
        verification_status: status,
        last_checked_at: checkedAt,
        ...(status === "verified" ? { last_verified_at: checkedAt } : {})
      })
      .where("id", "=", 1)
      .execute();
  }

  get(enquiryId: number, baseUrl?: string) {
    let query = this.database
      .selectFrom("frappe_enquiry_sync")
      .select(["remote_name", "synced_at"])
      .where("enquiry_id", "=", enquiryId);
    if (baseUrl) {
      const sourceKey = createHash("sha256")
        .update(new URL(baseUrl).origin.toLowerCase())
        .digest("hex");
      query = query.where("source_site_key", "=", sourceKey);
    }
    return query.executeTakeFirst();
  }

  byRemoteName(remoteName: string) {
    return this.database
      .selectFrom("frappe_enquiry_sync as sync")
      .innerJoin("crm_enquiries as enquiry", "enquiry.id", "sync.enquiry_id")
      .select([
        "sync.enquiry_id as enquiryId",
        "sync.synced_at as syncedAt",
        "sync.source_modified_at as sourceModifiedAt",
        "enquiry.updated_at as updatedAt",
        "enquiry.source as source",
        "enquiry.contact_id as contactId",
        "enquiry.assigned_user_id as assignedUserId",
        "enquiry.list_in_id as listInId"
      ])
      .where("sync.remote_name", "=", remoteName)
      .executeTakeFirst();
  }

  async linksByRemoteNames(remoteNames: string[]) {
    if (!remoteNames.length) return new Map<string, number>();
    const links = await this.database
      .selectFrom("frappe_enquiry_sync")
      .select(["remote_name", "enquiry_id"])
      .where("remote_name", "in", remoteNames)
      .execute();
    return new Map(links.map((link) => [link.remote_name, link.enquiry_id]));
  }

  async save(enquiryId: number, remoteName: string, sourceModifiedAt?: string) {
    const syncedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    const sourceTimestamp = sourceModifiedAt
      ? {
          source_modified_at: new Date(sourceModifiedAt)
            .toISOString()
            .slice(0, 23)
            .replace("T", " ")
        }
      : {};
    await this.database
      .insertInto("frappe_enquiry_sync")
      .values({
        enquiry_id: enquiryId,
        remote_name: remoteName,
        synced_at: syncedAt,
        ...sourceTimestamp
      })
      .onDuplicateKeyUpdate({ remote_name: remoteName, synced_at: syncedAt, ...sourceTimestamp })
      .execute();
    const links = await this.database
      .selectFrom("frappe_enquiry_sync")
      .select(["enquiry_id as enquiryId", "remote_name as remoteName"])
      .execute();
    await new EnquiryNumbering(this.database as unknown as Kysely<EnquiryDatabase>).reconcile(
      links
    );
  }

  async overview(
    viewer: Pick<EnquiryListOptions, "actorEmail" | "actorUserId" | "canViewAll">,
    ids: number[]
  ) {
    let countsQuery = this.database
      .selectFrom("crm_enquiries as enquiry")
      .leftJoin("frappe_enquiry_sync as sync", "sync.enquiry_id", "enquiry.id")
      .select([
        sql<number>`COUNT(*)`.as("total"),
        sql<number>`SUM(CASE WHEN sync.enquiry_id IS NULL THEN 0 ELSE 1 END)`.as("synced")
      ]);
    if (!viewer.canViewAll) {
      countsQuery = countsQuery.where((expression) =>
        expression.or([
          expression("enquiry.created_by", "=", viewer.actorEmail),
          ...(viewer.actorUserId
            ? [expression("enquiry.assigned_user_id", "=", viewer.actorUserId)]
            : [])
        ])
      );
    }
    const [counts, syncRows] = await Promise.all([
      countsQuery.executeTakeFirstOrThrow(),
      ids.length
        ? this.database
            .selectFrom("frappe_enquiry_sync")
            .select(["enquiry_id", "remote_name", "synced_at"])
            .where("enquiry_id", "in", ids)
            .execute()
        : Promise.resolve([])
    ]);
    return {
      total: Number(counts.total),
      synced: Number(counts.synced ?? 0),
      byId: new Map(syncRows.map((row) => [row.enquiry_id, row]))
    };
  }
}
