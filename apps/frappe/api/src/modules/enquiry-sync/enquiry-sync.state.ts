import type { Kysely } from "kysely";
import {
  EnquirySyncRepository,
  type EnquiryDatabase,
  type EnquiryDeliveryState
} from "@codexsun/crm-api/enquiry-sync";
import type { FrappeDatabase } from "../connection/index.js";

export class EnquirySyncStateReader {
  constructor(private readonly database: Kysely<FrappeDatabase>) {}

  async read(enquiryIds: number[]): Promise<Map<number, EnquiryDeliveryState>> {
    if (!enquiryIds.length) return new Map();
    const deliveries = await new EnquirySyncRepository(
      this.database as unknown as Kysely<EnquiryDatabase>
    ).deliveryStates(enquiryIds);
    const links = await this.database
      .selectFrom("frappe_enquiry_sync")
      .select(["enquiry_id", "remote_name"])
      .where("enquiry_id", "in", enquiryIds)
      .execute();
    const names = new Map(links.map((row) => [row.enquiry_id, row.remote_name]));
    return new Map(
      enquiryIds.map((id) => [
        id,
        {
          ...(deliveries.get(id) ?? { status: names.has(id) ? "synced" : "unlinked", error: null }),
          remoteName: names.get(id) ?? null
        }
      ])
    );
  }
}
