import assert from "node:assert/strict";
import type { Connection, RowDataPacket } from "mysql2/promise";

export async function moduleSetting(connection: Connection, moduleKey: string) {
  const row = await firstRow(
    connection,
    "SELECT enabled,status FROM app_module_settings WHERE module_key=?",
    [moduleKey]
  );
  assert.ok(row, `Tenant module setting "${moduleKey}" is missing.`);
  return row;
}

export async function setCatalogViewPermission(connection: Connection, status: "active" | "inactive") {
  const [result] = await connection.execute(
    "UPDATE app_role_permissions rolePermission INNER JOIN app_roles role ON role.id=rolePermission.role_id INNER JOIN app_permissions permission ON permission.id=rolePermission.permission_id SET rolePermission.status=? WHERE role.`key`='admin' AND permission.`key`='ecommerce.catalog.view'",
    [status]
  );
  const affectedRows = Number((result as { affectedRows?: number }).affectedRows ?? 0);
  assert.equal(affectedRows, 1, `The live permission could not be set to ${status}.`);
}

export async function firstRow(
  connection: Connection,
  statement: string,
  params: Array<string | number | null> = []
): Promise<Record<string, unknown> | undefined> {
  const rows = await queryRows(connection, statement, params);
  return rows[0] as Record<string, unknown> | undefined;
}

export async function queryRows(
  connection: Connection,
  statement: string,
  params: Array<string | number | null> = []
): Promise<RowDataPacket[]> {
  const [rows] = await connection.query(statement, params);
  return rows as RowDataPacket[];
}

export async function scalar(
  connection: Connection,
  statement: string,
  params: Array<string | number | null> = []
) {
  const row = await firstRow(connection, statement, params);
  if (!row) return 0;
  return Number(Object.values(row)[0] ?? 0);
}

export function catalogTitles(response: { json: () => unknown }) {
  const body = response.json() as {
    data?: Array<Record<string, unknown>> | { items?: Array<Record<string, unknown>> };
  };
  const rows = Array.isArray(body.data) ? body.data : body.data?.items;
  assert.ok(Array.isArray(rows), "Expected a contract-route data page or array.");
  return rows.map((row) => String(row.name ?? row.storefrontTitle ?? ""));
}
