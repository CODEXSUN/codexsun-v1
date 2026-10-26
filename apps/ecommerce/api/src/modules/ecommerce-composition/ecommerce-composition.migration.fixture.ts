import { canonicalStoredOptionSignature } from "../product-variant/product-variant.identity.js";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  DummyDriver,
  Kysely,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type QueryResult
} from "kysely";
import type { MigrationLedgerEntry } from "@codexsun/framework/db";
import type { EcommerceDatabase } from "../../database/ecommerce-database.js";

export function historicalLedger(lineage: "legacy31" | "stable34") {
  const fixtures = JSON.parse(
    readFileSync(new URL("./fixtures/ecommerce-migration-ledgers.json", import.meta.url), "utf8")
  ) as Record<"legacy31" | "stable34", MigrationLedgerEntry[]>;
  return fixtures[lineage];
}

type StoredRow = MigrationLedgerEntry & { applied_at: string; updated_at: string };

/** In-memory SQL boundary. Never opens a socket or uses a database server. */
export class MigrationFixture extends DummyDriver {
  readonly rows = new Map<string, StoredRow>();
  readonly statements: string[] = [];
  readonly ledgerWrites: string[] = [];
  readonly locks = new Set<string>();
  scopeReads = 0;
  readonly queries: CompiledQuery[] = [];
  variantRows: Record<string, string | number>[] = [];

  constructor(ledger: readonly MigrationLedgerEntry[]) {
    super();
    for (const row of ledger)
      this.rows.set(row.name, { ...row, applied_at: "historical", updated_at: "historical" });
  }

  database() {
    return new Kysely<EcommerceDatabase>({
      dialect: {
        createDriver: () => this,
        createAdapter: () => new MysqlAdapter(),
        createQueryCompiler: () => new MysqlQueryCompiler(),
        createIntrospector: (database) => new MysqlIntrospector(database)
      }
    });
  }

  override async acquireConnection(): Promise<DatabaseConnection> {
    return {
      executeQuery: async <Row>(query: CompiledQuery): Promise<QueryResult<Row>> => ({
        rows: this.execute(query) as Row[]
      }),
      async *streamQuery<Row>(): AsyncIterableIterator<QueryResult<Row>> {
        yield { rows: [] };
      }
    };
  }

  private execute(query: CompiledQuery): object[] {
    const text = query.sql.replace(/\s+/g, " ").trim();
    const parameters = query.parameters;
    this.statements.push(text);
    this.queries.push(query);
    if (text.includes("GET_LOCK")) {
      this.locks.add(String(parameters[0]));
      return [{ acquired: 1 }];
    }
    if (text.includes("RELEASE_LOCK")) {
      this.locks.delete(String(parameters[0]));
      return [{ released: 1 }];
    }
    if (text.includes("information_schema.TABLES")) return [{ table_name: "migration_schema" }];
    if (text.startsWith("SELECT scope, batch, checksum")) {
      const lock =
        "codexsun:migration:" +
        createHash("sha256").update("ecommerce.modules:1").digest("hex").slice(0, 24);
      if (!this.locks.has(lock)) {
        throw new Error("Lineage selection must hold the scope lock.");
      }
      this.scopeReads += 1;
      return [...this.rows.values()].map((row) => ({ ...row }));
    }
    if (text.startsWith("SELECT checksum, name, status, version")) {
      const row = this.rows.get(String(parameters[1]));
      return row ? [{ ...row }] : [];
    }
    if (text.startsWith("INSERT INTO")) {
      const name = String(parameters[4]);
      this.ledgerWrites.push(name);
      this.rows.set(name, {
        scope: String(parameters[1]),
        batch: Number(parameters[2]),
        version: Number(parameters[3]),
        name,
        checksum: String(parameters[5]),
        status: String(parameters[7]) as MigrationLedgerEntry["status"],
        applied_at: "new",
        updated_at: "new"
      });
      return [];
    }
    if (text.startsWith("SELECT id,") && text.includes("FROM ecommerce_product_variants")) {
      return this.variantRows.map((row) => ({
        ...row,
        ...(text.includes("AS databaseSignature")
          ? { databaseSignature: canonicalStoredOptionSignature(row as never) }
          : {})
      }));
    }
    if (/SELECT COUNT\(/i.test(text)) return [{ count: 0 }];
    return [];
  }
}
