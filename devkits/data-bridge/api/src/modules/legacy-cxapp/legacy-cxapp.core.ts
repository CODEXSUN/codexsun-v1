import { LegacyLookupPreparation } from "./legacy-cxapp.lookups.js";
import type { LegacyRecord } from "./legacy-cxapp.types.js";
import {
  LegacyPreparationRepository,
  legacyStatus,
  legacyText
} from "./legacy-cxapp.repository.js";

export class LegacyCorePreparation {
  constructor(private readonly repository: LegacyPreparationRepository) {}
  async run() {
    await this.countries();
    await this.states();
    await this.cities();
    await this.pincodes();
    await new LegacyLookupPreparation(this.repository).run();
  }

  private async countries() {
    await this.repository.mapping({
      phase: "core",
      sourceTable: "country_tbl",
      sourceKey: "COUNTRY_ID",
      targetTable: "core_countries",
      columns: { name: "COUNTRY_NAME", code: "verified target country code", status: "ACTIVE_ID" }
    });
    for (const source of await this.repository.read("country_tbl")) {
      const name = legacyText(source.COUNTRY_NAME);
      const target = await this.repository.matches("core_countries", { name });
      await this.repository.save(
        {
          phase: "core",
          sourceTable: "country_tbl",
          sourceKey: String(source.COUNTRY_ID),
          targetTable: "core_countries",
          source,
          data: {
            name: target.length === 1 ? String(target[0]!.name) : name,
            code: target.length === 1 ? target[0]!.code! : null,
            status: legacyStatus(source.ACTIVE_ID)
          },
          issues: target.length === 1 ? [] : ["Confirm the country code before normalization."]
        },
        ["name"]
      );
    }
  }

  private async states() {
    await this.repository.mapping({
      phase: "core",
      sourceTable: "state_tbl",
      sourceKey: "STATE_ID",
      targetTable: "core_states",
      columns: {
        name: "STATE_NAME",
        code: "STATE_CODE",
        country_id: "country_tbl.COUNTRY_ID → country identity",
        status: "ACTIVE_ID"
      }
    });
    for (const source of await this.repository.read("state_tbl")) {
      const country = this.repository.find("core_countries", Number(source.COUNTRY_ID));
      const target = await this.repository.matches("core_states", {
        name: legacyText(source.STATE_NAME),
        country_id: country?.targetId ?? null
      });
      const code =
        legacyText(source.STATE_CODE) || (target.length === 1 ? legacyText(target[0]!.code) : "");
      await this.repository.save(
        {
          phase: "core",
          sourceTable: "state_tbl",
          sourceKey: String(source.STATE_ID),
          targetTable: "core_states",
          source,
          data: {
            name: target.length === 1 ? String(target[0]!.name) : legacyText(source.STATE_NAME),
            code,
            status: legacyStatus(source.ACTIVE_ID)
          },
          issues: code ? [] : ["Missing source state code; choose a verified target state."]
        },
        ["country_id", "name"],
        [
          {
            field: "country_id",
            row: this.repository.find("core_countries", Number(source.COUNTRY_ID))
          }
        ]
      );
    }
  }

  private async cities() {
    await this.repository.mapping({
      phase: "core",
      sourceTable: "city_tbl",
      sourceKey: "CITY_ID",
      targetTable: "core_districts",
      columns: {
        name: "missing source district; exact existing city match or reviewed crosswalk",
        state_id: "STATE_ID"
      }
    });
    await this.repository.mapping({
      phase: "core",
      sourceTable: "city_tbl",
      sourceKey: "CITY_ID",
      targetTable: "core_cities",
      columns: {
        name: "CITY_NAME",
        district_id: "exact target country/state/city match or reviewed district crosswalk",
        status: "ACTIVE_ID"
      }
    });
    for (const source of await this.repository.read("city_tbl")) {
      const state = this.repository.find("core_states", Number(source.STATE_ID));
      const issues: string[] = [];
      const [found] = await this.repository.target.query(
        `SELECT c.id,c.district_id FROM core_cities c JOIN core_districts d ON d.id=c.district_id
         WHERE c.name=? AND d.state_id=? LIMIT 2`,
        [legacyText(source.CITY_NAME), state?.targetId ?? null]
      );
      const candidates = found as LegacyRecord[];
      let districtName: string | null = null;
      if (candidates.length === 1) {
        const districts = await this.repository.matches("core_districts", {
          id: candidates[0]!.district_id!
        });
        if (districts.length === 1) {
          districtName = String(districts[0]!.name);
        }
      }
      if (!districtName)
        issues.push("Select a verified district; the legacy city has no district field.");
      if (state?.source.COUNTRY_ID !== source.COUNTRY_ID)
        issues.push("City country disagrees with its state country.");
      const district = await this.repository.save(
        {
          phase: "core",
          sourceTable: "city_tbl",
          sourceKey: String(source.CITY_ID),
          targetTable: "core_districts",
          source,
          data: { name: districtName, status: "active" },
          issues: districtName ? [] : ["Missing district: select a verified parent."]
        },
        ["state_id", "name"],
        [{ field: "state_id", row: state }]
      );
      await this.repository.save(
        {
          phase: "core",
          sourceTable: "city_tbl",
          sourceKey: String(source.CITY_ID),
          targetTable: "core_cities",
          source,
          data: {
            name: legacyText(source.CITY_NAME),
            district_id: district.stageId,
            status: legacyStatus(source.ACTIVE_ID)
          },
          issues
        },
        ["district_id", "name"],
        [{ field: "district_id", row: district }]
      );
    }
  }

  private async pincodes() {
    await this.repository.mapping({
      phase: "core",
      sourceTable: "pincode_tbl",
      sourceKey: "PINCODE_ID@CITY_ID",
      targetTable: "core_pincodes",
      columns: {
        name: "PINCODE_NAME",
        city_id: "party_tbl city relationship",
        area: "empty: no source area",
        status: "ACTIVE_ID"
      }
    });
    const parties = await this.repository.read("party_tbl");
    for (const source of await this.repository.read("pincode_tbl")) {
      const cities = [
        ...new Set(
          parties.filter((p) => p.PINCODE_ID === source.PINCODE_ID).map((p) => Number(p.CITY_ID))
        )
      ];
      if (!cities.length) cities.push(0);
      for (const city of cities)
        await this.repository.save(
          {
            phase: "core",
            sourceTable: "pincode_tbl",
            sourceKey: `${source.PINCODE_ID}@${city}`,
            targetTable: "core_pincodes",
            source,
            data: {
              name: legacyText(source.PINCODE_NAME),
              area: "",
              status: legacyStatus(source.ACTIVE_ID)
            },
            issues: city ? [] : ["Postal code has no referenced city; review location."]
          },
          ["city_id", "name", "area"],
          [{ field: "city_id", row: this.repository.find("core_cities", city) }]
        );
    }
  }
}
