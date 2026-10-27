import { AppError } from "../../../../../../packages/framework/src/errors/app-error.js";
import { PromptManagerRepository } from "./prompt-manager.repository.js";
import { promptPayload, type CodexGateway, type PromptPayload } from "./prompt-manager.types.js";

export class PromptManagerService {
  constructor(
    private readonly repository: PromptManagerRepository,
    private readonly codex: CodexGateway
  ) {}

  list() {
    return this.repository.list();
  }
  recentRuns() {
    return this.repository.recentRuns();
  }
  chats() {
    return this.codex.listChats();
  }
  detail(id: string) {
    const prompt = this.repository.get(id);
    if (!prompt) throw AppError.notFound("Prompt not found");
    return { prompt, runs: this.repository.runs(id), activity: this.repository.activity(id) };
  }

  async save(input: PromptPayload, id?: string) {
    const existing = id ? this.detail(id).prompt : undefined;
    const value = promptPayload.parse(input);
    if (value.threadId && value.threadId !== existing?.threadId) {
      const chat = (await this.chats()).find((chat) => chat.id === value.threadId);
      if (!chat) throw AppError.validation("Choose an available Codex chat");
      value.threadName = chat.name;
    } else value.threadName = value.threadId ? (existing?.threadName ?? "") : "";
    if (
      this.list().some(
        (prompt) => prompt.id !== id && prompt.title.toLowerCase() === value.title.toLowerCase()
      )
    )
      throw AppError.conflict("A prompt with this title already exists");
    const pending =
      id &&
      this.repository.runs(id).some((run) => ["running", "awaiting-approval"].includes(run.status));
    if (pending && !value.active)
      throw AppError.conflict("Wait for the current run before suspending this prompt");
    try {
      return this.repository.save(value, id);
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint"))
        throw AppError.conflict("A prompt with this title already exists");
      throw error;
    }
  }

  remove(id: string) {
    this.detail(id);
    if (this.repository.runs(id).length)
      throw AppError.conflict("This prompt has run history. Suspend it to preserve the history.");
    this.repository.remove(id);
    return { deleted: true };
  }

  async send(id: string, threadId: string, expectedUpdatedAt: string) {
    this.detail(id);
    const chat = (await this.chats()).find((chat) => chat.id === threadId);
    if (!chat) throw AppError.notFound("The selected chat is no longer available");
    if (chat.busy) throw AppError.conflict("This chat is already working. Wait for it to finish.");
    const { prompt } = this.detail(id);
    if (!prompt.active) throw AppError.conflict("Restore this prompt before sending");
    if (prompt.updatedAt !== expectedUpdatedAt)
      throw AppError.conflict("This prompt changed. Refresh and review it before sending.");
    let run;
    try {
      run = this.repository.createRun(id, chat.id, chat.name, prompt.content);
    } catch {
      throw AppError.conflict("This chat already has an active prompt run");
    }
    const runId = run.id;
    try {
      const turnId = await this.codex.send(chat.id, prompt.content, {
        message: (response) => this.repository.updateRun(runId, { response }),
        approval: (approval) =>
          this.repository.updateRun(runId, { status: "awaiting-approval", approval }),
        finished: (status, error = "") => {
          this.repository.updateRun(runId, {
            status,
            error,
            approval: null,
            completedAt: new Date().toISOString()
          });
          this.repository.audit(id, `Run ${status}${error ? `: ${error}` : ""}`);
        }
      });
      this.repository.updateRun(runId, { turnId });
    } catch (error) {
      this.repository.updateRun(runId, {
        status: "failed",
        error: error instanceof Error ? error.message : "Could not send prompt",
        completedAt: new Date().toISOString()
      });
    }
    return this.repository.run(runId)!;
  }

  decide(runId: string, approvalId: string, decision: "accept" | "decline") {
    const run = this.repository.run(runId);
    if (!run || run.status !== "awaiting-approval" || run.approval?.id !== approvalId)
      throw AppError.conflict("This approval request is no longer pending");
    this.repository.updateRun(runId, { status: "running", approval: null });
    try {
      this.codex.decide(run.threadId, approvalId, decision);
    } catch (error) {
      this.repository.updateRun(runId, { status: run.status, approval: run.approval });
      throw error;
    }
    this.repository.audit(
      run.promptId,
      decision === "accept" ? "Codex action approved" : "Codex action declined"
    );
    return this.repository.run(runId)!;
  }
}
