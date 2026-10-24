import type { DatabaseSync } from "node:sqlite";

export interface Migration {
  name: string;
  up: (db: DatabaseSync) => void;
}

export const migrations: Migration[] = [
  {
    name: "001_core_codeit_schema",
    up: (db: DatabaseSync) => {
      // 1. Projects
      db.exec(`
        CREATE TABLE IF NOT EXISTS codeit_projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          root_path TEXT NOT NULL UNIQUE,
          trust_state TEXT NOT NULL DEFAULT 'untrusted',
          policy_revision TEXT NOT NULL DEFAULT '1.0.0',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_codeit_projects_uuid ON codeit_projects(uuid);
        CREATE INDEX IF NOT EXISTS idx_codeit_projects_root_path ON codeit_projects(root_path);
      `);

      // 2. Conversations
      db.exec(`
        CREATE TABLE IF NOT EXISTS codeit_conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT NOT NULL UNIQUE,
          project_uuid TEXT NOT NULL,
          title TEXT NOT NULL,
          selected_mode TEXT NOT NULL DEFAULT 'plan',
          archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_uuid) REFERENCES codeit_projects (uuid) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_codeit_conversations_uuid ON codeit_conversations(uuid);
        CREATE INDEX IF NOT EXISTS idx_codeit_conversations_project_uuid ON codeit_conversations(project_uuid);
      `);

      // 3. Messages
      db.exec(`
        CREATE TABLE IF NOT EXISTS codeit_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT NOT NULL UNIQUE,
          conversation_uuid TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          request_key TEXT,
          completion_state TEXT NOT NULL DEFAULT 'draft',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (conversation_uuid) REFERENCES codeit_conversations (uuid) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_codeit_messages_uuid ON codeit_messages(uuid);
        CREATE INDEX IF NOT EXISTS idx_codeit_messages_conversation_uuid ON codeit_messages(conversation_uuid);
      `);

      // 4. Runs
      db.exec(`
        CREATE TABLE IF NOT EXISTS codeit_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT NOT NULL UNIQUE,
          project_uuid TEXT NOT NULL,
          conversation_uuid TEXT NOT NULL,
          mode TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'queued',
          cancellation_generation INTEGER NOT NULL DEFAULT 0,
          budget TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_uuid) REFERENCES codeit_projects (uuid) ON DELETE CASCADE,
          FOREIGN KEY (conversation_uuid) REFERENCES codeit_conversations (uuid) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_codeit_runs_uuid ON codeit_runs(uuid);
        CREATE INDEX IF NOT EXISTS idx_codeit_runs_project_uuid ON codeit_runs(project_uuid);
        CREATE INDEX IF NOT EXISTS idx_codeit_runs_conversation_uuid ON codeit_runs(conversation_uuid);
      `);

      // 5. Run Events
      db.exec(`
        CREATE TABLE IF NOT EXISTS codeit_run_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_uuid TEXT NOT NULL,
          seq INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          correlation_id TEXT,
          created_at TEXT NOT NULL,
          UNIQUE (run_uuid, seq),
          FOREIGN KEY (run_uuid) REFERENCES codeit_runs (uuid) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_codeit_run_events_run_uuid ON codeit_run_events(run_uuid);
      `);

      // 6. Artifacts
      db.exec(`
        CREATE TABLE IF NOT EXISTS codeit_artifacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT NOT NULL UNIQUE,
          run_uuid TEXT,
          artifact_type TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          relative_storage_key TEXT NOT NULL,
          byte_size INTEGER NOT NULL,
          media_type TEXT NOT NULL DEFAULT 'text/plain',
          provenance TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_codeit_artifacts_uuid ON codeit_artifacts(uuid);
        CREATE INDEX IF NOT EXISTS idx_codeit_artifacts_content_hash ON codeit_artifacts(content_hash);
      `);

      // 7. Assignments
      db.exec(`
        CREATE TABLE IF NOT EXISTS codeit_assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT NOT NULL UNIQUE,
          run_uuid TEXT NOT NULL,
          task_id TEXT NOT NULL,
          worker_id TEXT NOT NULL,
          dependencies TEXT NOT NULL DEFAULT '[]',
          lease_generation INTEGER NOT NULL DEFAULT 0,
          lease_expiry TEXT NOT NULL,
          allowed_paths TEXT NOT NULL DEFAULT '[]',
          attempt INTEGER NOT NULL DEFAULT 1,
          state TEXT NOT NULL DEFAULT 'assigned',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (run_uuid) REFERENCES codeit_runs (uuid) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_codeit_assignments_uuid ON codeit_assignments(uuid);
      `);

      // 8. Tool Invocations
      db.exec(`
        CREATE TABLE IF NOT EXISTS codeit_tool_invocations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT NOT NULL UNIQUE,
          run_uuid TEXT NOT NULL,
          assignment_uuid TEXT,
          tool_name TEXT NOT NULL,
          tool_version TEXT NOT NULL,
          arguments_hash TEXT NOT NULL,
          arguments_payload TEXT NOT NULL DEFAULT '{}',
          grant_uuid TEXT,
          state TEXT NOT NULL DEFAULT 'proposed',
          result_artifact_uuid TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (run_uuid) REFERENCES codeit_runs (uuid) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_codeit_tool_invocations_uuid ON codeit_tool_invocations(uuid);
      `);

      // 9. Approvals
      db.exec(`
        CREATE TABLE IF NOT EXISTS codeit_approvals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT NOT NULL UNIQUE,
          action_digest TEXT NOT NULL,
          project_uuid TEXT NOT NULL,
          run_uuid TEXT NOT NULL,
          expiry TEXT NOT NULL,
          actor TEXT NOT NULL,
          decision TEXT NOT NULL,
          constraints TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_uuid) REFERENCES codeit_projects (uuid) ON DELETE CASCADE,
          FOREIGN KEY (run_uuid) REFERENCES codeit_runs (uuid) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_codeit_approvals_uuid ON codeit_approvals(uuid);
      `);

      // 10. Plugin Installs
      db.exec(`
        CREATE TABLE IF NOT EXISTS codeit_plugin_installs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT NOT NULL UNIQUE,
          plugin_id TEXT NOT NULL,
          version TEXT NOT NULL,
          manifest_digest TEXT NOT NULL,
          enabled_state TEXT NOT NULL DEFAULT 'installed',
          grants TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_codeit_plugin_installs_uuid ON codeit_plugin_installs(uuid);
      `);

      // 11. Personal Facts
      db.exec(`
        CREATE TABLE IF NOT EXISTS codeit_personal_facts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uuid TEXT NOT NULL UNIQUE,
          scope TEXT NOT NULL,
          owner_id TEXT NOT NULL,
          fact_key TEXT NOT NULL,
          fact_value TEXT NOT NULL,
          source TEXT NOT NULL,
          confirmation_state TEXT NOT NULL DEFAULT 'unconfirmed',
          verified_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_codeit_personal_facts_uuid ON codeit_personal_facts(uuid);
      `);
    }
  }
];

export function runMigrations(db: DatabaseSync): { applied: string[]; alreadyApplied: string[] } {
  // Ensure migration ledger table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS migration_schema (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare("SELECT batch_name FROM migration_schema").all() as { batch_name: string }[];
  const appliedSet = new Set(appliedRows.map((r) => r.batch_name));

  const newlyApplied: string[] = [];
  const alreadyApplied: string[] = [];

  for (const migration of migrations) {
    if (appliedSet.has(migration.name)) {
      alreadyApplied.push(migration.name);
      continue;
    }

    db.exec("BEGIN TRANSACTION;");
    try {
      migration.up(db);
      db.prepare("INSERT INTO migration_schema (batch_name, applied_at) VALUES (?, ?);").run(
        migration.name,
        new Date().toISOString()
      );
      db.exec("COMMIT;");
      newlyApplied.push(migration.name);
    } catch (err) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // ignore rollback error
      }
      throw new Error(`Migration ${migration.name} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { applied: newlyApplied, alreadyApplied };
}
