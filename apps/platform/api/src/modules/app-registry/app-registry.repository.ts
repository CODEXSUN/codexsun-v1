import { randomBytes } from "node:crypto";
import { getPlatformDatabase } from "../../database/platform-database.js";
import type {
  PlatformAppDefinition,
  PlatformAppId,
  PlatformAppSavePayload
} from "./app-registry.types.js";

export class AppRegistryRepository {
  async list() {
    const rows = await getPlatformDatabase()
      .selectFrom("platform_apps")
      .select([
        "id",
        "uuid",
        "app_id",
        "label",
        "module_key",
        "stack",
        "always_enabled",
        "default_landing",
        "description"
      ])
      .where("app_id", "!=", "project-manager")
      .orderBy("default_landing", "desc")
      .orderBy("label", "asc")
      .execute();

    return rows.map(toAppDefinition);
  }

  async create(input: PlatformAppSavePayload) {
    const result = await getPlatformDatabase()
      .insertInto("platform_apps")
      .values({ ...toRow(input), uuid: randomBytes(4).toString("hex") })
      .executeTakeFirst();
    return this.find(Number(result.insertId));
  }

  async update(id: number, input: PlatformAppSavePayload) {
    await getPlatformDatabase()
      .updateTable("platform_apps")
      .set(toRow(input))
      .where("id", "=", id)
      .execute();
    return this.find(id);
  }

  private async find(id: number) {
    const row = await getPlatformDatabase()
      .selectFrom("platform_apps")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? toAppDefinition(row) : null;
  }
}

type AppRow = {
  always_enabled: number | boolean;
  default_landing: number | boolean;
  description: string;
  id: number;
  app_id: string;
  label: string;
  module_key: string;
  stack: PlatformAppDefinition["stack"];
  uuid: string;
};

function toAppDefinition(row: AppRow): PlatformAppDefinition {
  return {
    alwaysEnabled: Boolean(row.always_enabled),
    appId: row.app_id as PlatformAppId,
    defaultLanding: Boolean(row.default_landing),
    description: row.description,
    id: Number(row.id),
    label: row.label,
    moduleKey: row.module_key,
    stack: row.stack,
    uuid: row.uuid
  };
}

function toRow(input: PlatformAppSavePayload, uuid?: string) {
  return {
    always_enabled: input.alwaysEnabled,
    app_id: input.appId,
    default_landing: input.defaultLanding,
    description: input.description,
    label: input.label,
    module_key: input.moduleKey,
    stack: input.stack,
    ...(uuid ? { uuid } : {})
  };
}
