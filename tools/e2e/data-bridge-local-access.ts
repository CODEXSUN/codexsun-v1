import assert from "node:assert/strict";
import type { Connection, RowDataPacket } from "mysql2/promise";
import type { FastifyRequest } from "fastify";
import { authorizeCoreRequest } from "../../apps/core/api/src/auth/tenant-permission.js";
import { authorizeBillingRequest } from "../../apps/billing/api/src/auth/tenant-permission.js";
import {
  assertBillingEntryEditable,
  withBillingScope
} from "../../apps/billing/api/src/auth/billing-scope.js";

export async function verifyLocalClientAccess(target: Connection, database: string) {
  const [users] = await target.query<RowDataPacket[]>(
    "SELECT email FROM app_users WHERE status='active' ORDER BY id"
  );
  const request = (method: string, url: string) =>
    ({ method, url, routeOptions: { url } }) as FastifyRequest;
  for (const user of users) {
    for (const method of ["GET", "POST"])
      await authorizeCoreRequest(request(method, "/core/products"), database, user.email);
    for (const method of ["PUT", "DELETE"])
      await assert.rejects(
        authorizeCoreRequest(request(method, "/core/products/:id"), database, user.email)
      );
    const access = await authorizeBillingRequest(
      request("PUT", "/billing/sales/:id"),
      database,
      user.email
    );
    assert.equal(access.canEditEntries, true);
    assert.equal(access.canEditFinalizedEntries, false);
    for (const [method, route] of [
      ["DELETE", "/billing/sales/:id"],
      ["POST", "/billing/sales/:id/confirm"],
      ["PUT", "/billing/settings"]
    ])
      await assert.rejects(authorizeBillingRequest(request(method!, route!), database, user.email));
    withBillingScope({ companyId: 1, financialYearId: 1, canEditFinalizedEntries: false }, () => {
      assert.doesNotThrow(() => assertBillingEntryEditable("draft", "sales", "draft"));
      assert.throws(() => assertBillingEntryEditable("confirmed", "sales"));
      assert.throws(() => assertBillingEntryEditable("draft", "sales", "confirmed"));
    });
    const [roles] = await target.query<RowDataPacket[]>(
      "SELECT r.`key` FROM app_users u JOIN app_user_roles ur ON ur.user_id=u.id AND ur.status='active' JOIN app_roles r ON r.id=ur.role_id WHERE u.email=?",
      [user.email]
    );
    assert.deepEqual(
      roles.map((row) => row.key),
      ["user"],
      "Runtime boot must not elevate copied accounts"
    );
    const [crm] = await target.query<RowDataPacket[]>(
      "SELECT p.`key` FROM app_permissions p JOIN app_role_permissions rp ON rp.permission_id=p.id AND rp.status='active' JOIN app_roles r ON r.id=rp.role_id WHERE r.`key`='user' AND p.status='active' AND p.`key` IN ('crm.enquiry.create','crm.enquiry.update','crm.enquiry.delete')"
    );
    assert.deepEqual(
      crm.map((row) => row.key),
      ["crm.enquiry.create"]
    );
  }
  return {
    activeUsersChecked: users.length,
    draftOnlyEdits: true,
    adminMutationsDenied: true,
    runtimeRolesPreserved: true
  };
}
