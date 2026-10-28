import type { Kysely } from "kysely";
import type { SportsclubDatabase } from "./sportsclub.types.js";
import { migrateProgramModule } from "./modules/program/program.migration.js";
import { migrateMasterModule } from "./modules/master/master.migration.js";
import { migrateMemberModule, migrateMemberPhotoModule } from "./modules/member/member.migration.js";
import { runMigrationBatch } from "@codexsun/framework/db";
import { isSqliteDatabase } from "./sportsclub.dialect.js";
import { migrateSessionModule } from "./modules/session/session.migration.js";
import { migrateAttendanceModule } from "./modules/attendance/attendance.migration.js";
import { migrateProgressModule } from "./modules/progress/progress.migration.js";
import { migrateEventModule } from "./modules/event/event.migration.js";
import { migrateEnquiryModule } from "./modules/enquiry/enquiry.migration.js";

export const sportsclubMigration = {
  name: "sportsclub.tenant.baseline",
  description: "Create all sportsclub multi-tenant tables in required dependency order."
};

export const sportsclubMemberPhotoMigration = {
  name: "sportsclub.member.photos",
  description: "Create tenant-private member photo storage for existing Sportsclub tenants."
};

export const sportsclubTenantMigrations = [sportsclubMigration, sportsclubMemberPhotoMigration];

export async function migrateSportsclubDatabase(db: Kysely<SportsclubDatabase>): Promise<void> {
  if (isSqliteDatabase(db)) return migrateSportsclubSchema(db);
  await runMigrationBatch(db, {
    batch: 1,
    scope: "sportsclub",
    description: "Sportsclub tenant schema",
    version: "1",
    steps: [
      { ...sportsclubMigration, version: 1, checksum: "sportsclub.tenant.baseline:v1", up: migrateSportsclubSchema },
      { ...sportsclubMemberPhotoMigration, version: 2, checksum: "sportsclub.member.photos:v1", up: migrateMemberPhotoModule }
    ]
  });
}

async function migrateSportsclubSchema(db: Kysely<SportsclubDatabase>): Promise<void> {
  await migrateProgramModule(db);
  await migrateMasterModule(db);
  await migrateMemberModule(db);
  await migrateSessionModule(db);
  await migrateAttendanceModule(db);
  await migrateProgressModule(db);
  await migrateEventModule(db);
  await migrateEnquiryModule(db);
}

export const migrateSportsclub = migrateSportsclubDatabase;

export async function rollbackSportsclubDatabase(db: Kysely<SportsclubDatabase>): Promise<void> {
  const tables = [
    "sportsclub_activity",
    "sportsclub_member_photos",
    "sportsclub_enquiries",
    "sportsclub_events",
    "sportsclub_progress",
    "sportsclub_attendance",
    "sportsclub_sessions",
    "sportsclub_members",
    "sportsclub_masters",
    "sportsclub_programs"
  ] as const;

  for (const table of tables) {
    await db.schema.dropTable(table).ifExists().execute();
  }
}

export const rollbackSportsclub = rollbackSportsclubDatabase;
