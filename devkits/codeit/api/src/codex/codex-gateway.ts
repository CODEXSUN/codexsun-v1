import { z } from "zod";
import { CodexRpc, type RpcMessage, type CodexTransport } from "./codex-rpc.js";
import type { CodexGateway, RunObserver, RunApproval } from "../modules/prompt-manager/index.js";

const threadSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  preview: z.string().optional(),
  cwd: z.string().default(""),
  status: z.object({ type: z.string() }).optional()
});
const eventSchema = z.object({
  threadId: z.string().optional(),
  turnId: z.string().optional(),
  turn: z
    .object({
      id: z.string(),
      status: z.string(),
      error: z.object({ message: z.string() }).nullish()
    })
    .optional(),
  item: z
    .object({ type: z.string(), text: z.string().optional(), phase: z.string().nullish() })
    .optional()
});
type ActiveRun = {
  observer: RunObserver;
  turnId?: string;
  messages: string[];
  transport: CodexTransport;
};

export class LocalCodexGateway implements CodexGateway {
  private readonly active = new Map<string, ActiveRun>();
  private readonly approvals = new Map<
    string,
    { threadId: string; rpcId: string | number; value: RunApproval }
  >();

  constructor(
    private readonly rpc: CodexTransport = new CodexRpc(),
    private readonly createRunTransport: () => CodexTransport = () => new CodexRpc()
  ) {}

  async listChats() {
    await this.rpc.connect();
    const result = z.object({ data: z.array(threadSchema) }).parse(
      await this.rpc.request("thread/list", {
        limit: 100,
        sortKey: "updated_at",
        archived: false
      })
    );
    return result.data.map((thread) => ({
      id: thread.id,
      name: thread.name || thread.preview?.slice(0, 120) || thread.id,
      cwd: thread.cwd,
      busy: thread.status?.type === "active" || this.active.has(thread.id)
    }));
  }

  async send(threadId: string, content: string, observer: RunObserver) {
    if (this.active.has(threadId)) throw new Error("This chat already has an active run");
    // A run owns its process so releasing one chat cannot stop another chat's work.
    const transport = this.createRunTransport();
    const run: ActiveRun = { observer, messages: [], transport };
    this.active.set(threadId, run);
    transport.onEvent = (message) => {
      if (this.active.get(threadId) === run) this.event(message, transport, threadId);
    };
    transport.onDisconnect = (reason) => {
      if (this.active.get(threadId) !== run) return;
      this.release(threadId, run);
      observer.finished("interrupted", reason);
    };
    try {
      await transport.connect();
      const resumed = z
        .object({ thread: threadSchema })
        .parse(await transport.request("thread/resume", { threadId, excludeTurns: true }));
      if (resumed.thread.status?.type === "active") throw new Error("This chat is already working");
      const result = z.object({ turn: z.object({ id: z.string() }) }).parse(
        await transport.request("turn/start", {
          threadId,
          input: [{ type: "text", text: content, text_elements: [] }]
        })
      );
      run.turnId = result.turn.id;
      return result.turn.id;
    } catch (error) {
      this.release(threadId, run);
      throw error;
    }
  }

  decide(threadId: string, approvalId: string, decision: "accept" | "decline") {
    const approval = this.approvals.get(approvalId);
    const run = this.active.get(threadId);
    if (!approval || approval.threadId !== threadId || !run)
      throw new Error("Codex approval expired. Check the chat.");
    run.transport.respond(approval.rpcId, { decision });
    this.approvals.delete(approvalId);
    const next = [...this.approvals.values()].find((approval) => approval.threadId === threadId);
    if (next) this.active.get(threadId)?.observer.approval(next.value);
  }

  close() {
    this.rpc.close();
    for (const [threadId, run] of [...this.active]) {
      this.release(threadId, run);
      run.observer.finished(
        "interrupted",
        "CodeIt disconnected from Codex. Check the chat before sending again."
      );
    }
  }

  private release(threadId: string, run: ActiveRun) {
    if (this.active.get(threadId) !== run) return;
    this.active.delete(threadId);
    for (const [id, approval] of this.approvals)
      if (approval.threadId === threadId) this.approvals.delete(id);
    run.transport.close();
  }

  private event(message: RpcMessage, transport: CodexTransport, expectedThreadId: string) {
    const parsed = eventSchema.safeParse(message.params);
    if (!parsed.success) return;
    const data = parsed.data;
    const threadId = data.threadId;
    const run = threadId === expectedThreadId ? this.active.get(threadId) : undefined;
    if (run?.turnId && data.turnId && run.turnId !== data.turnId) {
      if (message.id !== undefined)
        transport.reject(message.id, "This approval does not belong to the active CodeIt run");
      return;
    }
    if (message.id !== undefined && message.method) {
      if (
        !run ||
        !threadId ||
        !["item/commandExecution/requestApproval", "item/fileChange/requestApproval"].includes(
          message.method
        )
      ) {
        transport.reject(
          message.id,
          "This request requires review in Codex; CodeIt cannot approve this capability."
        );
        return;
      }
      const id = String(message.id);
      const value = {
        id,
        method: message.method,
        description: JSON.stringify(message.params, null, 2)
      };
      const alreadyPending = [...this.approvals.values()].some(
        (approval) => approval.threadId === threadId
      );
      this.approvals.set(id, { threadId, rpcId: message.id, value });
      if (!alreadyPending) run.observer.approval(value);
      return;
    }
    if (!run || !threadId) return;
    if (run.turnId && data.turnId && run.turnId !== data.turnId) return;
    if (
      message.method === "item/completed" &&
      data.item?.type === "agentMessage" &&
      data.item.text
    ) {
      if (data.item.phase !== "commentary") run.messages.push(data.item.text);
      run.observer.message(run.messages.join("\n\n"));
    }
    if (
      message.method === "turn/completed" &&
      data.turn &&
      (!run.turnId || run.turnId === data.turn.id)
    ) {
      const status =
        data.turn.status === "completed"
          ? "completed"
          : data.turn.status === "interrupted"
            ? "interrupted"
            : "failed";
      try {
        run.observer.finished(status, data.turn.error?.message);
      } finally {
        this.release(threadId, run);
      }
    }
  }
}
