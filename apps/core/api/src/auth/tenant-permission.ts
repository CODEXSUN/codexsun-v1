import type { FastifyRequest } from "fastify";
import { sql } from "kysely";
import { AppError } from "@codexsun/framework/errors";
import { getCoreDatabase } from "../database/core-database.js";

export async function authorizeCoreRequest(
  request: FastifyRequest,
  databaseName: string,
  actorEmail: string
) {
  const permission = corePermission(request);
  const result = await sql<{ id: number }>`
    SELECT permission.id
    FROM app_users actor
    INNER JOIN app_user_roles user_role ON user_role.user_id=actor.id AND user_role.status='active'
    INNER JOIN app_roles role ON role.id=user_role.role_id AND role.status='active'
    INNER JOIN app_role_permissions role_permission ON role_permission.role_id=role.id AND role_permission.status='active'
    INNER JOIN app_permissions permission ON permission.id=role_permission.permission_id AND permission.status='active'
    WHERE actor.email=${actorEmail} AND actor.status='active' AND permission.key=${permission}
    AND (${permission} IN ('core.application.records.view','core.application.records.create') OR role.\`key\` IN ('admin','super-admin','super_admin'))
    LIMIT 1
  `.execute(getCoreDatabase(databaseName));
  if (!result.rows[0]) throw AppError.forbidden(`Permission ${permission} is required.`);
}

function corePermission(request: FastifyRequest) {
  const method = request.method.toUpperCase();
  const route = request.routeOptions.url ?? request.url;
  if (method === "GET" || method === "HEAD") return "core.application.records.view";
  if (/\/(activate|deactivate|suspend|restore|force)$/.test(route)) {
    return "core.application.records.lifecycle";
  }
  if (method === "POST") return "core.application.records.create";
  if (method === "PUT" || method === "PATCH") return "core.application.records.update";
  return "core.application.records.delete";
}
