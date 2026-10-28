import { createHash } from "node:crypto";
import type { Connection, RowDataPacket } from "mysql2/promise";

export async function withReleaseMigrationLock<T>(
  connection: Pick<Connection, "query">,
  masterDatabase: string,
  run: () => Promise<T>
): Promise<T> {
  const suffix = createHash("sha256").update(masterDatabase).digest("hex").slice(0, 32);
  const name = `codexsun:release:${suffix}`;
  const [rows] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK(?, 0) AS acquired", [name]);
  if (Number(rows[0]?.acquired) !== 1) throw new Error("Another migration release is running.");
  try {
    return await run();
  } finally {
    await connection.query("SELECT RELEASE_LOCK(?)", [name]);
  }
}
