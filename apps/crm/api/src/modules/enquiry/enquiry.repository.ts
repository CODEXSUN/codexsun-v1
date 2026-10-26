import { sql, type Kysely, type Selectable, type Transaction } from "kysely";
import { AppError } from "@codexsun/framework/errors";
import type {
  EnquiryComment,
  EnquiryAlert,
  EnquiryCommentRow,
  EnquiryDatabase,
  EnquiryInput,
  EnquiryListOptions,
  EnquiryPage,
  EnquiryReportRow,
  EnquiryScopeSummary,
  EnquirySummary,
  EnquiryRecord,
  EnquiryRow,
  EnquirySearchColumn
} from "./enquiry.types.js";
import { sanitizeCommentHtml } from "./enquiry.comment-html.js";
import { scopedFrappeCommentKey } from "./enquiry.comment-source.js";
import { EnquirySyncRepository } from "./enquiry.sync.repository.js";
import { enquiryCountForFilter, enquiryStatusFilter } from "./enquiry.status-filter.js";

type PersistedRow = Selectable<EnquiryRow> & {
  list_name: string | null;
  creator_name: string | null;
  status_code: string;
  status_name: string;
  priority_code: string;
  priority_name: string;
};

export class EnquiryRepository {
  constructor(
    private readonly database: Kysely<EnquiryDatabase>,
    private readonly workEvent?: (
      transaction: Transaction<EnquiryDatabase>,
      enquiryId: number,
      action: string,
      body: string
    ) => Promise<void>,
    private readonly dispatchFrappeSync?: (eventId: number) => Promise<void>
  ) {}

  async listPage(options: EnquiryListOptions): Promise<EnquiryPage> {
    let query = this.scopedQuery(options);
    if (options.search) query = this.withSearchFilter(query, options.search, "all");
    const columnTerms: Array<[EnquirySearchColumn, string | undefined]> = [
      ["customer", options.searchCustomer],
      ["details", options.searchDetails],
      ["listIn", options.searchListIn],
      ["dueDate", options.searchDueDate],
      ["priority", options.searchPriority],
      ["creator", options.searchCreator],
      ["assignedTo", options.searchAssignedTo],
      ["status", options.searchStatus]
    ];
    for (const [column, value] of columnTerms) {
      if (value?.trim()) query = this.withSearchFilter(query, value.trim(), column);
    }
    query = this.withStatusFilter(query, options.filter);
    const hasSearch = Boolean(
      options.search?.trim() || columnTerms.some(([, value]) => value?.trim())
    );
    const [rows, total, counts] = await Promise.all([
      query
        .orderBy(options.mobile ? "enquiry.created_at" : "enquiry.enquiry_no", "desc")
        .orderBy("enquiry.id", "desc")
        .limit(options.pageSize)
        .offset((options.page - 1) * options.pageSize)
        .execute(),
      hasSearch
        ? query
            .clearSelect()
            .select(({ fn }) => fn.count<number>("enquiry.id").as("count"))
            .executeTakeFirstOrThrow()
        : Promise.resolve(null),
      this.scopedQuery(options)
        .clearSelect()
        .select([
          "status_master.code as code",
          ({ fn }) => fn.count<number>("enquiry.id").as("count")
        ])
        .groupBy("status_master.code")
        .execute()
    ]);
    return {
      items: await this.withRunningJobs(rows.map(toRecord)),
      total: total ? Number(total.count) : enquiryCountForFilter(counts, options.filter),
      statusCounts: counts.map((item) => ({ code: item.code, count: Number(item.count) }))
    };
  }

  async report(options: EnquiryListOptions): Promise<EnquiryReportRow[]> {
    const rows = await this.scopedQuery(options)
      .clearSelect()
      .select([
        "enquiry.list_in_id as listInId",
        "list.name as listIn",
        "enquiry.created_by as createdBy",
        "enquiry.assigned_user_id as assignedUserId",
        "status_master.code as status",
        "status_master.name as statusName",
        ({ fn }) => fn.count<number>("enquiry.id").as("count")
      ])
      .groupBy([
        "enquiry.list_in_id",
        "list.name",
        "enquiry.created_by",
        "enquiry.assigned_user_id",
        "status_master.code",
        "status_master.name"
      ])
      .execute();
    return rows.map((row) => ({ ...row, count: Number(row.count) }));
  }

