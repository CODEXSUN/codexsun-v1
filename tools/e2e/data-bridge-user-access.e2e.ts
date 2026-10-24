import { hasActiveTransferCompanyContext } from "../../apps/core/api/src/modules/organisation/default-company/default-company.transfer.js";
import { migrateSopModule } from "../../apps/crm/api/src/modules/sop/sop.migration.js";
import { seedSopPermissions } from "../../apps/crm/api/src/modules/sop/sop.seed.js";
import type { SopDatabase } from "../../apps/crm/api/src/modules/sop/sop.types.js";
import { migrateSopItemModule } from "../../apps/crm/api/src/modules/sop-item/sop-item.migration.js";
import { SopItemRepository } from "../../apps/crm/api/src/modules/sop-item/sop-item.repository.js";
import type { SopItemDatabase } from "../../apps/crm/api/src/modules/sop-item/sop-item.types.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { FastifyRequest } from "fastify";
import { createConnection, type RowDataPacket } from "mysql2/promise";
import { createPool } from "mysql2";
import { randomBytes } from "node:crypto";
import { Kysely, MysqlDialect } from "kysely";
import {
  seedCoreTenantDatabase,
  closeCoreDatabase
} from "../../apps/core/api/src/database/core-database.js";
import { authorizeCoreRequest } from "../../apps/core/api/src/auth/tenant-permission.js";
import { seedCoreTenantPermissions } from "../../apps/core/api/src/auth/tenant-permission.seed.js";
import { authorizeBillingRequest } from "../../apps/billing/api/src/auth/tenant-permission.js";
import { seedBillingTenantPermissions } from "../../apps/billing/api/src/auth/tenant-permission.seed.js";
import {
  withBillingScope,
  assertBillingEntryEditable
} from "../../apps/billing/api/src/auth/billing-scope.js";
import { closeAllBillingDatabases } from "../../apps/billing/api/src/database/billing-database.js";
import { crmRecordReadRoles } from "../../apps/crm/api/src/crm.access.js";
import { seedCrmUserAccess } from "../../apps/crm/api/src/crm.user-access.seed.js";
import { migrateTenantUserModule } from "../../apps/platform/api/src/modules/tenant-user/tenant-user.migration.js";
import { migrateTenantRoleModule } from "../../apps/platform/api/src/modules/tenant-role/tenant-role.migration.js";
import { migrateTenantUserRoleModule } from "../../apps/platform/api/src/modules/tenant-user-role/tenant-user-role.migration.js";
import { migrateTenantPermissionModule } from "../../apps/platform/api/src/modules/tenant-permission/tenant-permission.migration.js";
import { migrateTenantRolePermissionModule } from "../../apps/platform/api/src/modules/tenant-role-permission/tenant-role-permission.migration.js";
import { seedTenantRoleModule } from "../../apps/platform/api/src/modules/tenant-role/tenant-role.seed.js";
import type { TenantDatabase } from "../../apps/platform/api/src/database/schema.js";
const config = {
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!
};
const request = (method: string, url: string) =>
  ({ method, url, routeOptions: { url } }) as FastifyRequest;

