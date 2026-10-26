import type { Connection } from "mysql2/promise";

export async function migrateLegacyPreparation(stage: Connection) {
  await stage.query(`CREATE TABLE bridge_legacy_prepared_rows (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      phase VARCHAR(16) NOT NULL, source_table VARCHAR(80) NOT NULL,
      source_key VARCHAR(120) NOT NULL, target_table VARCHAR(80) NOT NULL,
      source_json JSON NOT NULL, prepared_json JSON NOT NULL, issues_json JSON NOT NULL,
      stage_id INT NULL, existing_target_id INT NULL,
      status VARCHAR(24) NOT NULL, execution_authorized TINYINT NOT NULL DEFAULT 0,
      UNIQUE KEY legacy_row_identity(source_table,source_key,target_table)
    ) ENGINE=InnoDB`);
  await stage.query(`CREATE TABLE bridge_legacy_mappings (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      phase VARCHAR(16) NOT NULL, source_table VARCHAR(80) NOT NULL,
      source_key VARCHAR(80) NOT NULL, target_table VARCHAR(80) NOT NULL,
      columns_json JSON NOT NULL, UNIQUE KEY legacy_mapping(source_table,target_table)
    ) ENGINE=InnoDB`);
}
