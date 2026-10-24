import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface DatabaseOptions {
  dbPath?: string | undefined;
  inMemory?: boolean | undefined;
}

export class CodeitDatabase {
  public readonly db: DatabaseSync;
  public readonly dbPath: string;

  constructor(options: DatabaseOptions = {}) {
    if (options.inMemory || options.dbPath === ":memory:") {
      this.dbPath = ":memory:";
      this.db = new DatabaseSync(":memory:");
    } else {
      const defaultPath = resolve(process.cwd(), ".codeit", "storage", "codeit.db");
      this.dbPath = options.dbPath ? resolve(options.dbPath) : defaultPath;
      mkdirSync(dirname(this.dbPath), { recursive: true });
      this.db = new DatabaseSync(this.dbPath);
    }

    this.configure();
  }

  private configure(): void {
    this.db.exec("PRAGMA foreign_keys = ON;");
    if (this.dbPath !== ":memory:") {
      try {
        this.db.exec("PRAGMA journal_mode = WAL;");
      } catch {
        // In environments where WAL is not permitted, retain default journal
      }
    }
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string) {
    return this.db.prepare(sql);
  }

  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN TRANSACTION;");
    try {
      const result = fn();
      this.db.exec("COMMIT;");
      return result;
    } catch (err) {
      try {
        this.db.exec("ROLLBACK;");
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  close(): void {
    try {
      if (this.dbPath !== ":memory:") {
        try {
          this.db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
        } catch {
          // ignore checkpoint errors
        }
      }
      this.db.close();
    } catch {
      // ignore close errors if already closed
    }
  }
}
