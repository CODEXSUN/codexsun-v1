import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  activityRecord,
  promptRecord,
  runRecord,
  runSummary,
  type PromptPayload,
  type PromptRun
} from "./prompt-manager.types.js";

export class PromptManagerRepository {
  constructor(private readonly db: DatabaseSync) {}

  list() {
    return this.db
      .prepare(
        `SELECT id,title,category,content,thread_id AS threadId,
      thread_name AS threadName,active,created_at AS createdAt,updated_at AS updatedAt
      FROM codeit_prompts ORDER BY updated_at DESC`
      )
      .all()
      .map((row) => promptRecord.parse({ ...row, active: Boolean(row.active) }));
  }

  get(id: string) {
    return this.list().find((prompt) => prompt.id === id);
  }

  save(value: PromptPayload, id: string = randomUUID()) {
    const now = new Date().toISOString();
    this.transaction(() => {
      const previous = this.get(id);
      this.db
        .prepare(
          `INSERT INTO codeit_prompts VALUES(?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title,category=excluded.category,
        content=excluded.content,thread_id=excluded.thread_id,thread_name=excluded.thread_name,
        active=excluded.active,updated_at=excluded.updated_at`
        )
        .run(
          id,
          value.title,
          value.category,
          value.content,
          value.threadId,
          value.threadName,
          Number(value.active),
          now,
          now
        );
      this.audit(
        id,
        !previous
          ? "Prompt created"
          : previous.active !== value.active
            ? value.active
              ? "Prompt restored"
              : "Prompt suspended"
            : "Prompt updated"
      );
    });
    return this.get(id)!;
  }

  remove(id: string) {
    this.transaction(() => {
      this.audit(id, `Prompt deleted: ${this.get(id)?.title ?? id}`);
      this.db.prepare("DELETE FROM codeit_prompts WHERE id=?").run(id);
    });
  }

  runs(id: string) {
    return this.db
      .prepare(
        `SELECT id,prompt_id AS promptId,thread_id AS threadId,
      thread_name AS threadName,turn_id AS turnId,content,status,response,error,
      started_at AS startedAt,completed_at AS completedAt,approval FROM codeit_prompt_runs
      WHERE prompt_id=? ORDER BY started_at DESC`
      )
      .all(id)
      .map((row) =>
        runRecord.parse({
          ...row,
          approval: row.approval ? JSON.parse(String(row.approval)) : null
        })
      );
  }

  run(id: string) {
    const row = this.db.prepare("SELECT prompt_id FROM codeit_prompt_runs WHERE id=?").get(id);
    return row ? this.runs(String(row.prompt_id)).find((run) => run.id === id) : undefined;
  }

  recentRuns() {
    return this.db
      .prepare(
        `SELECT r.id,r.prompt_id AS promptId,p.title AS promptTitle,
      r.thread_name AS threadName,r.status,r.started_at AS startedAt,r.completed_at AS completedAt
      FROM codeit_prompt_runs r JOIN codeit_prompts p ON p.id=r.prompt_id
      ORDER BY r.started_at DESC LIMIT 100`
      )
      .all()
      .map((row) => runSummary.parse(row));
  }

  createRun(promptId: string, threadId: string, threadName: string, content: string) {
    const id = randomUUID();
    this.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO codeit_prompt_runs
        (id,prompt_id,thread_id,thread_name,content,status,started_at)
        VALUES(?,?,?,?,?,'running',?)`
        )
        .run(id, promptId, threadId, threadName, content, new Date().toISOString());
      this.audit(promptId, `Prompt sent to ${threadName}`);
    });
    return this.run(id)!;
  }

  updateRun(
    id: string,
    patch: Partial<
      Pick<PromptRun, "status" | "turnId" | "response" | "error" | "completedAt" | "approval">
    >
  ) {
    const run = this.run(id);
    if (!run) return;
    const next = { ...run, ...patch };
    this.db
      .prepare(
        `UPDATE codeit_prompt_runs SET status=?,turn_id=?,response=?,error=?,
      completed_at=?,approval=? WHERE id=?`
      )
      .run(
        next.status,
        next.turnId,
        next.response,
        next.error,
        next.completedAt,
        next.approval ? JSON.stringify(next.approval) : null,
        id
      );
  }

  recoverInterrupted() {
    this.db
      .prepare(
        `UPDATE codeit_prompt_runs SET status='interrupted',approval=NULL,
      error='CodeIt stopped before completion was confirmed. Check the chat before sending again.',
      completed_at=? WHERE status IN ('running','awaiting-approval')`
      )
      .run(new Date().toISOString());
  }

  activity(id: string) {
    return this.db
      .prepare(
        `SELECT id,action,created_at AS createdAt FROM codeit_prompt_activity
      WHERE prompt_id=? ORDER BY id DESC`
      )
      .all(id)
      .map((row) => activityRecord.parse(row));
  }

  audit(id: string, action: string) {
    this.db
      .prepare("INSERT INTO codeit_prompt_activity(prompt_id,action,created_at) VALUES(?,?,?)")
      .run(id, action, new Date().toISOString());
  }

  private transaction(action: () => void) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      action();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}
