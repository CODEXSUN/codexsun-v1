import { DatabaseSync } from "node:sqlite";
import { Kysely, SqliteDialect } from "kysely";

type ProviderRow = {
  id: string;
  endpoint: string;
  model: string;
  encrypted_secret: string | null;
  updated_at: string;
};
type Database = { providers: ProviderRow };

// Adapt Node's built-in SQLite driver to Kysely's SQLite interface.
export async function openProviderDatabase(path: string) {
  const sqlite = new DatabaseSync(path);
  const adapter = {
    close: () => sqlite.close(),
    prepare: (sql: string) => {
      const statement = sqlite.prepare(sql);
      return {
        reader: statement.columns().length > 0,
        all: (parameters: readonly unknown[]) => statement.all(...parameters as never[]),
        run: (parameters: readonly unknown[]) => statement.run(...parameters as never[]),
        iterate: (parameters: readonly unknown[]) => statement.iterate(...parameters as never[])
      };
    }
  };
  const db = new Kysely<Database>({ dialect: new SqliteDialect({ database: adapter }) });
  await db.schema.createTable("providers").ifNotExists()
    .addColumn("id", "text", (column) => column.primaryKey())
    .addColumn("endpoint", "text", (column) => column.notNull())
    .addColumn("model", "text", (column) => column.notNull())
    .addColumn("encrypted_secret", "text")
    .addColumn("updated_at", "text", (column) => column.notNull())
    .execute();
  return db;
}
