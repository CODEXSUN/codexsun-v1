import assert from "node:assert/strict";
import { test } from "node:test";
import { LocalCodexGateway } from "./codex-gateway.js";
import type { CodexTransport, RpcMessage } from "./codex-rpc.js";

class TestTransport implements CodexTransport {
  onEvent: (message: RpcMessage) => void = () => {};
  onDisconnect: (reason: string) => void = () => {};
  calls: { method: string; params: unknown }[] = [];
  replies: unknown[] = [];
  closed = false;
  failure: string | undefined;
  async connect() {}
  async request(method: string, params: unknown) {
    this.calls.push({ method, params });
    if (method === this.failure) throw new Error("Test transport failure");
    if (method === "thread/list")
      return { data: [{ id: "chat-1", name: "CRM", cwd: "D:/crm", status: { type: "idle" } }] };
    if (method === "thread/resume")
      return { thread: { id: "chat-1", cwd: "D:/crm", status: { type: "idle" } } };
    return { turn: { id: "turn-1" } };
  }
  respond(id: string | number, result: unknown) {
    this.replies.push({ id, result });
  }
  reject(id: string | number, message: string) {
    this.replies.push({ id, error: message });
  }
  close() {
    this.closed = true;
    this.onDisconnect("Transport closed");
  }
}

test("resumes the selected chat, preserves permission defaults, and records only its final response", async () => {
  const transport = new TestTransport();
  const gateway = new LocalCodexGateway(new TestTransport(), () => transport);
  const messages: string[] = [];
  const statuses: string[] = [];
  const approvals: string[] = [];
  assert.equal((await gateway.listChats())[0]?.name, "CRM");
  assert.equal(
    await gateway.send("chat-1", "Review safely", {
      message: (text) => messages.push(text),
      finished: (status) => statuses.push(status),
      approval: (approval) => approvals.push(approval.id)
    }),
    "turn-1"
  );
  const start = transport.calls.find((call) => call.method === "turn/start");
  assert.deepEqual(start?.params, {
    threadId: "chat-1",
    input: [{ type: "text", text: "Review safely", text_elements: [] }]
  });
  transport.onEvent({
    method: "item/completed",
    params: {
      threadId: "other",
      turnId: "turn-1",
      item: { type: "agentMessage", text: "Wrong chat" }
    }
  });
  transport.onEvent({
    method: "item/completed",
    params: {
      threadId: "chat-1",
      turnId: "turn-1",
      item: { type: "agentMessage", text: "Final result", phase: "final_answer" }
    }
  });
  transport.onEvent({
    id: 42,
    method: "item/fileChange/requestApproval",
    params: { threadId: "chat-1", turnId: "turn-1", reason: "Update file" }
  });
  assert.deepEqual(transport.replies, []);
  assert.deepEqual(approvals, ["42"]);
  assert.throws(() => gateway.decide("other", "42", "accept"));
  transport.onEvent({
    id: 43,
    method: "item/commandExecution/requestApproval",
    params: { threadId: "chat-1", turnId: "turn-1", command: "Run tests" }
  });
  assert.deepEqual(approvals, ["42"]);
  gateway.decide("chat-1", "42", "decline");
  assert.deepEqual(approvals, ["42", "43"]);
  assert.deepEqual(transport.replies, [{ id: 42, result: { decision: "decline" } }]);
  gateway.decide("chat-1", "43", "decline");
  transport.onEvent({
    method: "turn/completed",
    params: { threadId: "chat-1", turn: { id: "turn-1", status: "completed" } }
  });
  assert.deepEqual(messages, ["Final result"]);
  assert.deepEqual(statuses, ["completed"]);
  assert.equal(transport.closed, true);
  assert.equal((await gateway.listChats())[0]?.busy, false);
});

test("marks a disconnected run interrupted rather than completed", async () => {
  const transport = new TestTransport();
  const gateway = new LocalCodexGateway(new TestTransport(), () => transport);
  let result = "";
  await gateway.send("chat-1", "Review", {
    message: () => {},
    approval: () => {},
    finished: (status, error) => {
      result = `${status}: ${error}`;
    }
  });
  transport.onDisconnect("Connection lost");
  assert.equal(result, "interrupted: Connection lost");
  assert.equal(transport.closed, true);
});

test("releases each terminal run without interrupting another chat", async () => {
  for (const status of ["completed", "failed", "interrupted"]) {
    const discovery = new TestTransport();
    const first = new TestTransport();
    const second = new TestTransport();
    const transports = [first, second];
    const gateway = new LocalCodexGateway(discovery, () => transports.shift()!);
    const outcomes: string[] = [];
    const observer = {
      message: () => {},
      approval: () => {},
      finished: (value: string) => outcomes.push(value)
    };
    await gateway.send("chat-1", "Reply", observer);
    await gateway.send("chat-2", "Reply", observer);
    first.onEvent({
      method: "turn/completed",
      params: { threadId: "chat-1", turn: { id: "turn-1", status } }
    });
    assert.equal(first.closed, true);
    assert.equal(second.closed, false);
    assert.equal(discovery.closed, false);
    assert.deepEqual(outcomes, [status]);
    gateway.close();
    assert.equal(second.closed, true);
    assert.deepEqual(outcomes, [status, "interrupted"]);
  }
});

test("releases a resumed chat when sending fails and allows a later attempt", async () => {
  const first = new TestTransport();
  first.failure = "turn/start";
  const second = new TestTransport();
  const transports = [first, second];
  const gateway = new LocalCodexGateway(new TestTransport(), () => transports.shift()!);
  const outcomes: string[] = [];
  const observer = {
    message: () => {},
    approval: () => {},
    finished: (value: string) => outcomes.push(value)
  };
  await assert.rejects(gateway.send("chat-1", "Reply", observer), /Test transport failure/);
  assert.equal(first.closed, true);
  assert.deepEqual(outcomes, []);
  await gateway.send("chat-1", "Retry", observer);
  first.onEvent({
    method: "turn/completed",
    params: { threadId: "chat-1", turn: { id: "turn-1", status: "completed" } }
  });
  assert.equal(second.closed, false);
  assert.deepEqual(outcomes, []);
  gateway.close();
});
