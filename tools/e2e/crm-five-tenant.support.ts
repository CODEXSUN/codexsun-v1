import assert from "node:assert/strict";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { env } from "../../apps/platform/api/src/env.js";

export type Fixture = {
  code: string;
  dbName: string;
  tenantId: string;
  adminEmail: string;
  readerEmail: string;
  existingContactId: number;
  freshContactId: number;
  existingRecordId: string;
  freshRecordId: string;
  foreignOnlyId: number;
  foreignContactId: number;
  records: number;
};
type Reply = {
  status: number;
  ms: number;
  data: any;
  meta: { tenantId?: string };
  error?: unknown;
};

export const results: Array<{ name: string; tenant: string; ms: number; status: number }> = [];

export async function login(fixture: Fixture, reader = false) {
  const result = await request("/auth/login", undefined, {
    method: "POST",
    body: {
      desk: "tenant",
      corporateId: fixture.code,
      email: reader ? fixture.readerEmail : fixture.adminEmail,
      password: env.DEFAULT_TENANT_ADMIN_PASSWORD
    }
  });
  assert.equal(result.status, 200, `${fixture.code} login failed`);
  assert.equal(result.data.tenantCode, fixture.code);
  return result.data.accessToken as string;
}

export async function checked(
  fixture: Fixture,
  name: string,
  path: string,
  token: string,
  options: Parameters<typeof request>[2] = {}
) {
  const result = await request(path, token, options);
  results.push({ name, tenant: fixture.code, ms: Math.round(result.ms), status: result.status });
  assert.equal(result.status, 200, `${fixture.code} ${name}: ${JSON.stringify(result.error)}`);
  return result;
}

export async function request(
  path: string,
  token?: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<Reply> {
  const at = performance.now();
  const response = await fetch(`http://127.0.0.1:17210${path}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-auth-token-delivery": "bearer",
      "x-company-id": "1",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    signal: AbortSignal.timeout(20_000)
  });
  return {
    ...((await response.json()) as Omit<Reply, "status" | "ms">),
    status: response.status,
    ms: performance.now() - at
  };
}

export async function snapshots(connections: Map<string, Connection>) {
  return Object.fromEntries(
    await Promise.all(
      [...connections].map(async ([code, connection]) => {
        const [rows] = await connection.query(
          "SELECT id,title,contact_id,description,due_date,priority_id FROM crm_enquiries WHERE id=1"
        );
        return [code, rows];
      })
    )
  );
}
