import type { Connection, RowDataPacket } from "mysql2/promise";

export async function bindLegacyPreparationContext(
  stage: Connection,
  sourceDatabase: string,
  targetDatabase: string
) {
  if (sourceDatabase === targetDatabase) throw new Error("Source and target must differ.");
  await stage.query(`CREATE TABLE IF NOT EXISTS bridge_legacy_context (
      singleton_key TINYINT NOT NULL PRIMARY KEY, source_database VARCHAR(120) NOT NULL,
      target_database VARCHAR(120) NOT NULL, execution_authorized TINYINT NOT NULL DEFAULT 0,
      CHECK (singleton_key=1), CHECK (execution_authorized=0)
    ) ENGINE=InnoDB`);
  const [rows] = await stage.query<RowDataPacket[]>(
    "SELECT * FROM bridge_legacy_context WHERE singleton_key=1"
  );
  if (
    rows.length &&
    (rows[0]!.source_database !== sourceDatabase ||
      rows[0]!.target_database !== targetDatabase ||
      rows[0]!.execution_authorized !== 0)
  )
    throw new Error("Preparation routing changed; refuse to reuse this staging context.");
  if (!rows.length)
    await stage.execute(
      "INSERT INTO bridge_legacy_context(singleton_key,source_database,target_database) VALUES(1,?,?)",
      [sourceDatabase, targetDatabase]
    );
}
