import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCodeitApi } from "../../app.js";
import type { CodexGateway, RunObserver } from "./prompt-manager.types.js";

class TestCodex implements CodexGateway {
  observer: RunObserver | undefined;
  sent: string[] = [];
  decisions: string[] = [];
  async listChats() {
    return [{ id: "chat-1", name: "CRM development", cwd: "D:/workspace/crm", busy: false }];
  }
  async send(_threadId: string, content: string, observer: RunObserver) {
    this.sent.push(content);
    this.observer = observer;
    return "turn-1";
  }
  decide(_threadId: string, approvalId: string, decision: "accept" | "decline") {
    this.decisions.push(`${approvalId}:${decision}`);
  }
  close() {}
}
const base = "/api/codeit/prompt-manager";
const headers = { host: "127.0.0.1:7070", "x-codeit-request": "1" };
const input = {
  title: "Focused review",
  category: "Review",
  content: "Review the current diff. Preserve unrelated work.",
  threadId: "chat-1",
  threadName: "CRM development",
  active: true
};

test("persists prompts across restarts, validates updates, and audits lifecycle changes", async () => {
  const directory = mkdtempSync(join(tmpdir(), "codexsun-codeit-prompts-"));
  const databasePath = join(directory, "prompts.sqlite");
  let app = await createCodeitApi({ databasePath, port: 7070, codex: new TestCodex() });
  try {
    const created = await app.inject({ method: "POST", url: base, headers, payload: input });
    assert.equal(created.statusCode, 200);
    const id = created.json().data.id;
    const duplicate = await app.inject({
      method: "POST",
      url: base,
      headers,
      payload: { ...input, title: "FOCUSED REVIEW" }
    });
    assert.equal(duplicate.statusCode, 409);
    const invalid = await app.inject({
      method: "PUT",
      url: `${base}/${id}`,
      headers,
      payload: { ...input, content: "   ", extra: true }
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(
      (await app.inject({ url: `${base}/${id}`, headers })).json().data.prompt.content,
      input.content
    );
    await app.close();
    app = await createCodeitApi({ databasePath, port: 7070, codex: new TestCodex() });
    assert.equal((await app.inject({ url: base, headers })).json().data.length, 1);
    await app.inject({
      method: "PUT",
      url: `${base}/${id}`,
      headers,
      payload: { ...input, active: false }
    });
    const detail = (await app.inject({ url: `${base}/${id}`, headers })).json().data;
    assert.equal(detail.prompt.active, false);
    assert.equal(detail.activity.length, 2);
    assert.equal(
      (await app.inject({ method: "DELETE", url: `${base}/${id}`, headers })).statusCode,
      200
    );
    assert.equal((await app.inject({ url: base, headers })).json().data.length, 0);
  } finally {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("sends an immutable snapshot, blocks duplicate runs, stores approval and completion", async () => {
  const codex = new TestCodex();
  const app = await createCodeitApi({ databasePath: ":memory:", port: 7070, codex });
  try {
    const id = (await app.inject({ method: "POST", url: base, headers, payload: input })).json()
      .data.id;
    const stale = await app.inject({
      method: "POST",
      url: `${base}/${id}/runs`,
      headers,
      payload: { threadId: "chat-1", expectedUpdatedAt: "2000-01-01T00:00:00.000Z" }
    });
    assert.equal(stale.statusCode, 409);
    assert.match(stale.json().error.message, /changed/);
    assert.equal(codex.sent.length, 0);
    const sent = await app.inject({
      method: "POST",
      url: `${base}/${id}/runs`,
      headers,
      payload: {
        threadId: "chat-1",
        expectedUpdatedAt: (await app.inject({ url: `${base}/${id}`, headers })).json().data.prompt
          .updatedAt
      }
    });
    const run = sent.json().data;
    assert.equal(run.status, "running");
    assert.deepEqual(codex.sent, [input.content]);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `${base}/${id}/runs`,
          headers,
          payload: {
            threadId: "chat-1",
            expectedUpdatedAt: (await app.inject({ url: `${base}/${id}`, headers })).json().data
              .prompt.updatedAt
          }
        })
      ).statusCode,
      409
    );
    codex.observer!.approval({
      id: "42",
      method: "item/commandExecution/requestApproval",
      description: "Run focused tests"
    });
    assert.equal(
      (await app.inject({ url: `${base}/${id}`, headers })).json().data.runs[0].status,
      "awaiting-approval"
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `${base}/runs/${run.id}/approval`,
          headers,
          payload: { approvalId: "wrong", decision: "accept" }
        })
      ).statusCode,
      409
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `${base}/runs/${run.id}/approval`,
          headers,
          payload: { approvalId: "42", decision: "decline" }
        })
      ).statusCode,
      200
    );
    assert.deepEqual(codex.decisions, ["42:decline"]);
    await app.inject({
      method: "PUT",
      url: `${base}/${id}`,
      headers,
      payload: { ...input, content: "Changed for the next run" }
    });
    codex.observer!.message("Review complete. Two findings.");
    codex.observer!.finished("completed");
    const detail = (await app.inject({ url: `${base}/${id}`, headers })).json().data;
    assert.equal(detail.runs[0].content, input.content);
    assert.equal(detail.runs[0].response, "Review complete. Two findings.");
    assert.equal(detail.runs[0].status, "completed");
    assert.equal(
      (await app.inject({ url: `${base}/runs`, headers })).json().data[0].status,
      "completed"
    );
    assert.ok(detail.runs[0].completedAt);
    assert.equal(
      (await app.inject({ method: "DELETE", url: `${base}/${id}`, headers })).statusCode,
      409
    );
    await app.inject({
      method: "PUT",
      url: `${base}/${id}`,
      headers,
      payload: { ...input, active: false }
    });
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `${base}/${id}/runs`,
          headers,
          payload: {
            threadId: "chat-1",
            expectedUpdatedAt: (await app.inject({ url: `${base}/${id}`, headers })).json().data
              .prompt.updatedAt
          }
        })
      ).statusCode,
      409
    );
  } finally {
    await app.close();
  }
});

