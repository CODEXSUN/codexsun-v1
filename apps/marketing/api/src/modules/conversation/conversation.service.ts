import { AppError } from "@codexsun/framework/errors";
import type { MarketingContext } from "../../context.js";
import type { ConsentRepository } from "../consent/consent.repository.js";
import type { ConversationRepository } from "./conversation.repository.js";
import type {
  ConversationActivity,
  MessageInput,
  MessageRecord,
  NurtureEnrollmentRecord,
  NurtureRuleInput,
  NurtureRuleRecord,
  NurtureStopReason,
  ThreadInput,
  ThreadRecord,
  ThreadStatus,
  WhatsAppWebhookMessage
} from "./conversation.types.js";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export class ConversationService {
  constructor(
    private readonly repository: ConversationRepository,
    private readonly consentRepository: ConsentRepository,
    private readonly context: MarketingContext
  ) {}

  /* 24-Hour Service Window Inspection (Gate E20, Task 4.2) */

  isWithinServiceWindow(lastInboundAt: string | null): boolean {
    if (!lastInboundAt) return false;
    const inboundTime = new Date(lastInboundAt).getTime();
    return Date.now() - inboundTime < TWENTY_FOUR_HOURS_MS;
  }

  /* Thread Operations */

  async listThreads(
    limit = 20,
    offset = 0,
    filters?: {
      search?: string;
      status?: string;
      channel?: string;
      brandUuid?: string;
    }
  ): Promise<ThreadRecord[]> {
    return this.repository.listThreads(limit, offset, filters);
  }

  async countThreads(filters?: {
    search?: string;
    status?: string;
    channel?: string;
    brandUuid?: string;
  }): Promise<number> {
    return this.repository.countThreads(filters);
  }

  async getThread(uuid: string): Promise<ThreadRecord> {
    const thread = await this.repository.getThread(uuid);
    if (!thread) {
      throw AppError.notFound("Conversation thread was not found.");
    }
    return thread;
  }

  async createThread(input: ThreadInput): Promise<string> {
    if (!input.brandUuid?.trim()) {
      throw AppError.validation("Brand is required.");
    }
    if (!input.contactIdentifier?.trim()) {
      throw AppError.validation("Contact identifier (phone number) is required.");
    }

    // Verify contact restriction
    const phone = input.contactIdentifier.trim();
    const restriction = await this.consentRepository.checkRestriction(phone, "phone");
    if (!restriction.allowed) {
      throw AppError.forbidden(`Cannot start thread: Contact is restricted (${restriction.reason}).`);
    }

    return this.repository.createThread(input);
  }

  async updateStatus(uuid: string, status: ThreadStatus): Promise<void> {
    const thread = await this.getThread(uuid);
    await this.repository.updateThreadStatus(thread.uuid, status);
  }

  async setHumanTakeover(uuid: string, enabled: boolean): Promise<void> {
    const thread = await this.getThread(uuid);
    await this.repository.setHumanTakeover(thread.uuid, enabled);

    if (enabled) {
      // Gate E20: Human takeover halts active automation
      await this.evaluateStopConditions(thread.uuid, "human_takeover");
    }
  }

  /* Messaging & 24h Window & Policy Enforcement (Tasks 4.2, 4.3, 4.8) */

  async listMessages(threadUuid: string): Promise<MessageRecord[]> {
    await this.getThread(threadUuid);
    return this.repository.listMessages(threadUuid);
  }

  async sendMessage(
    threadUuid: string,
    input: MessageInput,
    options: { isAutomated?: boolean } = {}
  ): Promise<MessageRecord> {
    const thread = await this.getThread(threadUuid);
    const content = input.content.trim();
    if (!content) {
      throw AppError.validation("Message content is required.");
    }

    // 1. Check Contact Restrictions (Gate E20, Task 4.8)
    const restriction = await this.consentRepository.checkRestriction(thread.contactIdentifier, "phone");
    if (!restriction.allowed) {
      // Auto-stop enrollment if active
      await this.evaluateStopConditions(thread.uuid, "channel_restriction");
      throw AppError.forbidden(`Cannot send message: Contact has active restriction (${restriction.reason}).`);
    }

    // 2. Human takeover block for automated sends (Gate E20)
    if (options.isAutomated && thread.isHumanTakeover) {
      throw AppError.forbidden("Automated message blocked: Human takeover is active on this conversation.");
    }

    // 3. 24-hour customer service window enforcement (Task 4.2)
    const inWindow = this.isWithinServiceWindow(thread.lastInboundAt);
    if (!inWindow && !input.templateName) {
      throw AppError.validation(
        "Outside 24-hour customer service window. Free-form messages are disallowed. An approved WhatsApp template is required."
      );
    }

    // If human agent manually replies, automatically toggle human takeover
    if (!options.isAutomated && !thread.isHumanTakeover) {
      await this.repository.setHumanTakeover(thread.uuid, true);
      await this.evaluateStopConditions(thread.uuid, "human_takeover");
    }

    // Save message
    const sender = options.isAutomated ? "system:automation" : this.context.actorEmail;
    const messageUuid = await this.repository.saveMessage(
      thread.uuid,
      "outbound",
      sender,
      content,
      input.templateName ?? null,
      "sent"
    );

    // Update thread touchpoint
    await this.repository.updateThreadTouchpoint(thread.uuid, { inbound: false });

    return {
      uuid: messageUuid,
      companyId: thread.companyId,
      threadUuid: thread.uuid,
      direction: "outbound",
      sender,
      content,
      templateName: input.templateName ?? null,
      status: "sent",
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /* Inbound WhatsApp Webhook Processing (Tasks 4.1, 4.6, Gate E20) */

  async processInboundWhatsAppWebhook(
    payload: {
      brandUuid: string;
      messages?: WhatsAppWebhookMessage[] | undefined;
    }
  ): Promise<{ processed: number; stoppedRules: number }> {
    let processed = 0;
    let stoppedRules = 0;

    for (const msg of payload.messages ?? []) {
      const from = msg.from.trim();
      const body = msg.text?.body?.trim() ?? "";
      if (!from) continue;

      // Find or create thread
      let thread = await this.repository.getThreadByContact("whatsapp", from);
      if (!thread) {
        const threadUuid = await this.repository.createThread({
          brandUuid: payload.brandUuid,
          channel: "whatsapp",
          contactIdentifier: from,
          contactName: from
        });
        thread = await this.repository.getThread(threadUuid);
      }

      if (!thread) continue;

      // Save inbound message
      await this.repository.saveMessage(
        thread.uuid,
        "inbound",
        from,
        body || "[Media or Non-text message]",
        null,
        "delivered"
      );

      // Update thread touchpoint with inbound = true (resets 24h service window!)
      await this.repository.updateThreadTouchpoint(thread.uuid, {
        inbound: true,
        timestamp: new Date(Number(msg.timestamp) * 1000).toISOString()
      });

      // Check for STOP/UNSUBSCRIBE opt-out keywords (Task 4.6)
      const upperBody = body.toUpperCase();
      if (upperBody === "STOP" || upperBody === "UNSUBSCRIBE" || upperBody === "OPTOUT") {
        await this.consentRepository.recordRestriction(
          {
            recipient: from,
            channel: "phone",
            blocked: true,
            reason: "Opt-out requested via WhatsApp reply"
          },
          "system:whatsapp"
        );
        stoppedRules += await this.evaluateStopConditions(thread.uuid, "opt_out");
      } else {
        // Gate E20: Customer replied! Stop condition triggered -> halt automated nurture
        stoppedRules += await this.evaluateStopConditions(thread.uuid, "reply");
      }

      processed++;
    }

    return { processed, stoppedRules };
  }

  /* Gate E20 Stop Condition Evaluation Engine (Task 4.6) */

  async evaluateStopConditions(threadUuid: string, reason: NurtureStopReason): Promise<number> {
    await this.repository.setStopCondition(threadUuid, true);
    const stopped = await this.repository.stopEnrollment(threadUuid, reason);
    if (stopped > 0) {
      await this.repository.recordActivity(threadUuid, `nurture:stopped:reason=${reason}`, this.context.actorEmail);
    }
    return stopped;
  }

  /* Nurture Rules & Enrollments (Task 4.4, Gate E20) */

  async createNurtureRule(input: NurtureRuleInput): Promise<string> {
    if (!input.name?.trim()) throw AppError.validation("Rule name is required.");
    if (!input.templateName?.trim()) throw AppError.validation("Template name is required.");
    return this.repository.createNurtureRule(input);
  }

  async listNurtureRules(brandUuid?: string): Promise<NurtureRuleRecord[]> {
    return this.repository.listNurtureRules(brandUuid);
  }

  async enrollContact(ruleUuid: string, threadUuid: string, leadUuid: string | null = null): Promise<string> {
    const thread = await this.getThread(threadUuid);
    const rule = await this.repository.getNurtureRule(ruleUuid);
    if (!rule) throw AppError.notFound("Nurture rule was not found.");

    // Check contact restriction
    const restriction = await this.consentRepository.checkRestriction(thread.contactIdentifier, "phone");
    if (!restriction.allowed) {
      throw AppError.forbidden("Cannot enroll contact: Active contact restriction.");
    }

    // Check if human takeover is active
    if (thread.isHumanTakeover) {
      throw AppError.forbidden("Cannot enroll contact: Human takeover is active.");
    }

    // Reset stop condition for new enrollment
    await this.repository.setStopCondition(thread.uuid, false);
    const enrollmentUuid = await this.repository.enrollContact(rule.uuid, thread.uuid, leadUuid);
    await this.repository.recordActivity(thread.uuid, `nurture:enrolled:rule=${rule.name}`, this.context.actorEmail);

    return enrollmentUuid;
  }

  async getActiveEnrollment(threadUuid: string): Promise<NurtureEnrollmentRecord | null> {
    await this.getThread(threadUuid);
    return this.repository.getActiveEnrollment(threadUuid);
  }

  async dispatchNurtureStep(threadUuid: string): Promise<{ dispatched: boolean; reason?: string }> {
    const thread = await this.getThread(threadUuid);
    const enrollment = await this.repository.getActiveEnrollment(threadUuid);
    if (!enrollment) {
      return { dispatched: false, reason: "No active enrollment" };
    }

    // Check stop conditions (Gate E20)
    if (thread.stopConditionMet || thread.isHumanTakeover) {
      return { dispatched: false, reason: "Stop condition met or human takeover active" };
    }

    // Check restriction
    const restriction = await this.consentRepository.checkRestriction(thread.contactIdentifier, "phone");
    if (!restriction.allowed) {
      await this.evaluateStopConditions(thread.uuid, "channel_restriction");
      return { dispatched: false, reason: "Contact restriction active" };
    }

    const rule = await this.repository.getNurtureRule(enrollment.ruleUuid);
    if (!rule || rule.status !== "active") {
      return { dispatched: false, reason: "Rule inactive or missing" };
    }

    // Dispatch approved template message
    await this.sendMessage(
      thread.uuid,
      {
        content: `Nurture step ${enrollment.stepNumber}: Automated follow-up`,
        templateName: rule.templateName
      },
      { isAutomated: true }
    );

    return { dispatched: true };
  }

  /* Activity */

  async activity(threadUuid: string): Promise<ConversationActivity[]> {
    await this.getThread(threadUuid);
    return this.repository.activity(threadUuid);
  }
}