  async summary(
    viewer: Pick<EnquiryListOptions, "actorEmail" | "actorUserId" | "canViewAll">,
    today: string
  ): Promise<EnquirySummary> {
    const base = { ...viewer, page: 1, pageSize: 1, search: "", filter: "all" };
    const [assigned, created, all] = await Promise.all([
      this.scopeSummary({ ...base, scope: "assigned" }, today),
      this.scopeSummary({ ...base, scope: "created" }, today),
      this.scopeSummary({ ...base, scope: "all" }, today)
    ]);
    return { assigned, created, allCount: all.total, all };
  }

  private async scopeSummary(
    options: EnquiryListOptions,
    today: string
  ): Promise<EnquiryScopeSummary> {
    const rows = await this.scopedQuery(options)
      .clearSelect()
      .select([
        "status_master.code as statusCode",
        "priority_master.code as priorityCode",
        ({ fn }) => fn.count<number>("enquiry.id").as("count"),
        sql<number>`SUM(CASE WHEN status_master.code NOT IN ('won', 'lost', 'closed') THEN 1 ELSE 0 END)`.as(
          "activeCount"
        ),
        sql<number>`SUM(CASE WHEN status_master.code NOT IN ('won', 'lost', 'closed') AND (priority_master.code='urgent' OR enquiry.due_date < ${today}) THEN 1 ELSE 0 END)`.as(
          "attentionCount"
        ),
        sql<number>`SUM(CASE WHEN enquiry.updated_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY THEN 1 ELSE 0 END)`.as(
          "updated7"
        ),
        sql<number>`SUM(CASE WHEN enquiry.updated_at >= UTC_TIMESTAMP() - INTERVAL 30 DAY THEN 1 ELSE 0 END)`.as(
          "updated30"
        ),
        sql<number>`SUM(CASE WHEN enquiry.created_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY THEN 1 ELSE 0 END)`.as(
          "created7"
        ),
        sql<number>`SUM(CASE WHEN enquiry.created_at >= UTC_TIMESTAMP() - INTERVAL 30 DAY THEN 1 ELSE 0 END)`.as(
          "created30"
        ),
        sql<unknown>`MIN(CASE WHEN status_master.code NOT IN ('won', 'lost', 'closed') THEN enquiry.created_at ELSE NULL END)`.as(
          "oldestActiveAt"
        )
      ])
      .groupBy(["status_master.code", "priority_master.code"])
      .execute();
    const statuses = new Map<string, number>();
    const priorities = new Map<string, number>();
    let oldest: number | null = null;
    for (const row of rows) {
      const count = Number(row.count);
      statuses.set(row.statusCode, (statuses.get(row.statusCode) ?? 0) + count);
      priorities.set(
        row.priorityCode,
        (priorities.get(row.priorityCode) ?? 0) + Number(row.activeCount)
      );
      if (row.oldestActiveAt) {
        const time = new Date(toIso(row.oldestActiveAt)).getTime();
        oldest = oldest === null ? time : Math.min(oldest, time);
      }
    }
    return {
      total: rows.reduce((sum, row) => sum + Number(row.count), 0),
      active: rows.reduce((sum, row) => sum + Number(row.activeCount), 0),
      newCalls: statuses.get("new") ?? 0,
      attention: rows.reduce((sum, row) => sum + Number(row.attentionCount), 0),
      updated7: rows.reduce((sum, row) => sum + Number(row.updated7), 0),
      updated30: rows.reduce((sum, row) => sum + Number(row.updated30), 0),
      created7: rows.reduce((sum, row) => sum + Number(row.created7), 0),
      created30: rows.reduce((sum, row) => sum + Number(row.created30), 0),
      oldestActiveDays:
        oldest === null ? null : Math.max(0, Math.floor((Date.now() - oldest) / 86_400_000)),
      statusCounts: [...statuses].map(([code, count]) => ({ code, count })),
      priorityCounts: [...priorities].map(([code, count]) => ({ code, count }))
    };
  }

