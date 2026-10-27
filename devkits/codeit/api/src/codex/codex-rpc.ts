import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { z } from "zod";

const messageSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string().optional(),
  params: z.unknown().optional(),
  result: z.unknown().optional(),
  error: z.object({ message: z.string() }).optional()
});
export type RpcMessage = z.infer<typeof messageSchema>;
export interface CodexTransport {
  onEvent: (message: RpcMessage) => void;
  onDisconnect: (reason: string) => void;
  connect(): Promise<void>;
  request(method: string, params: unknown): Promise<unknown>;
  respond(id: string | number, result: unknown): void;
  reject(id: string | number, message: string): void;
  close(): void;
}
type Pending = { resolve(value: unknown): void; reject(error: Error): void; timer: NodeJS.Timeout };

export class CodexRpc implements CodexTransport {
  private process: ChildProcessWithoutNullStreams | undefined;
  private ready: Promise<void> | undefined;
  private sequence = 0;
  private pending = new Map<number, Pending>();
  onEvent: (message: RpcMessage) => void = () => {};
  onDisconnect: (reason: string) => void = () => {};

  async connect() {
    if (!this.ready)
      this.ready = this.initialize().catch((error) => {
        this.close();
        throw error;
      });
    return this.ready;
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex did not answer ${method}. Check Codex and try again.`));
      }, 30_000);
      timer.unref();
      this.pending.set(id, { resolve, reject, timer });
      this.write({ id, method, params });
    });
  }

  respond(id: string | number, result: unknown) {
    this.write({ id, result });
  }
  reject(id: string | number, message: string) {
    this.write({ id, error: { code: -32601, message } });
  }

  close() {
    const process = this.process;
    this.process = undefined;
    this.ready = undefined;
    process?.kill();
    this.fail("CodeIt disconnected from Codex. Check the chat before sending again.");
  }

  private async initialize() {
    // Launch a fixed executable and arguments; prompt text is never a shell command.
    const child = spawn("codex", ["app-server", "--stdio"], {
      windowsHide: true,
      stdio: "pipe",
      shell: false
    });
    this.process = child;
    child.stderr.on("data", () => {});
    child.stdin.on("error", () =>
      this.fail("The Codex connection closed. Check the chat before sending again.")
    );
    child.on("error", () =>
      this.fail("Codex CLI could not start. Install Codex and sign in, then reconnect.")
    );
    child.on("exit", () => {
      if (this.process !== child) return;
      this.process = undefined;
      this.ready = undefined;
      this.fail("Codex disconnected. Check the chat before sending again.");
    });
    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
    lines.on("line", (line) => this.receive(line));
    await this.request("initialize", {
      clientInfo: { name: "codexsun_codeit", title: "CodeIt Prompt Manager", version: "1.0.0" }
    });
    this.write({ method: "initialized", params: {} });
  }

  private receive(line: string) {
    let data: unknown;
    try {
      data = JSON.parse(line);
    } catch {
      return;
    }
    const parsed = messageSchema.safeParse(data);
    if (!parsed.success) return;
    const message = parsed.data;
    if (typeof message.id === "number" && !message.method) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    } else this.onEvent(message);
  }

  private write(value: unknown) {
    this.process?.stdin.write(`${JSON.stringify(value)}\n`);
  }

  private fail(reason: string) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pending.clear();
    this.onDisconnect(reason);
  }
}