test("standard User access grants view/create and Billing draft edits, while admin-only mutations stay protected", async (t) => {
  assert.ok(["127.0.0.1", "localhost", "::1"].includes(config.host));
  const name = `codexsun_access_${randomBytes(5).toString("hex")}`;
  const admin = await createConnection(config);
  let db: Kysely<TenantDatabase> | undefined;
  try {
    await admin.query(`CREATE DATABASE \`${name}\``);
    await admin.changeUser({ database: name });
    db = new Kysely({
      dialect: new MysqlDialect({ pool: createPool({ ...config, database: name }) })
    });
    await seedCoreTenantDatabase(name);
    for (const migrate of [
      migrateTenantUserModule,
      migrateTenantRoleModule,
      migrateTenantUserRoleModule,
      migrateTenantPermissionModule,
      migrateTenantRolePermissionModule
    ])
      await migrate(db);
    await seedTenantRoleModule(db);
    await admin.query(
      "INSERT INTO app_users(uuid,name,email,password_hash,role,status) VALUES('aaaa0001','User','user@example.test','unused-fixture','user','active'),('aaaa0002','Admin','admin@example.test','unused-fixture','admin','active')"
    );
    await admin.query(
      "INSERT INTO app_user_roles(uuid,user_id,role_id,status) SELECT LEFT(MD5(u.email),8),u.id,r.id,'active' FROM app_users u JOIN app_roles r ON r.`key`=u.role"
    );
    await seedCoreTenantPermissions(db as unknown as Kysely<unknown>);
    await seedBillingTenantPermissions(db as unknown as Kysely<unknown>);
    await t.test(
      "Core user can view/create but cannot edit/delete even after a stale broad grant",
      async () => {
        for (const method of ["GET", "POST"])
          await authorizeCoreRequest(request(method, "/core/products"), name, "user@example.test");
        await admin.query(
          "INSERT IGNORE INTO app_role_permissions(uuid,role_id,permission_id,status) SELECT LEFT(MD5(p.`key`),8),r.id,p.id,'active' FROM app_roles r JOIN app_permissions p ON p.`key` IN ('core.application.records.update','core.application.records.delete') WHERE r.`key`='user'"
        );
        await admin.query(
          "UPDATE app_role_permissions rp JOIN app_roles r ON r.id=rp.role_id SET rp.status='active' WHERE r.`key`='user'"
        );
        for (const method of ["PUT", "DELETE"])
          await assert.rejects(
            authorizeCoreRequest(request(method, "/core/products/:id"), name, "user@example.test"),
            /Permission/u
          );
        await authorizeCoreRequest(
          request("PUT", "/core/products/:id"),
          name,
          "admin@example.test"
        );
      }
    );
    await t.test(
      "Billing grants draft-edit access without granting finalized edit, delete or settings changes",
      async () => {
        const access = await authorizeBillingRequest(
          request("PUT", "/billing/sales/:id"),
          name,
          "user@example.test"
        );
        assert.equal(access.canEditEntries, true);
        assert.equal(access.canEditFinalizedEntries, false);
        for (const [method, url] of [
          ["DELETE", "/billing/sales/:id"],
          ["PUT", "/billing/settings"],
          ["POST", "/billing/sales/:id/confirm"]
        ])
          await assert.rejects(
            authorizeBillingRequest(request(method!, url!), name, "user@example.test")
          );
        withBillingScope(
          { companyId: 1, financialYearId: 1, canEditFinalizedEntries: false },
          () => {
            assert.doesNotThrow(() => assertBillingEntryEditable("draft", "sales", "draft"));
            assert.throws(
              () => assertBillingEntryEditable("confirmed", "sales", "confirmed"),
              /Only draft/u
            );
            assert.throws(
              () => assertBillingEntryEditable("draft", "sales", "confirmed"),
              /administrator/u
            );
          }
        );
        const administrator = await authorizeBillingRequest(
          request("DELETE", "/billing/sales/:id"),
          name,
          "admin@example.test"
        );
        assert.equal(administrator.canEditFinalizedEntries, true);
        withBillingScope({ companyId: 1, financialYearId: 1, canEditFinalizedEntries: true }, () =>
          assert.doesNotThrow(() => assertBillingEntryEditable("confirmed", "sales", "confirmed"))
        );
      }
    );
    await t.test(
      "CRM User grants retain read/create and revoke stale edit/delete permissions",
      async () => {
        for (const action of ["view", "create", "update", "delete"]) {
          await admin.query(
            "INSERT INTO app_permissions(uuid,`key`,label,status) VALUES(?,?,?,'active')",
            [randomBytes(4).toString("hex"), `crm.enquiry.${action}`, action]
          );
        }
        await admin.query(
          "INSERT INTO app_role_permissions(uuid,role_id,permission_id,status) SELECT LEFT(MD5(CONCAT('crm:',p.id)),8),r.id,p.id,'active' FROM app_roles r JOIN app_permissions p ON p.`key` LIKE 'crm.%' WHERE r.`key`='user'"
        );
        await seedCrmUserAccess(db as unknown as Kysely<unknown>);
        const [allowed] = await admin.query<RowDataPacket[]>(
          "SELECT p.`key` FROM app_role_permissions rp JOIN app_permissions p ON p.id=rp.permission_id JOIN app_roles r ON r.id=rp.role_id WHERE r.`key`='user' AND rp.status='active' AND p.`key` LIKE 'crm.%' ORDER BY p.`key`"
        );
        assert.deepEqual(
          allowed.map((p) => p.key),
          ["crm.enquiry.create", "crm.enquiry.view"]
        );
        assert.deepEqual(crmRecordReadRoles("crm.enquiry.update"), ["admin", "super-admin"]);
        assert.deepEqual(crmRecordReadRoles("crm.enquiry.delete"), ["admin", "super-admin"]);
        assert.equal(crmRecordReadRoles("crm.enquiry.create"), null);
      }
    );
    await t.test(
      "Billing create services reject finalized payloads for a standard User",
      async () => {
        const { SalesService } =
          await import("../../apps/billing/api/src/modules/sales/sales.service.js");
        const { PurchaseService } =
          await import("../../apps/billing/api/src/modules/purchase/purchase.service.js");
        const { QuotationService } =
          await import("../../apps/billing/api/src/modules/quotation/quotation.service.js");
        const { ExportSalesService } =
          await import("../../apps/billing/api/src/modules/export-sales/export-sales.service.js");
        await withBillingScope(
          { companyId: 1, financialYearId: 1, canEditFinalizedEntries: false },
          async () => {
            for (const create of [
              () => new SalesService().createSale(name, { status: "confirmed" } as never),
              () => new PurchaseService().create(name, { status: "confirmed" } as never),
              () => new QuotationService().create(name, { status: "confirmed" } as never),
              () =>
                new ExportSalesService().createExportSale(name, { status: "confirmed" } as never)
            ])
              await assert.rejects(create, /administrator/u);
          }
        );
      }
    );
    await t.test(
      "CRM SOP draft revisions are editable while published revisions remain unchanged",
      async () => {
        const sopDb = db as unknown as Kysely<SopDatabase>;
        const itemDb = db as unknown as Kysely<SopItemDatabase>;
        await migrateSopModule(sopDb);
        await migrateSopItemModule(itemDb);
        await seedSopPermissions(sopDb);
        await seedCrmUserAccess(db as unknown as Kysely<unknown>);
        await admin.query(
          "INSERT INTO crm_sops(code,title,purpose,created_by,updated_by) VALUES('FIXTURE','Fixture','Test','test','test')"
        );
        await admin.query(
          "INSERT INTO crm_sop_items(sop_id,code,title,frequency,created_by,updated_by) VALUES(1,'ITEM','Item','daily','test','test')"
        );
        await admin.query(
          "INSERT INTO crm_sop_item_revisions(sop_item_id,revision,instructions,evidence_guidance,status,author) VALUES(1,1,'Initial','Evidence','draft','test'),(1,2,'Published original','Evidence','published','test')"
        );
        const repository = new SopItemRepository(itemDb);
        assert.equal(
          (
            await repository.updateRevision(1, 1, {
              instructions: "Draft changed",
              evidenceGuidance: "Evidence"
            })
          )?.instructions,
          "Draft changed"
        );
        assert.equal(
          await repository.updateRevision(1, 2, {
            instructions: "Must not change",
            evidenceGuidance: "Evidence"
          }),
          null
        );
        const [published] = await admin.query<RowDataPacket[]>(
          "SELECT instructions FROM crm_sop_item_revisions WHERE id=2"
        );
        assert.equal(published[0]!.instructions, "Published original");
        assert.equal(crmRecordReadRoles("crm.sop.revision.update-draft"), null);
        const [allowed] = await admin.query<RowDataPacket[]>(
          "SELECT rp.id FROM app_role_permissions rp JOIN app_roles r ON r.id=rp.role_id JOIN app_permissions p ON p.id=rp.permission_id WHERE r.`key`='user' AND rp.status='active' AND p.`key`='crm.sop.revision.update-draft'"
        );
        assert.equal(allowed.length, 1);
      }
    );
    await t.test(
      "credential transfer requires an active mapped company and financial year",
      async () => {
        const database = db as unknown as Kysely<unknown>;
        assert.equal(await hasActiveTransferCompanyContext(database), true);
        await admin.query("UPDATE core_companies SET status='suspend' WHERE id=1");
        assert.equal(await hasActiveTransferCompanyContext(database), false);
        await admin.query("UPDATE core_companies SET status='active' WHERE id=1");
        await admin.query("UPDATE core_financial_years SET status='inactive' WHERE id=1");
        assert.equal(await hasActiveTransferCompanyContext(database), false);
        await admin.query("UPDATE core_financial_years SET status='active' WHERE id=1");
      }
    );
  } finally {
    await closeAllBillingDatabases();
    await closeCoreDatabase();
    await db?.destroy();
    await admin.changeUser({ database: "information_schema" });
    await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin.end();
  }
});
