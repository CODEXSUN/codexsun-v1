import type { DatabaseSync } from "node:sqlite";

export function migratePromptManager(db: DatabaseSync) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS codeit_prompts (
      id TEXT PRIMARY KEY, title TEXT NOT NULL COLLATE NOCASE UNIQUE,
      category TEXT NOT NULL, content TEXT NOT NULL, thread_id TEXT NOT NULL,
      thread_name TEXT NOT NULL, active INTEGER NOT NULL CHECK(active IN (0,1)),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS codeit_prompt_runs (
      id TEXT PRIMARY KEY, prompt_id TEXT NOT NULL REFERENCES codeit_prompts(id),
      thread_id TEXT NOT NULL, thread_name TEXT NOT NULL, turn_id TEXT,
      content TEXT NOT NULL, status TEXT NOT NULL, response TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT '', started_at TEXT NOT NULL, completed_at TEXT,
      approval TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS codeit_prompt_running_thread
      ON codeit_prompt_runs(thread_id) WHERE status IN ('running','awaiting-approval');
    CREATE INDEX IF NOT EXISTS codeit_prompt_runs_prompt ON codeit_prompt_runs(prompt_id,started_at);
    CREATE TABLE IF NOT EXISTS codeit_prompt_activity (
      id INTEGER PRIMARY KEY, prompt_id TEXT NOT NULL,
      action TEXT NOT NULL, created_at TEXT NOT NULL
    );
  `);
}
