import { getCoreDatabase } from "../../../../database/core-database.js";
import { ensureUnitDefaults } from "./units.migration.js";

export const unitsSeed = {
  description: "Seed Units records without replacing existing identities.",
  key: "core.common.products.units.seed"
};

export async function seedUnits() {
  await ensureUnitDefaults(getCoreDatabase());
}
