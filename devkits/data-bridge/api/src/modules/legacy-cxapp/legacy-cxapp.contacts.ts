import {
  LegacyPreparationRepository,
  legacyStatus,
  legacyText
} from "./legacy-cxapp.repository.js";
import type { LegacyRecord } from "./legacy-cxapp.types.js";
export class LegacyContactPreparation {
  constructor(private readonly repository: LegacyPreparationRepository) {}
  async run() {
    await this.contacts();
  }
  private async contacts() {
    await this.repository.mapping({
      phase: "masters",
      sourceTable: "party_tbl",
      sourceKey: "PARTY_ID",
      targetTable: "core_contacts",
      columns: {
        code: "LEGACY-PARTY-<PARTY_ID>",
        name: "PARTY_NAME",
        type_id: "CONTACTTYPE_ID",
        type_name: "unchanged contact type label",
        primary_phone: "CELL else PHONE",
        primary_email: "EMAIL",
        gstin: "GST",
        pan: "PAN",
        opening_balance: "OPENING_BALANCE",
        website: "WEBSITE",
        description: "NOTES; raw unsupported values retained",
        status: "ACTIVE_ID"
      }
    });
    await this.repository.mapping({
      phase: "masters",
      sourceTable: "party_tbl",
      sourceKey: "PARTY_ID",
      targetTable: "core_contacts_addresses",
      columns: {
        parent_id: "prepared contact",
        address_line1: "STREET1",
        address_line2: "STREET2",
        country_id: "COUNTRY_ID",
        state_id: "STATE_ID",
        city_id: "CITY_ID",
        pincode_id: "PINCODE_ID + CITY_ID",
        is_default: "1"
      }
    });
    for (const source of await this.repository.read("party_tbl")) {
      const type = this.repository.find("core_contact_types", Number(source.CONTACTTYPE_ID));
      const key = String(source.PARTY_ID);
      const contact = await this.repository.save(
        {
          phase: "masters",
          sourceTable: "party_tbl",
          sourceKey: key,
          targetTable: "core_contacts",
          source,
          data: {
            code: `LEGACY-PARTY-${key}`,
            name: legacyText(source.PARTY_NAME),
            type_name: type?.data.name ?? null,
            primary_phone: legacyText(source.CELL || source.PHONE) || null,
            primary_email: legacyText(source.EMAIL) || null,
            gstin: legacyText(source.GST) || null,
            pan: legacyText(source.PAN) || null,
            opening_balance: source.OPENING_BALANCE!,
            website: legacyText(source.WEBSITE) || null,
            description: legacyText(source.NOTES) || null,
            status: legacyStatus(source.ACTIVE_ID)
          },
          issues: []
        },
        ["code"],
        [{ field: "type_id", row: type }]
      );
      await this.address(source, contact);
      for (const field of ["PHONE", "CELL", "EMAIL"]) await this.channel(source, field, contact);
    }
  }

  private async address(
    source: LegacyRecord,
    contact: ReturnType<LegacyPreparationRepository["find"]>
  ) {
    const city = this.repository.find("core_cities", Number(source.CITY_ID));
    const issues: string[] = [];
    if (!legacyText(source.STREET1)) issues.push("Missing street line 1; no invented address.");
    if (city?.source.STATE_ID !== source.STATE_ID)
      issues.push("Party state conflicts with city state.");
    await this.repository.save(
      {
        phase: "masters",
        sourceTable: "party_tbl",
        sourceKey: String(source.PARTY_ID),
        targetTable: "core_contacts_addresses",
        source,
        data: {
          address_line1: legacyText(source.STREET1) || null,
          address_line2: legacyText(source.STREET2) || null,
          is_default: 1
        },
        issues
      },
      ["parent_id", "address_line1", "address_line2"],
      [
        { field: "parent_id", row: contact },
        {
          field: "country_id",
          row: this.repository.find("core_countries", Number(source.COUNTRY_ID))
        },
        { field: "state_id", row: this.repository.find("core_states", Number(source.STATE_ID)) },
        { field: "city_id", row: city },
        {
          field: "district_id",
          row: this.repository.find("core_districts", Number(source.CITY_ID), "city_tbl")
        },
        {
          field: "pincode_id",
          row: this.repository.find("core_pincodes", `${source.PINCODE_ID}@${source.CITY_ID}`)
        }
      ]
    );
  }

  private async channel(
    source: LegacyRecord,
    field: string,
    contact: ReturnType<LegacyPreparationRepository["find"]>
  ) {
    const value = legacyText(source[field]);
    if (!value) return;
    const email = field === "EMAIL",
      table = email ? "core_contacts_emails" : "core_contacts_phones";
    const column = email ? "email" : "phone";
    await this.repository.mapping({
      phase: "masters",
      sourceTable: "party_tbl",
      sourceKey: `PARTY_ID@${field}`,
      targetTable: table,
      columns: {
        parent_id: "prepared contact",
        [column]: email ? "EMAIL" : "PHONE/CELL; separate records",
        is_primary: "one primary channel"
      }
    });
    await this.repository.save(
      {
        phase: "masters",
        sourceTable: "party_tbl",
        sourceKey: `${source.PARTY_ID}@${field}`,
        targetTable: table,
        source,
        data: {
          [column]: value,
          is_primary: email || field === "CELL" || !legacyText(source.CELL) ? 1 : 0
        },
        issues:
          email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? ["Review invalid legacy email."] : []
      },
      ["parent_id", column],
      [{ field: "parent_id", row: contact }]
    );
  }
}