  private scopedQuery(options: EnquiryListOptions) {
    let query = this.detailQuery();
    if (options.scope === "assigned") {
      query = query.where("enquiry.assigned_user_id", "=", options.actorUserId ?? -1);
    } else if (options.scope === "created") {
      query = query.where("enquiry.created_by", "=", options.actorEmail);
    } else if (!options.canViewAll) {
      query = query.where((expression) =>
        expression.or([
          expression("enquiry.assigned_user_id", "=", options.actorUserId ?? -1),
          expression("enquiry.created_by", "=", options.actorEmail)
        ])
      );
    }
    if (options.mobile) {
      const digits = options.mobile.replace(/\D/g, "");
      const mobile =
        digits.length === 12 && digits.startsWith("91")
          ? digits.slice(2)
          : digits.length === 11 && digits.startsWith("0")
            ? digits.slice(1)
            : digits;
      const alternatives = mobile.length === 10 ? [mobile, `91${mobile}`, `0${mobile}`] : [mobile];
      query = query.where((expression) =>
        expression.or([
          ...(options.contactId ? [expression("enquiry.contact_id", "=", options.contactId)] : []),
          sql<boolean>`REGEXP_REPLACE(COALESCE(enquiry.captured_phone, ''), '[^0-9]', '') IN (${sql.join(alternatives)})`
        ])
      );
    } else if (options.contactId) {
      query = query.where("enquiry.contact_id", "=", options.contactId);
    }
    if (options.fromAt)
      query = query.where("enquiry.enquired_at", ">=", utcDateTime(options.fromAt));
    if (options.toAt) query = query.where("enquiry.enquired_at", "<", utcDateTime(options.toAt));
    if (options.listInId) {
      query =
        options.listInId === "none"
          ? query.where("enquiry.list_in_id", "is", null)
          : query.where("enquiry.list_in_id", "=", Number(options.listInId));
    }
    if (options.createdBy) query = query.where("enquiry.created_by", "=", options.createdBy);
    if (options.assignedUserId) {
      query =
        options.assignedUserId === "none"
          ? query.where("enquiry.assigned_user_id", "is", null)
          : query.where("enquiry.assigned_user_id", "=", Number(options.assignedUserId));
    }
    return query;
  }

