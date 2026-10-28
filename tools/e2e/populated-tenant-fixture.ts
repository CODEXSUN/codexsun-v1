import assert from "node:assert/strict";
import type { Connection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

const appPrefixes = {
  application: "app_",
  core: "core_",
  qcafe: "qcafe_",
  marketing: "marketing_",
  hrms: "hrms_",
  docs: "docs_",
  sites: "sites_",
  ecommerce: "ecommerce_",
  tconnect: "tconnect_",
  sportsclub: "sportsclub_",
  crm: "crm_",
  frappe: "frappe_",
  auditor: "auditor_",
  zetro: "zetro_",
  billing: "billing_",
  accounts: "accounts_",
  mail: "mail_",
  notes: "notes_",
  chat: "chat_",
  "task-manager": "task_manager_",
  codexsun: "codexsun_",
  blog: "blogs_"
} as const;

type Column = RowDataPacket & {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  COLUMN_TYPE: string;
  IS_NULLABLE: string;
  COLUMN_DEFAULT: string | null;
  EXTRA: string;
  CHARACTER_MAXIMUM_LENGTH: number | null;
};
type Snapshot = { app: string; table: string; id: number; row: RowDataPacket };

export async function populateTenantFixture(connection: Connection, database: string) {
  assert.match(database, /^codexsun_all_[a-z0-9_]+$/u);
  const [tables] = await connection.query<RowDataPacket[]>(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE' ORDER BY LENGTH(TABLE_NAME),TABLE_NAME",
    [database]
  );
  const snapshots: Snapshot[] = [];
  for (const [app, prefix] of Object.entries(appPrefixes)) {
    const candidates = tables
      .map((row) => String(row.TABLE_NAME))
      .filter(
        (name) => name.startsWith(prefix) && !/(activity|_audit|outbox|queue|migration)/u.test(name)
      );
    const problems: string[] = [];
    for (const table of candidates) {
      try {
        const row = await insertFixtureRow(connection, database, table, snapshots.length + 1);
        if (row) {
          snapshots.push({ app, table, ...row });
          break;
        }
      } catch (error) {
        problems.push(`${table}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    assert.ok(
      snapshots.some((snapshot) => snapshot.app === app),
      `No populated fixture row for ${app}; ${problems.slice(0, 3).join("; ")}`
    );
  }
  return snapshots;
}

export async function assertTenantFixtureUnchanged(
  connection: Connection,
  database: string,
  snapshots: Snapshot[]
) {
  for (const snapshot of snapshots) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM ${identifier(database)}.${identifier(snapshot.table)} WHERE id=?`,
      [snapshot.id]
    );
    assert.deepEqual(rows[0], snapshot.row, `${snapshot.app} record changed in ${snapshot.table}`);
  }
}

async function insertFixtureRow(
  connection: Connection,
  database: string,
  table: string,
  index: number
) {
  const [columns] = await connection.query<Column[]>(
    "SELECT COLUMN_NAME,DATA_TYPE,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION",
    [database, table]
  );
  if (
    !columns.some(
      (column) => column.COLUMN_NAME === "id" && column.EXTRA.includes("auto_increment")
    )
  )
    return null;
  const [foreign] = await connection.query<RowDataPacket[]>(
    "SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND REFERENCED_TABLE_NAME IS NOT NULL",
    [database, table]
  );
  const foreignNames = new Set(foreign.map((row) => row.COLUMN_NAME));
  const required = columns.filter(
    (column) =>
      column.IS_NULLABLE === "NO" &&
      column.COLUMN_DEFAULT === null &&
      !column.EXTRA.includes("auto_increment") &&
      !column.EXTRA.includes("GENERATED")
  );
  if (required.some((column) => foreignNames.has(column.COLUMN_NAME))) return null;
  const values = required.map((column) => fixtureValue(column, index));
  if (values.some((value) => value === undefined)) return null;
  const names = required.map((column) => identifier(column.COLUMN_NAME)).join(",");
  const placeholders = required.map(() => "?").join(",");
  const [insert] = await connection.query<ResultSetHeader>(
    `INSERT INTO ${identifier(database)}.${identifier(table)} (${names}) VALUES (${placeholders})`,
    values
  );
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT * FROM ${identifier(database)}.${identifier(table)} WHERE id=?`,
    [insert.insertId]
  );
  assert.ok(rows[0]);
  return { id: insert.insertId, row: rows[0] };
}

function fixtureValue(column: Column, index: number): string | number | Buffer | undefined {
  if (column.DATA_TYPE === "enum") return column.COLUMN_TYPE.match(/^enum\('([^']+)'/u)?.[1];
  if (
    /^(tinyint|smallint|mediumint|int|integer|bigint|decimal|float|double|bit)$/u.test(
      column.DATA_TYPE
    )
  )
    return index;
  if (/^(date|datetime|timestamp)$/u.test(column.DATA_TYPE))
    return column.DATA_TYPE === "date" ? "2020-01-02" : "2020-01-02 03:04:05";
  if (column.DATA_TYPE === "time") return "03:04:05";
  if (/^(binary|varbinary|blob|tinyblob|mediumblob|longblob)$/u.test(column.DATA_TYPE))
    return Buffer.from("fixture");
  if (/^(char|varchar|text|tinytext|mediumtext|longtext|json)$/u.test(column.DATA_TYPE)) {
    if (column.COLUMN_NAME.includes("json") || column.DATA_TYPE === "json") return "{}";
    const value = `f${index.toString(16).padStart(7, "0")}`;
    return value.slice(0, column.CHARACTER_MAXIMUM_LENGTH || value.length);
  }
  return undefined;
}

function identifier(value: string) {
  assert.match(value, /^[a-zA-Z0-9_]+$/u);
  return `\`${value}\``;
}
