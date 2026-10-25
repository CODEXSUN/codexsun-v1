import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import type { MarketingContext } from "../../context.js";
import type {
  ConversationActivity,
  ConversationChannel,
  MessageDirection,
  MessageRecord,
  MessageStatus,
  NurtureEnrollmentRecord,
  NurtureEnrollmentStatus,
  NurtureRuleInput,
  NurtureRuleRecord,
  NurtureStopReason,
  NurtureTriggerEvent,
  ThreadInput,
  ThreadRecord,
  ThreadStatus
} from "./conversation.types.js";

type ThreadRow = {
  id: number;
  uuid: string;
  revision: number;
  company_id: number;
  brand_uuid: string;
  channel: string;
  contact_identifier: string;
  contact_name: string;
  lead_uuid: string | null;
  status: string;
  assigned_to: string | null;
  is_human_takeover: number;
  stop_condition_met: number;
  last_inbound_at: Date | string | null;
  last_message_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type MessageRow = {
  id: number;
  uuid: string;
  company_id: number;
  thread_uuid: string;
  direction: string;
  sender: string;
  content: string;
  template_name: string | null;
  status: string;
  error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type NurtureRuleRow = {
  id: number;
  uuid: string;
  company_id: number;
  brand_uuid: string;
  name: string;
  trigger_event: string;
  max_steps: number;
  interval_hours: number;
  template_name: string;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type NurtureEnrollmentRow = {
  id: number;
  uuid: string;
  company_id: number;
  rule_uuid: string;
  thread_uuid: string;
  lead_uuid: string | null;
  step_number: number;
  status: string;
  stop_reason: string | null;
  stopped_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export class ConversationRepository {
  constructor(private readonly context: MarketingContext) {}

  private mapThread(row: ThreadRow): ThreadRecord {
    return {
      uuid: row.uuid,
      revision: row.revision,
      companyId: row.company_id,
      brandUuid: row.brand_uuid,
      channel: row.channel as ConversationChannel,
      contactIdentifier: row.contact_identifier,
      contactName: row.contact_name,
      leadUuid: row.lead_uuid,
      status: row.status as ThreadStatus,
      assignedTo: row.assigned_to,
      isHumanTakeover: Boolean(row.is_human_takeover),
      stopConditionMet: Boolean(row.stop_condition_met),
      lastInboundAt: row.last_inbound_at ? new Date(row.last_inbound_at).toISOString() : null,
      lastMessageAt: row.last_message_at ? new Date(row.last_message_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    };
  }

  private mapMessage(row: MessageRow): MessageRecord {
    return {
      uuid: row.uuid,
      companyId: row.company_id,
      threadUuid: row.thread_uuid,
      direction: row.direction as MessageDirection,
      sender: row.sender,
      content: row.content,
      templateName: row.template_name,
      status: row.status as MessageStatus,
      error: row.error,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    };
  }

  private mapRule(row: NurtureRuleRow): NurtureRuleRecord {
    return {
      uuid: row.uuid,
      companyId: row.company_id,
      brandUuid: row.brand_uuid,
      name: row.name,
      triggerEvent: row.trigger_event as NurtureTriggerEvent,
      maxSteps: row.max_steps,
      intervalHours: row.interval_hours,
      templateName: row.template_name,
      status: row.status as "active" | "paused",
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    };
  }

  private mapEnrollment(row: NurtureEnrollmentRow): NurtureEnrollmentRecord {
    return {
      uuid: row.uuid,
      companyId: row.company_id,
      ruleUuid: row.rule_uuid,
      threadUuid: row.thread_uuid,
      leadUuid: row.lead_uuid,
      stepNumber: row.step_number,
      status: row.status as NurtureEnrollmentStatus,
      stopReason: row.stop_reason as NurtureStopReason | null,
      stoppedAt: row.stopped_at ? new Date(row.stopped_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    };
  }

  /* Thread Operations */

  async listThreads(
    limit: number,
    offset: number,
    filters?: {
      search?: string;
      status?: string;
      channel?: string;
      brandUuid?: string;
    }
  ): Promise<ThreadRecord[]> {
    let query = sql<ThreadRow>`SELECT * FROM marketing_conversation_threads
      WHERE company_id = ${this.context.companyId}`;

    const allowed = this.context.allowedBrands;
    if (allowed && allowed.length === 0) return [];
    if (allowed && allowed.length > 0) {
      query = sql<ThreadRow>`${query} AND brand_uuid IN (${sql.join(allowed)})`;
    }

    if (filters?.search) {
      const term = `%${filters.search.trim().toLowerCase()}%`;
      query = sql<ThreadRow>`${query} AND (
        LOWER(contact_identifier) LIKE ${term} OR
        LOWER(contact_name) LIKE ${term}
      )`;
    }

    if (filters?.status && filters.status !== "all") {
      query = sql<ThreadRow>`${query} AND status = ${filters.status}`;
    }

    if (filters?.channel && filters.channel !== "all") {
      query = sql<ThreadRow>`${query} AND channel = ${filters.channel}`;
    }

    if (filters?.brandUuid && filters.brandUuid !== "all") {
      query = sql<ThreadRow>`${query} AND brand_uuid = ${filters.brandUuid}`;
    }

    query = sql<ThreadRow>`${query} ORDER BY COALESCE(last_message_at, created_at) DESC LIMIT ${limit} OFFSET ${offset}`;
    const result = await query.execute(this.context.database);
    return result.rows.map((r) => this.mapThread(r));
  }

  async countThreads(filters?: {
    search?: string;
    status?: string;
    channel?: string;
    brandUuid?: string;
  }): Promise<number> {
    let query = sql<{ total: number }>`SELECT COUNT(*) as total FROM marketing_conversation_threads
      WHERE company_id = ${this.context.companyId}`;

    const allowed = this.context.allowedBrands;
    if (allowed && allowed.length === 0) return 0;
    if (allowed && allowed.length > 0) {
      query = sql<{ total: number }>`${query} AND brand_uuid IN (${sql.join(allowed)})`;
    }

    if (filters?.search) {
      const term = `%${filters.search.trim().toLowerCase()}%`;
      query = sql<{ total: number }>`${query} AND (
        LOWER(contact_identifier) LIKE ${term} OR
        LOWER(contact_name) LIKE ${term}
      )`;
    }

    if (filters?.status && filters.status !== "all") {
      query = sql<{ total: number }>`${query} AND status = ${filters.status}`;
    }

    if (filters?.channel && filters.channel !== "all") {
      query = sql<{ total: number }>`${query} AND channel = ${filters.channel}`;
    }

    if (filters?.brandUuid && filters.brandUuid !== "all") {
      query = sql<{ total: number }>`${query} AND brand_uuid = ${filters.brandUuid}`;
    }

    const result = await query.execute(this.context.database);
    return Number(result.rows[0]?.total ?? 0);
  }

  async getThread(uuid: string): Promise<ThreadRecord | null> {
    const result = await sql<ThreadRow>`SELECT * FROM marketing_conversation_threads
      WHERE company_id = ${this.context.companyId} AND uuid = ${uuid} LIMIT 1`.execute(this.context.database);
    const row = result.rows[0];
    return row ? this.mapThread(row) : null;
  }

  async getThreadByContact(channel: ConversationChannel, identifier: string): Promise<ThreadRecord | null> {
    const cleanId = identifier.trim();
    const result = await sql<ThreadRow>`SELECT * FROM marketing_conversation_threads
      WHERE company_id = ${this.context.companyId} AND channel = ${channel} AND contact_identifier = ${cleanId}
      LIMIT 1`.execute(this.context.database);
    const row = result.rows[0];
    return row ? this.mapThread(row) : null;
  }

  async createThread(input: ThreadInput): Promise<string> {
    const uuid = randomBytes(4).toString("hex");
    const channel = input.channel ?? "whatsapp";
    const contactName = input.contactName?.trim() ?? "";

    await sql`INSERT INTO marketing_conversation_threads (
      uuid, company_id, brand_uuid, channel, contact_identifier, contact_name,
      lead_uuid, status, assigned_to
    ) VALUES (
      ${uuid}, ${this.context.companyId}, ${input.brandUuid}, ${channel},
      ${input.contactIdentifier.trim()}, ${contactName}, ${input.leadUuid ?? null},
      'open', ${input.assignedTo ?? null}
    )`.execute(this.context.database);

    await this.recordActivity(uuid, "created", this.context.actorEmail);
    return uuid;
  }

  async updateThreadTouchpoint(
    uuid: string,
    options: { inbound?: boolean; timestamp?: string } = {}
  ): Promise<void> {
    const now = options.timestamp ? new Date(options.timestamp) : new Date();
    if (options.inbound) {
      await sql`UPDATE marketing_conversation_threads SET
        last_inbound_at = ${now},
        last_message_at = ${now}
        WHERE company_id = ${this.context.companyId} AND uuid = ${uuid}`.execute(this.context.database);
    } else {
      await sql`UPDATE marketing_conversation_threads SET
        last_message_at = ${now}
        WHERE company_id = ${this.context.companyId} AND uuid = ${uuid}`.execute(this.context.database);
    }
  }

  async updateThreadStatus(uuid: string, status: ThreadStatus): Promise<void> {
    await sql`UPDATE marketing_conversation_threads SET
      status = ${status},
      revision = revision + 1
      WHERE company_id = ${this.context.companyId} AND uuid = ${uuid}`.execute(this.context.database);
    await this.recordActivity(uuid, `status:${status}`, this.context.actorEmail);
  }

  async setHumanTakeover(uuid: string, enabled: boolean): Promise<void> {
    await sql`UPDATE marketing_conversation_threads SET
      is_human_takeover = ${enabled ? 1 : 0},
      revision = revision + 1
      WHERE company_id = ${this.context.companyId} AND uuid = ${uuid}`.execute(this.context.database);
    await this.recordActivity(uuid, `takeover:${enabled ? "enabled" : "disabled"}`, this.context.actorEmail);
  }

  async setStopCondition(uuid: string, met: boolean): Promise<void> {
    await sql`UPDATE marketing_conversation_threads SET
      stop_condition_met = ${met ? 1 : 0}
      WHERE company_id = ${this.context.companyId} AND uuid = ${uuid}`.execute(this.context.database);
  }

  /* Message Operations */

  async listMessages(threadUuid: string): Promise<MessageRecord[]> {
    const result = await sql<MessageRow>`SELECT * FROM marketing_conversation_messages
      WHERE company_id = ${this.context.companyId} AND thread_uuid = ${threadUuid}
      ORDER BY created_at ASC`.execute(this.context.database);
    return result.rows.map((r) => this.mapMessage(r));
  }

  async saveMessage(
    threadUuid: string,
    direction: MessageDirection,
    sender: string,
    content: string,
    templateName: string | null = null,
    status: MessageStatus = "sent",
    error: string | null = null
  ): Promise<string> {
    const uuid = randomBytes(4).toString("hex");
    await sql`INSERT INTO marketing_conversation_messages (
      uuid, company_id, thread_uuid, direction, sender, content,
      template_name, status, error
    ) VALUES (
      ${uuid}, ${this.context.companyId}, ${threadUuid}, ${direction},
      ${sender}, ${content}, ${templateName}, ${status}, ${error}
    )`.execute(this.context.database);
    return uuid;
  }

  /* Nurture Rule & Enrollment Operations */

  async createNurtureRule(input: NurtureRuleInput): Promise<string> {
    const uuid = randomBytes(4).toString("hex");
    await sql`INSERT INTO marketing_nurture_rules (
      uuid, company_id, brand_uuid, name, trigger_event,
      max_steps, interval_hours, template_name, status
    ) VALUES (
      ${uuid}, ${this.context.companyId}, ${input.brandUuid}, ${input.name},
      ${input.triggerEvent}, ${input.maxSteps ?? 3}, ${input.intervalHours ?? 24},
      ${input.templateName}, 'active'
    )`.execute(this.context.database);
    return uuid;
  }

  async listNurtureRules(brandUuid?: string): Promise<NurtureRuleRecord[]> {
    let query = sql<NurtureRuleRow>`SELECT * FROM marketing_nurture_rules
      WHERE company_id = ${this.context.companyId}`;
    if (brandUuid && brandUuid !== "all") {
      query = sql<NurtureRuleRow>`${query} AND brand_uuid = ${brandUuid}`;
    }
    const result = await query.execute(this.context.database);
    return result.rows.map((r) => this.mapRule(r));
  }

  async getNurtureRule(uuid: string): Promise<NurtureRuleRecord | null> {
    const result = await sql<NurtureRuleRow>`SELECT * FROM marketing_nurture_rules
      WHERE company_id = ${this.context.companyId} AND uuid = ${uuid} LIMIT 1`.execute(this.context.database);
    const row = result.rows[0];
    return row ? this.mapRule(row) : null;
  }

  async enrollContact(ruleUuid: string, threadUuid: string, leadUuid: string | null): Promise<string> {
    const uuid = randomBytes(4).toString("hex");
    await sql`INSERT INTO marketing_nurture_enrollments (
      uuid, company_id, rule_uuid, thread_uuid, lead_uuid, step_number, status
    ) VALUES (
      ${uuid}, ${this.context.companyId}, ${ruleUuid}, ${threadUuid}, ${leadUuid}, 1, 'active'
    )`.execute(this.context.database);
    return uuid;
  }

  async getActiveEnrollment(threadUuid: string): Promise<NurtureEnrollmentRecord | null> {
    const result = await sql<NurtureEnrollmentRow>`SELECT * FROM marketing_nurture_enrollments
      WHERE company_id = ${this.context.companyId} AND thread_uuid = ${threadUuid}
      AND status = 'active' ORDER BY id DESC LIMIT 1`.execute(this.context.database);
    const row = result.rows[0];
    return row ? this.mapEnrollment(row) : null;
  }

  async stopEnrollment(
    threadUuid: string,
    reason: NurtureStopReason
  ): Promise<number> {
    const result = await sql`UPDATE marketing_nurture_enrollments SET
      status = 'stopped',
      stop_reason = ${reason},
      stopped_at = UTC_TIMESTAMP()
      WHERE company_id = ${this.context.companyId} AND thread_uuid = ${threadUuid}
      AND status = 'active'`.execute(this.context.database);
    return Number(result.numAffectedRows ?? 0);
  }

  /* Activity */

  async recordActivity(threadUuid: string, action: string, actor: string): Promise<void> {
    const uuid = randomBytes(4).toString("hex");
    await sql`INSERT INTO marketing_conversation_activity (
      uuid, company_id, thread_uuid, action, actor
    ) VALUES (
      ${uuid}, ${this.context.companyId}, ${threadUuid}, ${action}, ${actor}
    )`.execute(this.context.database);
  }

  async activity(threadUuid: string): Promise<ConversationActivity[]> {
    const result = await sql<{ action: string; actor: string; occurred_at: Date | string }>`
      SELECT action, actor, occurred_at FROM marketing_conversation_activity
      WHERE company_id = ${this.context.companyId} AND thread_uuid = ${threadUuid}
      ORDER BY occurred_at DESC LIMIT 50`.execute(this.context.database);
    return result.rows.map((r) => ({
      action: r.action,
      actor: r.actor,
      occurredAt: new Date(r.occurred_at).toISOString()
    }));
  }
}
