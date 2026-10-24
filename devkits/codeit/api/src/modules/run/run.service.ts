import { EventEmitter } from "node:events";
import { randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { InvalidStateError, NotFoundError, ValidationError } from "../../errors.js";
import { HexUuidSchema } from "../conversation/conversation.types.js";
import { ConversationRepository } from "../conversation/conversation.repository.js";
import { ConversationService } from "../conversation/conversation.service.js";
import type { ProviderService } from "../provider/provider.service.js";
import type { RunRepository } from "./run.repository.js";
import {
  type Budget,
  type CreateRunInput,
  CreateRunInputSchema,
  DEFAULT_BUDGET,
  type RunEvent,
  type RunRecord,
  type RunState,
  TERMINAL_STATES
} from "./run.types.js";

interface ActiveExecution {
  runUuid: string;
  generation: number;
  abortController: AbortController;
}

export class RunService {
  private readonly eventEmitter = new EventEmitter();
  private readonly activeExecutions = new Map<string, ActiveExecution>();
  private readonly conversationRepo: ConversationRepository;
  private readonly conversationService: ConversationService;

  constructor(
    private readonly repo: RunRepository,
    private readonly db: DatabaseSync,
    private readonly providerService?: ProviderService | undefined
  ) {
    this.conversationRepo = new ConversationRepository(this.db);
    this.conversationService = new ConversationService(this.conversationRepo, this.db);
    // Support large number of SSE client connections
    this.eventEmitter.setMaxListeners(1000);
  }

  private generateUniqueUuid(checkExists: (uuid: string) => boolean): string {
    for (let i = 0; i < 10; i++) {
      const candidate = randomBytes(4).toString("hex").toLowerCase();
      if (!checkExists(candidate)) {
        return candidate;
      }
    }
    throw new Error("Failed to generate unique Run UUID after multiple attempts");
  }

  getRunByUuid(uuid: string): RunRecord {
    const parseUuid = HexUuidSchema.safeParse(uuid);
    if (!parseUuid.success) {
      throw new ValidationError("Invalid run UUID format", { uuid });
    }

    const run = this.repo.findRunByUuid(parseUuid.data);
    if (!run) {
      throw new NotFoundError(`Run not found with UUID: ${uuid}`, { uuid });
    }
    return run;
  }

  listRunsByConversation(conversation_uuid: string): RunRecord[] {
    const parseUuid = HexUuidSchema.safeParse(conversation_uuid);
    if (!parseUuid.success) {
      throw new ValidationError("Invalid conversation UUID format", { conversation_uuid });
    }
    return this.repo.findRunsByConversation(parseUuid.data);
  }

  createRun(input: CreateRunInput, correlationId?: string): RunRecord {
    const parseResult = CreateRunInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new ValidationError("Invalid run input payload", {
        errors: parseResult.error.issues
      });
    }

    const { conversation_uuid, project_uuid, mode, budget } = parseResult.data;

    // 1. Verify conversation exists
    const conversation = this.conversationRepo.findConversationByUuid(conversation_uuid);
    if (!conversation) {
      throw new NotFoundError(`Conversation not found with UUID: ${conversation_uuid}`, {
        conversation_uuid
      });
    }

    const targetProjectUuid = project_uuid ?? conversation.project_uuid;
    const targetMode = mode ?? conversation.selected_mode ?? "plan";

    // 2. Validate merged budget
    const finalBudget: Budget = {
      max_duration_seconds: budget?.max_duration_seconds ?? DEFAULT_BUDGET.max_duration_seconds,
      max_output_bytes: budget?.max_output_bytes ?? DEFAULT_BUDGET.max_output_bytes,
      max_tool_invocations: budget?.max_tool_invocations ?? DEFAULT_BUDGET.max_tool_invocations,
      max_repair_attempts: budget?.max_repair_attempts ?? DEFAULT_BUDGET.max_repair_attempts
    };

    const uuid = this.generateUniqueUuid((cand) => Boolean(this.repo.findRunByUuid(cand)));
    const now = new Date().toISOString();

    const run = this.repo.insertRun({
      uuid,
      project_uuid: targetProjectUuid,
      conversation_uuid: conversation.uuid,
      mode: targetMode,
      state: "queued",
      cancellation_generation: 0,
      budget: finalBudget,
      created_at: now,
      updated_at: now
    });

    // Record initial run.created event
    const event = this.repo.insertEvent({
      run_uuid: run.uuid,
      seq: 1,
      event_type: "run.created",
      payload: {
        run_uuid: run.uuid,
        mode: run.mode,
        project_uuid: run.project_uuid,
        conversation_uuid: run.conversation_uuid,
        budget: run.budget
      },
      correlation_id: correlationId ?? null,
      created_at: now
    });

    this.emitLiveEvent(run.uuid, event);

    return run;
  }

  /**
   * Atomic state machine transition with event emission.
   * Throws 409 CODEIT_INVALID_STATE if transition violates invariants.
   */
  transitionState(
    run_uuid: string,
    targetState: RunState,
    options: {
      reason?: string | undefined;
      correlationId?: string | undefined;
      payload?: Record<string, unknown> | undefined;
    } = {}
  ): { run: RunRecord; event: RunEvent } {
    const parseUuid = HexUuidSchema.safeParse(run_uuid);
    if (!parseUuid.success) {
      throw new ValidationError("Invalid run UUID format", { run_uuid });
    }

    const run = this.getRunByUuid(parseUuid.data);

    // Invariant 1: Terminal states cannot transition to any other state
    if (TERMINAL_STATES.includes(run.state)) {
      throw new InvalidStateError(
        `Terminal state '${run.state}' cannot transition to '${targetState}'`,
        409,
        {
          run_uuid: run.uuid,
          current_state: run.state,
          target_state: targetState
        }
      );
    }

    // Invariant 4: Paused and blocked runs can only resume through 'queued'
    if (
      (run.state === "paused" || run.state === "blocked") &&
      targetState !== "queued" &&
      targetState !== "cancelling" &&
      targetState !== "failed"
    ) {
      throw new InvalidStateError(
        `Paused or blocked run must resume through 'queued' before entering '${targetState}'`,
        409,
        {
          run_uuid: run.uuid,
          current_state: run.state,
          target_state: targetState
        }
      );
    }

    const eventPayload: Record<string, unknown> = {
      ...(options.payload ?? {})
    };
    if (options.reason) {
      eventPayload.reason = options.reason;
    }

    const { run: updatedRun, event } = this.repo.transitionStateWithEvent(
      run.uuid,
      targetState,
      "state_changed",
      eventPayload,
      options.correlationId
    );

    this.emitLiveEvent(run.uuid, event);

    return { run: updatedRun, event };
  }

  /**
   * Cancellation:
   * 1. Increments cancellation_generation in SQLite.
   * 2. Invalidates active stream and execution controller (abort).
   * 3. Transitions state to 'cancelling' then 'cancelled'.
   * 4. Fences future events from previous generation.
   */
  cancelRun(
    run_uuid: string,
    reason = "User requested cancellation",
    correlationId?: string
  ): { cancelled: true; generation: number } {
    const parseUuid = HexUuidSchema.safeParse(run_uuid);
    if (!parseUuid.success) {
      throw new ValidationError("Invalid run UUID format", { run_uuid });
    }

    const run = this.getRunByUuid(parseUuid.data);

    // Cannot cancel if already in terminal state
    if (TERMINAL_STATES.includes(run.state)) {
      throw new InvalidStateError(
        `Cannot cancel run already in terminal state '${run.state}'`,
        409,
        { run_uuid: run.uuid, state: run.state }
      );
    }

    // 1. Increment generation
    const newGeneration = this.repo.incrementCancellationGeneration(run.uuid);

    // 2. Abort active execution if present
    const activeExec = this.activeExecutions.get(run.uuid);
    if (activeExec) {
      activeExec.abortController.abort();
      this.activeExecutions.delete(run.uuid);
    }

    // 3. State transitions: queued/planning/waiting/running/paused/blocked/verifying -> cancelling -> cancelled
    if (run.state !== "cancelling") {
      this.transitionState(run.uuid, "cancelling", {
        reason,
        correlationId,
        payload: { cancellation_generation: newGeneration }
      });
    }

    this.transitionState(run.uuid, "cancelled", {
      reason,
      correlationId,
      payload: { cancellation_generation: newGeneration }
    });

    // 4. Emit explicit run.cancelled event
    const now = new Date().toISOString();
    const nextSeq = this.repo.getNextEventSeq(run.uuid);
    const cancelEvent = this.repo.insertEvent({
      run_uuid: run.uuid,
      seq: nextSeq,
      event_type: "run.cancelled",
      payload: {
        reason,
        cancellation_generation: newGeneration
      },
      correlation_id: correlationId ?? null,
      created_at: now
    });

    this.emitLiveEvent(run.uuid, cancelEvent);

    return { cancelled: true, generation: newGeneration };
  }

  /**
   * Pause:
   * Running -> Paused.
   */
  pauseRun(
    run_uuid: string,
    reason = "User requested pause",
    correlationId?: string
  ): { paused: true } {
    const parseUuid = HexUuidSchema.safeParse(run_uuid);
    if (!parseUuid.success) {
      throw new ValidationError("Invalid run UUID format", { run_uuid });
    }

    const run = this.getRunByUuid(parseUuid.data);
    if (run.state !== "running") {
      throw new InvalidStateError(
        `Only running runs can be paused; current state is '${run.state}'`,
        409,
        { run_uuid: run.uuid, state: run.state }
      );
    }

    this.transitionState(run.uuid, "paused", { reason, correlationId });

    const now = new Date().toISOString();
    const nextSeq = this.repo.getNextEventSeq(run.uuid);
    const pauseEvent = this.repo.insertEvent({
      run_uuid: run.uuid,
      seq: nextSeq,
      event_type: "run.paused",
      payload: { reason },
      correlation_id: correlationId ?? null,
      created_at: now
    });

    this.emitLiveEvent(run.uuid, pauseEvent);

    return { paused: true };
  }

  /**
   * Resume:
   * Paused or Blocked -> Queued (Invariant 4).
   */
  resumeRun(
    run_uuid: string,
    reason = "User requested resume",
    correlationId?: string
  ): { resumed: true } {
    const parseUuid = HexUuidSchema.safeParse(run_uuid);
    if (!parseUuid.success) {
      throw new ValidationError("Invalid run UUID format", { run_uuid });
    }

    const run = this.getRunByUuid(parseUuid.data);
    if (run.state !== "paused" && run.state !== "blocked") {
      throw new InvalidStateError(
        `Only paused or blocked runs can be resumed; current state is '${run.state}'`,
        409,
        { run_uuid: run.uuid, state: run.state }
      );
    }

    this.transitionState(run.uuid, "queued", { reason, correlationId });

    const now = new Date().toISOString();
    const nextSeq = this.repo.getNextEventSeq(run.uuid);
    const resumeEvent = this.repo.insertEvent({
      run_uuid: run.uuid,
      seq: nextSeq,
      event_type: "run.resumed",
      payload: { reason },
      correlation_id: correlationId ?? null,
      created_at: now
    });

    this.emitLiveEvent(run.uuid, resumeEvent);

    return { resumed: true };
  }

  /**
   * Live event streaming & replay from cursor:
   * Returns all past events with seq > sinceSeq.
   */
  getEventsSince(run_uuid: string, sinceSeq: number, limit = 1000): RunEvent[] {
    const parseUuid = HexUuidSchema.safeParse(run_uuid);
    if (!parseUuid.success) {
      throw new ValidationError("Invalid run UUID format", { run_uuid });
    }

    return this.repo.findEventsSinceSeq(parseUuid.data, sinceSeq, limit);
  }

  /**
   * Subscribes to live SSE events for a specific run.
   */
  subscribeToRunEvents(run_uuid: string, listener: (event: RunEvent) => void): () => void {
    const eventName = `run_event:${run_uuid}`;
    this.eventEmitter.on(eventName, listener);
    return () => {
      this.eventEmitter.off(eventName, listener);
    };
  }

  private emitLiveEvent(run_uuid: string, event: RunEvent): void {
    const eventName = `run_event:${run_uuid}`;
    this.eventEmitter.emit(eventName, event);
  }

  /**
   * Records a custom or tool run event, appending monotonically to SQLite and emitting live.
   * Fences event if cancellation generation has moved past the provided generation.
   */
  recordEvent(
    run_uuid: string,
    eventType: string,
    payload: Record<string, unknown>,
    options: {
      generation?: number | undefined;
      correlationId?: string | undefined;
    } = {}
  ): RunEvent {
    const run = this.getRunByUuid(run_uuid);

    // Generation fencing check
    if (options.generation !== undefined && options.generation < run.cancellation_generation) {
      throw new InvalidStateError(
        `Event rejected by generation fence (expected generation ${run.cancellation_generation}, got ${options.generation})`,
        409,
        {
          run_uuid,
          current_generation: run.cancellation_generation,
          event_generation: options.generation
        }
      );
    }

    const nextSeq = this.repo.getNextEventSeq(run.uuid);
    const now = new Date().toISOString();

    const event = this.repo.insertEvent({
      run_uuid: run.uuid,
      seq: nextSeq,
      event_type: eventType,
      payload,
      correlation_id: options.correlationId ?? null,
      created_at: now
    });

    this.emitLiveEvent(run.uuid, event);
    return event;
  }

  /**
   * Executes the run lifecycle using ProviderService:
   * 1. Transitions queued -> planning -> running (or queued -> running for ask mode).
   * 2. Feeds conversation context to provider.
   * 3. Streams text chunks with monotonic RunEvent records.
   * 4. Fences stream on cancellation generation.
   * 5. Appends assistant message to codeit_messages.
   * 6. Transitions running -> verifying -> succeeded (or directly succeeded).
   */
  async executeRun(
    run_uuid: string,
    options: {
      providerService?: ProviderService | undefined;
      correlationId?: string | undefined;
    } = {}
  ): Promise<RunRecord> {
    const run = this.getRunByUuid(run_uuid);
    const providerSvc = options.providerService ?? this.providerService;

    if (!providerSvc) {
      throw new Error("Cannot execute run without an active ProviderService configured");
    }

    const abortController = new AbortController();
    const initialGeneration = run.cancellation_generation;

    this.activeExecutions.set(run.uuid, {
      runUuid: run.uuid,
      generation: initialGeneration,
      abortController
    });

    try {
      // 1. Move to running
      if (run.state === "queued") {
        if (run.mode === "ask") {
          this.transitionState(run.uuid, "running", { correlationId: options.correlationId });
        } else {
          this.transitionState(run.uuid, "planning", { correlationId: options.correlationId });
          // Check if cancelled during planning
          if (abortController.signal.aborted) return this.getRunByUuid(run.uuid);
          this.transitionState(run.uuid, "running", { correlationId: options.correlationId });
        }
      }

      if (abortController.signal.aborted) {
        return this.getRunByUuid(run.uuid);
      }

      // 2. Fetch conversation messages
      const msgsResult = this.conversationService.listMessages(run.conversation_uuid, {
        limit: 100
      });
      const promptMessages = msgsResult.items.map((m) => ({
        role: (m.role === "tool" ? "user" : m.role) as "user" | "assistant" | "system",
        content: m.content
      }));

      if (promptMessages.length === 0) {
        promptMessages.push({
          role: "user",
          content: "Hello, please assist me with this workspace."
        });
      }

      // 3. Stream from Provider
      const stream = providerSvc.generateStream({
        messages: promptMessages,
        signal: abortController.signal
      });

      let accumulatedText = "";

      for await (const chunk of stream) {
        // Generation fence check
        const currentRun = this.getRunByUuid(run.uuid);
        if (
          currentRun.cancellation_generation > initialGeneration ||
          abortController.signal.aborted
        ) {
          // Stream cancelled by generation increment
          break;
        }

        if (chunk.type === "text_delta") {
          accumulatedText += chunk.text;
          this.recordEvent(
            run.uuid,
            "text_delta",
            { delta: chunk.text },
            { generation: initialGeneration, correlationId: options.correlationId }
          );
        } else if (chunk.type === "error") {
          this.recordEvent(
            run.uuid,
            "run.error",
            { error: chunk.error },
            { generation: initialGeneration, correlationId: options.correlationId }
          );
          this.transitionState(run.uuid, "failed", {
            reason: chunk.error.message,
            correlationId: options.correlationId
          });
          return this.getRunByUuid(run.uuid);
        }
      }

      // Check if cancelled during streaming
      const checkCancelled = this.getRunByUuid(run.uuid);
      if (
        checkCancelled.cancellation_generation > initialGeneration ||
        abortController.signal.aborted
      ) {
        return checkCancelled;
      }

      // 4. Record assistant message
      if (accumulatedText.length > 0) {
        const assistantMsg = this.conversationService.appendMessage(run.conversation_uuid, {
          role: "assistant",
          content: accumulatedText,
          completion_state: "final"
        });

        this.recordEvent(
          run.uuid,
          "message_completed",
          {
            message_uuid: assistantMsg.uuid,
            content: assistantMsg.content,
            role: "assistant"
          },
          { generation: initialGeneration, correlationId: options.correlationId }
        );
      }

      // 5. Verification and Success transition
      if (run.mode === "work" || run.mode === "review") {
        this.transitionState(run.uuid, "verifying", { correlationId: options.correlationId });
      }

      this.transitionState(run.uuid, "succeeded", { correlationId: options.correlationId });

      const finalSeq = this.repo.getNextEventSeq(run.uuid);
      const now = new Date().toISOString();
      const successEvent = this.repo.insertEvent({
        run_uuid: run.uuid,
        seq: finalSeq,
        event_type: "run.succeeded",
        payload: { completed_at: now },
        correlation_id: options.correlationId ?? null,
        created_at: now
      });
      this.emitLiveEvent(run.uuid, successEvent);

      return this.getRunByUuid(run.uuid);
    } catch (err: unknown) {
      if (abortController.signal.aborted) {
        return this.getRunByUuid(run.uuid);
      }

      const errorMessage = err instanceof Error ? err.message : String(err);
      const current = this.getRunByUuid(run.uuid);
      if (!TERMINAL_STATES.includes(current.state)) {
        this.transitionState(run.uuid, "failed", {
          reason: errorMessage,
          correlationId: options.correlationId
        });
      }
      return this.getRunByUuid(run.uuid);
    } finally {
      this.activeExecutions.delete(run.uuid);
    }
  }
}
