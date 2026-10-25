import { createHash } from "node:crypto";
import { sql, type Kysely } from "kysely";
import type { PlatformDatabase } from "../../database/schema.js";
import { platformAppRegistry } from "./app-registry.service.js";

export const appRegistrySeed = {
  key: "platform.app-registry.seed",
  description: "Application and Billing registry rows are seeded from code in this foundation."
};

export async function seedAppRegistryModule(database: Kysely<PlatformDatabase>) {
  console.info(`[seeder] seeding app registry (${platformAppRegistry.length} apps)`);
  for (const app of platformAppRegistry) {
    await database
      .insertInto("platform_apps")
      .values({
        always_enabled: app.alwaysEnabled,
        app_id: app.appId,
        default_landing: app.defaultLanding,
        description: app.description,
        label: app.label,
        module_key: app.moduleKey,
        stack: app.stack,
        uuid: stableUuid(app.moduleKey)
      })
      .onDuplicateKeyUpdate({
        always_enabled: app.alwaysEnabled,
        app_id: app.appId,
        default_landing: app.defaultLanding,
        description: app.description,
        label: app.label,
        module_key: app.moduleKey,
        stack: app.stack,
        updated_at: sql`CURRENT_TIMESTAMP`
      })
      .execute();
    console.info(`[seeder] app registry entry ready: ${app.moduleKey}`);
  }
  console.info("[seeder] app registry seed completed");
}

function stableUuid(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}
