import { AsyncLocalStorage } from "node:async_hooks";
import { createConnection } from "mysql2/promise";
import { env } from "../env.js";
import { assertDatabaseName } from "./database-utils.js";
import { withReleaseMigrationLock } from "./migration-release-lock.js";

type LockContext = { active: boolean };
const context = new AsyncLocalStorage<LockContext>();

export async function withCoordinatedMigration<T>(run: () => Promise<T>): Promise<T> {
  if (context.getStore()?.active) return run();
  const connection = await createConnection({
    host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD
  });
  try {
    return await withReleaseMigrationLock(connection, assertDatabaseName(env.DB_MASTER_NAME), async () => {
      const scope = { active: true };
      try {
        return await context.run(scope, run);
      } finally {
        scope.active = false;
      }
    });
  } finally {
    await connection.end();
  }
}