  private withSearchFilter(
    query: ReturnType<EnquiryRepository["scopedQuery"]>,
    search: string,
    column: EnquirySearchColumn
  ) {
    const term = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    const reference = search.trim().replace(/^#/u, "");
    const number = /^\d+$/u.test(reference) ? Number(reference) : -1;
    const enquiryNo = Number.isSafeInteger(number) ? number : -1;
    return query.where((expression) => {
      const id = expression("enquiry.enquiry_no", "=", enquiryNo);
      const details = [
        expression("enquiry.title", "like", term),
        expression("enquiry.description", "like", term)
      ];
      const customer = [
        expression("enquiry.captured_name", "like", term),
        expression("enquiry.captured_email", "like", term),
        expression("enquiry.captured_phone", "like", term),
        sql<boolean>`EXISTS (
          SELECT 1 FROM core_contacts contact
          WHERE contact.id = enquiry.contact_id
            AND (
              contact.name LIKE ${term}
              OR contact.primary_phone LIKE ${term}
              OR EXISTS (
                SELECT 1 FROM core_contacts_phones phone
                WHERE phone.parent_id = contact.id AND phone.phone LIKE ${term}
              )
            )
        )`
      ];
      const listIn = expression("list.name", "like", term);
      const dueDate = sql<boolean>`(CAST(enquiry.due_date AS CHAR) LIKE ${term} OR DATE_FORMAT(enquiry.due_date, '%d-%m-%Y') LIKE ${term})`;
      const priority = expression.or([
        expression("priority_master.name", "like", term),
        expression("priority_master.code", "like", term)
      ]);
      const creator = sql<boolean>`(enquiry.created_by LIKE ${term} OR EXISTS (
        SELECT 1 FROM app_users creator_user
        WHERE creator_user.email = enquiry.created_by AND creator_user.name LIKE ${term}
      ))`;
      const assignedTo = sql<boolean>`EXISTS (
        SELECT 1 FROM app_users assigned_user
        WHERE assigned_user.id = enquiry.assigned_user_id
          AND (assigned_user.name LIKE ${term} OR assigned_user.email LIKE ${term})
      )`;
      const status = expression.or([
        expression("status_master.name", "like", term),
        expression("status_master.code", "like", term)
      ]);
      switch (column) {
        case "customer":
          return expression.or(customer);
        case "details":
          return expression.or(details);
        case "listIn":
          return listIn;
        case "dueDate":
          return dueDate;
        case "priority":
          return priority;
        case "creator":
          return creator;
        case "assignedTo":
          return assignedTo;
        case "status":
          return status;
        default:
          return expression.or([...details, ...customer, ...(enquiryNo >= 0 ? [id] : [])]);
      }
    });
  }

  private withStatusFilter(query: ReturnType<EnquiryRepository["scopedQuery"]>, filter: string) {
    const selection = enquiryStatusFilter(filter);
    return selection
      ? query.where("status_master.code", selection.exclude ? "not in" : "in", selection.codes)
      : query;
  }

  async get(id: number) {
    const row = await this.detailQuery().where("enquiry.id", "=", id).executeTakeFirst();
    return row ? ((await this.withRunningJobs([toRecord(row)]))[0] ?? null) : null;
  }

  async findBySourceReference(source: string, reference: string) {
    const row = await this.detailQuery()
      .where("enquiry.source", "=", source)
      .where("enquiry.source_reference", "=", reference)
      .executeTakeFirst();
    return row ? toRecord(row) : null;
  }

  async setImportedSourceMetadata(
    id: number,
    source: { createdAt: string; updatedAt: string; createdBy: string }
  ) {
    await this.database
      .updateTable("crm_enquiries")
      .set({
        created_by: source.createdBy,
        created_at: utcDateTime(source.createdAt),
        updated_at: utcDateTime(source.updatedAt)
      })
      .where("id", "=", id)
      .execute();
  }

  async create(
    input: EnquiryInput,
    actor: string,
    resolveContact?: (transaction: Transaction<EnquiryDatabase>) => Promise<EnquiryInput>,
    source?: { enquiryNo: number; createdAt: string; updatedAt: string; createdBy: string }
  ) {
    const created = await this.database.transaction().execute(async (transaction) => {
      const prepared = resolveContact ? await resolveContact(transaction) : input;
      const enquiryNo = source
        ? await this.reserveImportedNumber(transaction, source.enquiryNo)
        : await this.reserveNextNumber(transaction);
      // MariaDB DATETIME has no timezone; these values are read back as UTC.
      const result = await transaction
        .insertInto("crm_enquiries")
        .values({
          ...toRow(prepared),
          enquiry_no: enquiryNo,
          created_by: source?.createdBy ?? actor,
          created_at: source ? utcDateTime(source.createdAt) : sql`UTC_TIMESTAMP()`,
          updated_at: source ? utcDateTime(source.updatedAt) : sql`UTC_TIMESTAMP()`
        })
        .executeTakeFirstOrThrow();
      const enquiryId = Number(result.insertId);
      const sourceActor = source?.createdBy ?? actor;
      const sourceTimestamp = source?.createdAt;
      if (prepared.assignedUserId) {
        await transaction
          .insertInto("crm_enquiry_alerts")
          .values({
            enquiry_id: enquiryId,
            user_id: prepared.assignedUserId,
            kind: "assigned",
            read_at: null,
            status: "active",
            created_by: actor,
            created_at: sql`UTC_TIMESTAMP()`,
            updated_at: sql`UTC_TIMESTAMP()`
          })
          .execute();
      }
      let initialCommentId: number | null = null;
      if (prepared.description?.trim()) {
        const comment = await transaction
          .insertInto("crm_enquiry_comments")
          .values({
            enquiry_id: enquiryId,
            parent_id: null,
            body: prepared.description.trim(),
            status: "active",
            created_by: sourceActor,
            created_at: sourceTimestamp ? utcDateTime(sourceTimestamp) : sql`UTC_TIMESTAMP()`,
            updated_at: sourceTimestamp ? utcDateTime(sourceTimestamp) : sql`UTC_TIMESTAMP()`
          })
          .executeTakeFirstOrThrow();
        initialCommentId = Number(comment.insertId);
      }
      await insertEnquiryActivity(
        transaction,
        enquiryId,
        "created",
        `Enquiry #${enquiryNo} created`,
        sourceActor,
        sourceTimestamp
      );
      await this.workEvent?.(
        transaction,
        enquiryId,
        "assigned",
        prepared.description || prepared.title
      );
      const syncEventId = source
        ? null
        : await new EnquirySyncRepository(this.database).enqueueUpsert(
            { actorEmail: actor, correlationId: `crm-enquiry:${enquiryId}:created`, enquiryId },
            transaction
          );
      const commentSyncEventId =
        source || !initialCommentId
          ? null
          : await new EnquirySyncRepository(transaction).enqueue(
              {
                actorEmail: actor,
                correlationId: `crm-enquiry:${enquiryId}:comment:${initialCommentId}`,
                enquiryId,
                entityId: initialCommentId,
                eventType: "comment-add"
              },
              transaction
            );
      return { enquiryId, syncEventId, commentSyncEventId };
    });
    await this.dispatchSync(created.syncEventId);
    await this.dispatchSync(created.commentSyncEventId);
    return this.get(created.enquiryId);
  }

  async update(
    id: number,
    input: EnquiryInput,
    actor: string,
    details = "Enquiry updated",
    expectedStatusId?: number,
    resolveContact?: (transaction: Transaction<EnquiryDatabase>) => Promise<EnquiryInput>,
    syncToFrappe = true
  ) {
    const syncEventId = await this.database.transaction().execute(async (transaction) => {
      const previous = await transaction
        .selectFrom("crm_enquiries")
        .select(["assigned_user_id", "status_id"])
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (expectedStatusId !== undefined && previous.status_id !== expectedStatusId) {
        throw AppError.conflict("This enquiry changed. Refresh it before saving.");
      }
      const prepared = resolveContact ? await resolveContact(transaction) : input;
      await transaction
        .updateTable("crm_enquiries")
        .set({ ...toRow(prepared), updated_at: sql`UTC_TIMESTAMP()` })
        .where("id", "=", id)
        .execute();
      if (previous.status_id !== prepared.statusId) {
        const statuses = await transaction
          .selectFrom("crm_enquiry_statuses")
          .select(["id", "name"])
          .where("id", "in", [previous.status_id, prepared.statusId])
          .execute();
        const statusNames = new Map(statuses.map((status) => [status.id, status.name]));
        const from = statusNames.get(previous.status_id) ?? "Unknown";
        const to = statusNames.get(prepared.statusId) ?? "Unknown";
        const message = `Status changed from ${from} to ${to}.`;
        await insertEnquiryActivity(transaction, id, "status-changed", message, actor);
      }
      if (previous.assigned_user_id !== prepared.assignedUserId && previous.assigned_user_id) {
        await transaction
          .updateTable("crm_enquiry_alerts")
          .set({ read_at: sql`UTC_TIMESTAMP()`, updated_at: sql`UTC_TIMESTAMP()` })
          .where("enquiry_id", "=", id)
          .where("user_id", "=", previous.assigned_user_id)
          .where("read_at", "is", null)
          .execute();
      }
      if (prepared.assignedUserId && prepared.assignedUserId !== previous.assigned_user_id) {
        await transaction
          .insertInto("crm_enquiry_alerts")
          .values({
            enquiry_id: id,
            user_id: prepared.assignedUserId,
            kind: "assigned",
            read_at: null,
            status: "active",
            created_by: actor,
            created_at: sql`UTC_TIMESTAMP()`,
            updated_at: sql`UTC_TIMESTAMP()`
          })
          .execute();
        await insertEnquiryActivity(
          transaction,
          id,
          "assigned",
          `Assigned to user #${prepared.assignedUserId}`,
          actor
        );
      }
      await this.workEvent?.(
        transaction,
        id,
        previous.assigned_user_id !== prepared.assignedUserId ? "assigned" : "updated",
        details
      );
      if (previous.status_id === prepared.statusId) {
        await insertEnquiryActivity(transaction, id, "updated", details, actor);
      }
      if (syncToFrappe)
        return new EnquirySyncRepository(this.database).enqueueUpsert(
          { actorEmail: actor, correlationId: `crm-enquiry:${id}:updated`, enquiryId: id },
          transaction
        );
      return null;
    });
    await this.dispatchSync(syncEventId);
    return this.get(id);
  }

  private async dispatchSync(eventId: number | null) {
    if (eventId === null || !this.dispatchFrappeSync) return;
    try {
      await this.dispatchFrappeSync(eventId);
    } catch (error) {
      try {
        await this.database
          .updateTable("crm_enquiry_sync_events")
          .set({
            last_error:
              error instanceof Error ? error.message.slice(0, 4000) : "Queue dispatch failed."
          })
          .where("id", "=", eventId)
          .where("status", "in", ["pending", "retry"])
          .execute();
      } catch {
        /* The outbox relay recovers after database access returns. */
      }
      console.warn("[crm-enquiry-sync] immediate dispatch deferred", {
        eventId,
        message: error instanceof Error ? error.message : "Queue dispatch failed."
      });
    }
  }

  async listComments(enquiryId: number): Promise<EnquiryComment[]> {
    const rows = await this.database
      .selectFrom("crm_enquiry_comments as comment")
      .leftJoin("app_users as author", "author.email", "comment.created_by")
      .selectAll("comment")
      .select("author.name as created_by_name")
      .where("enquiry_id", "=", enquiryId)
      .orderBy("created_at")
      .orderBy("id")
      .execute();
    return rows.map(toComment);
  }

  async commentsByActorInLast30Days(actor: string) {
    const result = await this.database
      .selectFrom("crm_enquiry_comments")
      .select(({ fn }) => fn.count<number>("id").as("count"))
      .where("created_by", "=", actor)
      .where("created_at", ">=", sql<string>`UTC_TIMESTAMP() - INTERVAL 30 DAY`)
      .executeTakeFirstOrThrow();
    return Number(result.count);
  }

  async listAlerts(userId: number): Promise<EnquiryAlert[]> {
    const rows = await this.database
      .selectFrom("crm_enquiry_alerts as alert")
      .innerJoin("crm_enquiries as enquiry", "enquiry.id", "alert.enquiry_id")
      .select([
        "alert.id",
        "alert.enquiry_id",
        "alert.created_at",
        "enquiry.enquiry_no",
        "enquiry.title"
      ])
      .where("alert.user_id", "=", userId)
      .where("alert.read_at", "is", null)
      .where("alert.status", "=", "active")
      .orderBy("alert.id", "desc")
      .limit(20)
      .execute();
    return rows.map((row) => ({
      id: row.id,
      enquiryId: row.enquiry_id,
      enquiryNo: row.enquiry_no,
      title: row.title,
      createdAt: toIso(row.created_at)
    }));
  }

  async readAlert(id: number, userId: number) {
    const result = await this.database
      .updateTable("crm_enquiry_alerts")
      .set({ read_at: sql`UTC_TIMESTAMP()`, updated_at: sql`UTC_TIMESTAMP()` })
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .where("read_at", "is", null)
      .executeTakeFirst();
    return result.numUpdatedRows === 1n;
  }

  async dueFollowUps(userId: number, today: string) {
    const rows = await this.detailQuery()
      .where("enquiry.assigned_user_id", "=", userId)
      .where("enquiry.due_date", "<=", today)
      .where("status_master.code", "not in", ["won", "lost", "closed"])
      .orderBy("enquiry.due_date", "asc")
      .orderBy("enquiry.enquiry_no", "desc")
      .limit(100)
      .execute();
    return rows.map(toRecord);
  }

  async getComment(id: number) {
    return this.database
      .selectFrom("crm_enquiry_comments")
      .select(["id", "enquiry_id", "parent_id"])
      .where("id", "=", id)
      .executeTakeFirst();
  }

  async importedCommentId(enquiryId: number, requestId: string, localId?: number) {
    let query = this.database
      .selectFrom("crm_enquiry_comments")
      .select("id")
      .where("enquiry_id", "=", enquiryId);
    query = localId
      ? query.where("id", "=", localId)
      : query
          .where("request_id", "in", [requestId, scopedFrappeCommentKey(enquiryId, requestId)])
          .orderBy(
            sql`CASE WHEN request_id=${scopedFrappeCommentKey(enquiryId, requestId)} THEN 0 ELSE 1 END`
          )
          .orderBy("id");
    const row = await query.executeTakeFirst();
    return row?.id ?? null;
  }

  async addComment(
    enquiryId: number,
    parentId: number | null,
    body: string,
    bodyFormat: "plain" | "html",
    actor: string,
    requestId?: string,
    sourceCreatedAt?: string
  ) {
    const persistedRequestId =
      sourceCreatedAt && requestId ? scopedFrappeCommentKey(enquiryId, requestId) : requestId;
    const result = await this.database.transaction().execute(async (transaction) => {
      await transaction
        .selectFrom("crm_enquiries")
        .select("id")
        .where("id", "=", enquiryId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (requestId) {
        let existingQuery = transaction
          .selectFrom("crm_enquiry_comments")
          .selectAll()
          .where(
            "request_id",
            "in",
            sourceCreatedAt ? [requestId, persistedRequestId!] : [requestId]
          );
        if (sourceCreatedAt)
          existingQuery = existingQuery
            .where("enquiry_id", "=", enquiryId)
            .orderBy(
              sql`CASE WHEN request_id=${persistedRequestId} THEN 0 WHEN created_by=${actor} THEN 1 ELSE 2 END`
            )
            .orderBy("id");
        else existingQuery = existingQuery.where("created_by", "=", actor);
        const existing = await existingQuery.executeTakeFirst();
        if (existing) {
          if (sourceCreatedAt && existing.enquiry_id === enquiryId) {
            const sourceTimestamp = utcDateTime(sourceCreatedAt);
            await transaction
              .updateTable("crm_enquiry_comments")
              .set({
                body,
                body_format: bodyFormat,
                parent_id: parentId,
                created_by: actor,
                request_id: persistedRequestId!,
                created_at: sourceTimestamp,
                updated_at: sourceTimestamp
              })
              .where("id", "=", existing.id)
              .execute();
            return { insertId: BigInt(existing.id), syncEventId: null };
          }
          if (
            existing.enquiry_id !== enquiryId ||
            existing.parent_id !== parentId ||
            existing.body !== body ||
            existing.body_format !== bodyFormat
          )
            throw AppError.conflict(
              "This comment retry key was already used for different content."
            );
          const event = sourceCreatedAt
            ? null
            : await new EnquirySyncRepository(transaction).commentSyncEvent(existing.id);
          return { insertId: BigInt(existing.id), syncEventId: event?.id ?? null };
        }
      }
      const inserted = await transaction
        .insertInto("crm_enquiry_comments")
        .values({
          request_id: persistedRequestId ?? null,
          enquiry_id: enquiryId,
          parent_id: parentId,
          body,
          body_format: bodyFormat,
          status: "active",
          created_by: actor,
          created_at: sourceCreatedAt ? utcDateTime(sourceCreatedAt) : sql`UTC_TIMESTAMP()`,
          updated_at: sourceCreatedAt ? utcDateTime(sourceCreatedAt) : sql`UTC_TIMESTAMP()`
        })
        .executeTakeFirstOrThrow();
      await insertEnquiryActivity(
        transaction,
        enquiryId,
        parentId ? "reply-added" : "comment-added",
        parentId ? "Reply added" : "Comment added",
        actor
      );
      await this.workEvent?.(
        transaction,
        enquiryId,
        parentId ? "reply-added" : "comment-added",
        body
      );
      const syncEventId = sourceCreatedAt
        ? null
        : await new EnquirySyncRepository(transaction).enqueue(
            {
              actorEmail: actor,
              correlationId: `crm-enquiry:${enquiryId}:comment:${Number(inserted.insertId)}`,
              enquiryId,
              entityId: Number(inserted.insertId),
              eventType: "comment-add"
            },
            transaction
          );
      return { ...inserted, syncEventId };
    });
    await this.dispatchSync(result.syncEventId);
    const row = await this.database
      .selectFrom("crm_enquiry_comments")
      .selectAll()
      .where("id", "=", Number(result.insertId))
      .executeTakeFirstOrThrow();
    return toComment(row);
  }

  async openNewCall(id: number, actor: string) {
    await this.database.transaction().execute(async (transaction) => {
      const statuses = await transaction
        .selectFrom("crm_enquiry_statuses")
        .select(["id", "code"])
        .where("code", "in", ["new", "open"])
        .where("status", "=", "active")
        .execute();
      const newId = statuses.find((status) => status.code === "new")?.id;
      const openId = statuses.find((status) => status.code === "open")?.id;
      if (!newId || !openId) throw AppError.validation("New and Open statuses must be active.");
      const result = await transaction
        .updateTable("crm_enquiries")
        .set({ status_id: openId, updated_at: sql`UTC_TIMESTAMP()` })
        .where("id", "=", id)
        .where("status_id", "=", newId)
        .executeTakeFirst();
      if (result.numUpdatedRows !== 1n) {
        throw AppError.validation("This call is no longer New. Refresh the list.");
      }
      await insertEnquiryActivity(transaction, id, "new-call-opened", "New call opened", actor);
    });
    return this.get(id);
  }

  private async reserveNextNumber(database: Kysely<EnquiryDatabase>) {
    const sequence = await database
      .selectFrom("crm_enquiry_number_sequence")
      .select("next_no")
      .where("id", "=", 1)
      .forUpdate()
      .executeTakeFirstOrThrow();
    await database
      .updateTable("crm_enquiry_number_sequence")
      .set({ next_no: sequence.next_no + 1 })
      .where("id", "=", 1)
      .execute();
    return sequence.next_no;
  }

  private async reserveImportedNumber(database: Kysely<EnquiryDatabase>, enquiryNo: number) {
    if (!Number.isSafeInteger(enquiryNo) || enquiryNo < 1)
      throw AppError.validation("The source enquiry number is invalid.");
    const sequence = await database
      .selectFrom("crm_enquiry_number_sequence")
      .select("next_no")
      .where("id", "=", 1)
      .forUpdate()
      .executeTakeFirstOrThrow();
    const existing = await database
      .selectFrom("crm_enquiries")
      .select("id")
      .where("enquiry_no", "=", enquiryNo)
      .executeTakeFirst();
    // Remote identities can share a serial across Q/ENQ series or collide with local records.
    const localNumber = existing ? sequence.next_no : enquiryNo;
    await database
      .updateTable("crm_enquiry_number_sequence")
      .set({ next_no: Math.max(sequence.next_no, localNumber + 1) })
      .where("id", "=", 1)
      .execute();
    return localNumber;
  }

  private detailQuery() {
    return this.database
      .selectFrom("crm_enquiries as enquiry")
      .leftJoin("crm_enquiry_lists as list", "list.id", "enquiry.list_in_id")
      .leftJoin("app_users as creator", "creator.email", "enquiry.created_by")
      .innerJoin("crm_enquiry_statuses as status_master", "status_master.id", "enquiry.status_id")
      .innerJoin(
        "crm_enquiry_priorities as priority_master",
        "priority_master.id",
        "enquiry.priority_id"
      )
      .selectAll("enquiry")
      .select([
        "list.name as list_name",
        "creator.name as creator_name",
        "status_master.code as status_code",
        "status_master.name as status_name",
        "priority_master.code as priority_code",
        "priority_master.name as priority_name"
      ]);
  }

  private async withRunningJobs(records: EnquiryRecord[]): Promise<EnquiryRecord[]> {
    if (records.length === 0) return records;
    const jobs = await this.database
      .selectFrom("crm_enquiry_jobs")
      .select(["id", "enquiry_id", "start_at"])
      .where(
        "enquiry_id",
        "in",
        records.map((record) => record.id)
      )
      .where("status", "=", "running")
      .orderBy("id", "desc")
      .execute();
    const running = new Map<number, { id: number; startAt: string }>();
    for (const job of jobs) {
      if (!running.has(job.enquiry_id))
        running.set(job.enquiry_id, { id: job.id, startAt: toIso(job.start_at) });
    }
    return records.map((record) => ({
      ...record,
      runningJobId: running.get(record.id)?.id ?? null,
      runningJobStartedAt: running.get(record.id)?.startAt ?? null
    }));
  }
}

export async function insertEnquiryActivity(
  database: Kysely<EnquiryDatabase>,
  enquiryId: number,
  action: string,
  details: string,
  actor: string,
  sourceCreatedAt?: string
) {
  await database
    .insertInto("crm_enquiry_activity")
    .values({
      enquiry_id: enquiryId,
      action,
      details,
      status: "active",
      created_by: actor,
      created_at: sourceCreatedAt ? utcDateTime(sourceCreatedAt) : sql`UTC_TIMESTAMP()`,
      updated_at: sourceCreatedAt ? utcDateTime(sourceCreatedAt) : sql`UTC_TIMESTAMP()`
    })
    .execute();
}

function utcDateTime(value: string) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

function toRow(input: EnquiryInput) {
  return {
    title: input.title,
    description: input.description,
    contact_id: input.contactId,
    captured_name: input.capturedName,
    captured_email: input.capturedEmail,
    captured_phone: input.capturedPhone,
    source: input.source,
    source_reference: input.sourceReference,
    list_in_id: input.listInId,
    status_id: input.statusId,
    priority_id: input.priorityId,
    assigned_user_id: input.assignedUserId,
    enquired_at: new Date(input.enquiredAt).toISOString().slice(0, 19).replace("T", " "),
    due_date: input.dueDate,
    closed_reason: input.closedReason
  };
}

function toRecord(row: PersistedRow): EnquiryRecord {
  return {
    id: row.id,
    enquiryNo: row.enquiry_no,
    uuid: row.uuid,
    title: row.title,
    description: row.description,
    contactId: row.contact_id,
    contactName: null,
    capturedName: row.captured_name,
    capturedEmail: row.captured_email,
    capturedPhone: row.captured_phone,
    source: row.source,
    sourceReference: row.source_reference,
    listInId: row.list_in_id,
    statusId: row.status_id,
    priorityId: row.priority_id,
    listIn: row.list_name,
    status: row.status_code,
    statusName: row.status_name,
    priority: row.priority_code,
    priorityName: row.priority_name,
    assignedUserId: row.assigned_user_id,
    enquiredAt: toIso(row.enquired_at),
    dueDate: row.due_date ? toDate(row.due_date) : null,
    closedReason: row.closed_reason,
    createdBy: row.created_by,
    createdByName: row.creator_name,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function toComment(row: Selectable<EnquiryCommentRow>): EnquiryComment {
  return {
    id: row.id,
    uuid: row.uuid,
    enquiryId: row.enquiry_id,
    parentId: row.parent_id,
    body: row.body_format === "html" ? sanitizeCommentHtml(row.body) : row.body,
    bodyFormat: row.body_format,
    createdBy: row.created_by,
    createdByName: row.created_by_name ?? null,
    createdAt: toIso(row.created_at)
  };
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  const text = String(value).replace(" ", "T");
  return new Date(text.endsWith("Z") ? text : `${text}Z`).toISOString();
}

function toDate(value: unknown) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}
