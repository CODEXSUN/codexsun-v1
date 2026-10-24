import type { FastifyRequest } from "fastify";
import { sql } from "kysely";
import { AppError } from "@codexsun/framework/errors";
import { getBillingDatabase } from "../database/billing-database.js";

export async function authorizeBillingRequest(
  request: FastifyRequest,
  databaseName: string,
  actorEmail: string
) {
  const permission = billingPermission(request);
  await authorizeBillingPermission(databaseName, actorEmail, permission);
  const database = await getBillingDatabase(databaseName);
  const roleResult = await sql<{ role_key: string }>`
    SELECT role.\`key\` AS role_key
    FROM app_users actor
    INNER JOIN app_user_roles user_role ON user_role.user_id=actor.id AND user_role.status='active'
    INNER JOIN app_roles role ON role.id=user_role.role_id AND role.status='active'
    WHERE actor.email=${actorEmail} AND actor.status='active'
  `.execute(database);
  const canEditEntries = roleResult.rows.some((row) =>
    ["admin", "super-admin", "super_admin"].includes(row.role_key)
  );
  const route = request.routeOptions.url ?? request.url.split("?")[0]!;
  if (
    !canEditEntries &&
    (request.method === "PUT" || request.method === "PATCH") &&
    !/\/billing\/(sales|purchases|quotations|export-sales|receipts|payments)\/[^/]+$/u.test(route)
  )
    throw AppError.forbidden(
      "Only an administrator can change Billing settings or non-draft resources."
    );
  if (
    !canEditEntries &&
    [
      "billing.application.records.delete",
      "billing.application.records.lifecycle",
      "billing.application.records.compliance"
    ].includes(permission)
  )
    throw AppError.forbidden(
      "Only an administrator can delete or change Billing lifecycle/compliance."
    );
  const draftAccess = await sql<{
    id: number;
  }>`SELECT rp.id FROM app_users u JOIN app_user_roles ur ON ur.user_id=u.id AND ur.status='active' JOIN app_roles r ON r.id=ur.role_id AND r.status='active' JOIN app_role_permissions rp ON rp.role_id=r.id AND rp.status='active' JOIN app_permissions p ON p.id=rp.permission_id AND p.status='active' WHERE u.email=${actorEmail} AND u.status='active' AND p.\`key\`='billing.application.records.update' LIMIT 1`.execute(
    database
  );
  return {
    canEditEntries: canEditEntries || Boolean(draftAccess.rows.length),
    canEditFinalizedEntries: canEditEntries
  };
}

function billingPermission(request: FastifyRequest) {
  const method = request.method.toUpperCase();
  const route = request.routeOptions.url ?? request.url;
  if (method === "GET" || method === "HEAD") return "billing.application.records.view";
  if (
    route.includes("/einvoice/") ||
    route.includes("/eway/") ||
    route.includes("/compliance-jobs/")
  ) {
    return "billing.application.records.compliance";
  }
  if (/\/(confirm|cancel|revoke|post|convert-to-sale)$/.test(route)) {
    return "billing.application.records.lifecycle";
  }
  if (method === "POST") return "billing.application.records.create";
  if (method === "PUT" || method === "PATCH") return "billing.application.records.update";
  return "billing.application.records.delete";
}

export async function authorizeBillingPermission(
  databaseName: string,
  actorEmail: string,
  permission: string
) {
  const database = await getBillingDatabase(databaseName);
  const result = await sql<{ id: number }>`
    SELECT permission.id
    FROM app_users actor
    INNER JOIN app_user_roles user_role ON user_role.user_id=actor.id AND user_role.status='active'
    INNER JOIN app_roles role ON role.id=user_role.role_id AND role.status='active'
    INNER JOIN app_role_permissions role_permission ON role_permission.role_id=role.id AND role_permission.status='active'
    INNER JOIN app_permissions permission ON permission.id=role_permission.permission_id AND permission.status='active'
    WHERE actor.email=${actorEmail} AND actor.status='active' AND permission.key=${permission}
  `.execute(database);
  if (!result.rows.length) throw AppError.forbidden(`Permission ${permission} is required.`);
}