test("recovers interrupted runs without resending saved prompts", async () => {
  const directory = mkdtempSync(join(tmpdir(), "codexsun-codeit-recovery-"));
  const databasePath = join(directory, "prompts.sqlite");
  const codex = new TestCodex();
  let app = await createCodeitApi({ databasePath, port: 7070, codex });
  try {
    const id = (await app.inject({ method: "POST", url: base, headers, payload: input })).json()
      .data.id;
    await app.inject({
      method: "POST",
      url: `${base}/${id}/runs`,
      headers,
      payload: {
        threadId: "chat-1",
        expectedUpdatedAt: (await app.inject({ url: `${base}/${id}`, headers })).json().data.prompt
          .updatedAt
      }
    });
    await app.close();
    app = await createCodeitApi({ databasePath, port: 7070, codex });
    const run = (await app.inject({ url: `${base}/${id}`, headers })).json().data.runs[0];
    assert.equal(run.status, "interrupted");
    assert.match(run.error, /Check the chat/);
    assert.equal(codex.sent.length, 1);
  } finally {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects foreign hosts, foreign origins, and browser writes without the request header", async () => {
  const app = await createCodeitApi({
    databasePath: ":memory:",
    port: 7070,
    codex: new TestCodex()
  });
  try {
    assert.equal(
      (await app.inject({ url: base, headers: { host: "attacker.test:7070" } })).statusCode,
      403
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: base,
          headers: { ...headers, origin: "https://attacker.test" },
          payload: input
        })
      ).statusCode,
      403
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: base,
          headers: { host: headers.host },
          payload: input
        })
      ).statusCode,
      403
    );
    assert.equal((await app.inject({ url: base, headers })).json().data.length, 0);
  } finally {
    await app.close();
  }
});
