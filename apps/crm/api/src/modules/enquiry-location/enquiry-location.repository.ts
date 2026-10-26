import type { Kysely, Selectable, Transaction } from "kysely";
import { recordEnquiryPin, type EnquiryDatabase } from "../enquiry/index.js";
import type {
  CreateEnquiryLocation,
  EnquiryLocationDatabase,
  EnquiryLocationRow
} from "./enquiry-location.types.js";

export class EnquiryLocationRepository {
  constructor(
    private readonly database: Kysely<EnquiryLocationDatabase>,
    private readonly workEvent?: (
      transaction: Transaction<EnquiryLocationDatabase>,
      enquiryId: number,
      action: string,
      body: string
    ) => Promise<void>
  ) {}

  async create(
    enquiryId: number,
    contactId: number | null,
    input: CreateEnquiryLocation,
    actor: string
  ) {
    return this.database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto("crm_enquiry_locations")
        .values({
          enquiry_id: enquiryId,
          contact_id: contactId,
          latitude: input.latitude.toFixed(7),
          longitude: input.longitude.toFixed(7),
          accuracy_meters: input.accuracyMeters === null ? null : input.accuracyMeters.toFixed(2),
          captured_at: new Date(input.capturedAt).toISOString().slice(0, 19).replace("T", " "),
          created_by: actor
        })
        .executeTakeFirstOrThrow();
      const saved = await transaction
        .selectFrom("crm_enquiry_locations")
        .selectAll()
        .where("id", "=", Number(row.insertId))
        .executeTakeFirstOrThrow();
      const details = await recordEnquiryPin(
        transaction as unknown as Transaction<EnquiryDatabase>,
        enquiryId,
        input,
        actor,
        `pin-location:${saved.uuid}`
      );
      await this.workEvent?.(transaction, enquiryId, "pin-location", details);
      return mapRow(saved);
    });
  }

  async list(enquiryId: number) {
    const rows = await this.database
      .selectFrom("crm_enquiry_locations")
      .selectAll()
      .where("enquiry_id", "=", enquiryId)
      .orderBy("captured_at", "desc")
      .orderBy("id", "desc")
      .limit(100)
      .execute();
    return rows.map(mapRow);
  }
}

function mapRow(row: Selectable<EnquiryLocationRow>) {
  return {
    id: Number(row.id),
    uuid: row.uuid,
    enquiryId: Number(row.enquiry_id),
    contactId: row.contact_id === null ? null : Number(row.contact_id),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracyMeters: row.accuracy_meters === null ? null : Number(row.accuracy_meters),
    capturedAt: asUtcIso(row.captured_at),
    createdBy: row.created_by,
    createdAt: asUtcIso(row.created_at)
  };
}

function asUtcIso(value: string | Date) {
  if (value instanceof Date) return value.toISOString();
  return new Date(
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value.replace(" ", "T")}Z`
  ).toISOString();
}
