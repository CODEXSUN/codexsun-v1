import { AppError } from "@codexsun/framework/errors";
import { createHash } from "node:crypto";
import type { Transaction } from "kysely";
import { EnquiryRepository } from "./enquiry.repository.js";
import type {
  EnquiryDatabase,
  EnquiryInput,
  EnquiryListOptions,
  EnquiryRecord
} from "./enquiry.types.js";
import { commentPlainText, sanitizeCommentHtml } from "./enquiry.comment-html.js";

export type EnquiryRelations = {
  contact: (id: number) => Promise<{ name: string; primaryPhone?: string | null } | null>;
  resolveOrCreateCustomer: (
    input: {
      name: string | null;
      mobile: string | null;
    },
    transaction?: Transaction<EnquiryDatabase>
  ) => Promise<{ id: number; name: string }>;
  resolveExternalCustomer?: (input: {
    externalKey: string;
    externalCode: string;
    name: string;
    mobile: string;
  }) => Promise<{ id: number; name: string }>;
  user: (id: number) => Promise<{ name: string } | null>;
  listIn: (id: number) => Promise<{ name: string } | null>;
  status: (id: number) => Promise<{ name: string; code: string } | null>;
  priority: (id: number) => Promise<{ name: string } | null>;
};

export type PendingClosureLookup = (enquiryIds: number[]) => Promise<Set<number>>;

export class EnquiryService {
  constructor(
    private readonly repository: EnquiryRepository,
    private readonly relations: EnquiryRelations,
    private readonly viewer: Pick<EnquiryListOptions, "actorEmail" | "actorUserId" | "canViewAll">,
    private readonly pendingClosureLookup?: PendingClosureLookup
  ) {}

  async listPage(options: Omit<EnquiryListOptions, keyof typeof this.viewer>) {
    const page = await this.repository.listPage({ ...options, ...this.viewer });
    const pendingIds = this.pendingClosureLookup
      ? await this.pendingClosureLookup(page.items.map((record) => record.id))
      : new Set<number>();
    const contacts = new Map<number, ReturnType<EnquiryRelations["contact"]>>();
    for (const record of page.items) {
      if (record.contactId && !contacts.has(record.contactId)) {
        contacts.set(record.contactId, this.relations.contact(record.contactId));
      }
    }
    return {
      ...page,
      items: await Promise.all(
        page.items.map(async (record) => ({
          ...record,
          contactName: record.contactId
            ? ((await contacts.get(record.contactId))?.name ?? null)
            : null,
          closurePending: pendingIds.has(record.id)
        }))
      )
    };
  }

  report(filters: Pick<EnquiryListOptions, "fromAt" | "toAt" | "assignedUserId">) {
    return this.repository.report({
      ...this.viewer,
      scope: "all",
      page: 1,
      pageSize: 1,
      search: "",
      filter: "all",
      ...filters
    });
  }

  async get(id: number) {
    const record = await this.repository.get(id);
    if (!record) throw AppError.notFound("Enquiry was not found.");
    if (
      !this.viewer.canViewAll &&
      record.assignedUserId !== this.viewer.actorUserId &&
      record.createdBy.toLowerCase() !== this.viewer.actorEmail.toLowerCase()
    ) {
      throw AppError.forbidden("You cannot view this enquiry.");
    }
    return this.withContact(record);
  }

  async create(input: EnquiryInput, actor: string) {
    if (input.capturedPhone?.trim() && !/^\d{10}$/.test(input.capturedPhone.trim())) {
      throw AppError.validation("Enter a 10-digit mobile number.");
    }
    const prepared = await this.prepare(input, null);
    const record = await this.repository.create(prepared, actor, (transaction) =>
      this.resolveContact(prepared, transaction)
    );
    if (!record) throw AppError.notFound("Enquiry could not be created.");
    return this.withContact(record);
  }

  async createImported(
    input: EnquiryInput,
    actor: string,
    source: {
      enquiryNo: number;
      createdAt: string;
      updatedAt: string;
      createdBy: string;
      externalCustomer?: { externalKey: string; code: string; name: string; mobile: string };
    }
  ) {
    if (input.capturedPhone?.trim() && !/^\d{10}$/.test(input.capturedPhone.trim())) {
      throw AppError.validation("Enter a 10-digit mobile number.");
    }
    let prepared = await this.prepare(input, null, true);
    if (source.externalCustomer && this.relations.resolveExternalCustomer) {
      const contact = await this.relations.resolveExternalCustomer({
        ...source.externalCustomer,
        externalCode: source.externalCustomer.code
      });
      prepared = { ...prepared, contactId: contact.id, capturedName: contact.name };
    }
    let record: EnquiryRecord | null;
    try {
      record = await this.repository.create(
        prepared,
        actor,
        source.externalCustomer && this.relations.resolveExternalCustomer
          ? undefined
          : (transaction) => this.resolveContact(prepared, transaction),
        source
      );
    } catch (error) {
      if (source.externalCustomer || !isAmbiguousContactMatch(error)) throw error;
      record = await this.repository.create(prepared, actor, undefined, source);
    }
    if (!record) throw AppError.notFound("Enquiry could not be created.");
    return this.withContact(record);
  }

  async importComment(
    enquiryId: number,
    comment: {
      id: string;
      content: string;
      author: string;
      createdAt: string;
      parentSourceId?: string | null;
      parentLocalId?: number;
    }
  ) {
    const key = (id: string) => `frappe:${createHash("sha256").update(id).digest("hex")}`;
    const parentId = comment.parentSourceId
      ? await this.repository.importedCommentId(
          enquiryId,
          key(comment.parentSourceId),
          comment.parentLocalId
        )
      : null;
    if (comment.parentSourceId && !parentId)
      throw AppError.validation("Import the Frappe parent comment before its reply.");
    await this.repository.addComment(
      enquiryId,
      parentId,
      sanitizeCommentHtml(comment.content),
      "html",
      comment.author,
      key(comment.id),
      comment.createdAt
    );
  }

  async updateImported(
    id: number,
    input: EnquiryInput,
    actor: string,
    source: {
      createdAt: string;
      updatedAt: string;
      createdBy: string;
      externalCustomer?: { externalKey: string; code: string; name: string; mobile: string };
    }
  ) {
    const externalContact =
      source.externalCustomer && this.relations.resolveExternalCustomer
        ? await this.relations.resolveExternalCustomer({
            ...source.externalCustomer,
            externalCode: source.externalCustomer.code
          })
        : null;
    const current = await this.get(id);
    const localOrigin = current.source !== "frappe";
    const prepared = await this.prepare(
      {
        ...input,
        capturedEmail: current.capturedEmail,
        ...(localOrigin
          ? {
              source: current.source,
              sourceReference: current.sourceReference,
              enquiredAt:
                input.enquiredAt.slice(0, 10) === current.enquiredAt.slice(0, 10)
                  ? current.enquiredAt
                  : input.enquiredAt
            }
          : {})
      },
      current,
      true
    );
    const record = await this.repository.update(
      id,
      prepared,
      actor,
      "Enquiry updated from Frappe",
      current.statusId,
      async () => ({ ...prepared, contactId: externalContact?.id ?? prepared.contactId }),
      false
    );
    if (!record) throw AppError.notFound("Enquiry was not found.");
    if (localOrigin) return record;
    const metadata = {
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      createdBy: source.createdBy
    };
    await this.repository.setImportedSourceMetadata(id, metadata);
    return { ...record, ...metadata };
  }

  async update(id: number, input: EnquiryInput, actor: string, importedContactId?: number | null) {
    const current = await this.requireAssignedWork(id);
    const prepared = await this.prepare(input, current);
    const record = await this.repository.update(
      id,
      prepared,
      actor,
      "Enquiry updated",
      current.statusId,
      importedContactId !== undefined
        ? async () => ({ ...prepared, contactId: importedContactId })
        : (transaction) => this.resolveContact(prepared, transaction)
    );
    if (!record) throw AppError.notFound("Enquiry was not found.");
    return this.withContact(record);
  }

  async updateProperties(
    id: number,
    patch: {
      listInId?: number | null | undefined;
      priorityId?: number | undefined;
      assignedUserId?: number | null | undefined;
      dueDate?: string | null | undefined;
      statusId?: number | undefined;
      closedReason?: string | null | undefined;
    },
    actor: string
  ) {
    const current = await this.requireAssignedWork(id);
    const changes = Object.entries(patch).filter(
      ([key, value]) => value !== undefined && current[key as keyof EnquiryRecord] !== value
    );
    if (changes.length === 0) return current;
    const prepared = await this.prepare(
      {
        ...current,
        listInId: patch.listInId === undefined ? current.listInId : patch.listInId,
        priorityId: patch.priorityId === undefined ? current.priorityId : patch.priorityId,
        assignedUserId:
          patch.assignedUserId === undefined ? current.assignedUserId : patch.assignedUserId,
        dueDate: patch.dueDate === undefined ? current.dueDate : patch.dueDate,
        statusId: patch.statusId === undefined ? current.statusId : patch.statusId,
        closedReason: patch.closedReason === undefined ? current.closedReason : patch.closedReason
      },
      current
    );
    const details = changes.map(([key, value]) => `${key}: ${value ?? "—"}`).join("; ");
    const record = await this.repository.update(id, prepared, actor, details, current.statusId);
    if (!record) throw AppError.notFound("Enquiry was not found.");
    return this.withContact(record);
  }

  async listComments(id: number) {
    await this.get(id);
    return this.repository.listComments(id);
  }

  async overviewActivity(actor: string) {
    return { commentsByYou30Days: await this.repository.commentsByActorInLast30Days(actor) };
  }

  async attention(today: string) {
    const userId = this.viewer.actorUserId;
    if (!userId) return { assignments: [], due: [] };
    const [assignments, due] = await Promise.all([
      this.repository.listAlerts(userId),
      this.repository.dueFollowUps(userId, today)
    ]);
    return { assignments, due: await Promise.all(due.map((record) => this.withContact(record))) };
  }

  summary(today: string) {
    return this.repository.summary(this.viewer, today);
  }

  async readAlert(id: number) {
    const userId = this.viewer.actorUserId;
    if (!userId) throw AppError.forbidden("A tenant user is required.");
    return { read: await this.repository.readAlert(id, userId) };
  }

  async openNewCall(id: number, actor: string) {
    await this.requireAssignedWork(id);
    const record = await this.repository.openNewCall(id, actor);
    if (!record) throw AppError.notFound("Enquiry was not found.");
    return this.withContact(record);
  }

  async addComment(
    id: number,
    body: string,
    parentId: number | null,
    actor: string,
    bodyFormat: "plain" | "html" = "plain",
    requestId?: string
  ) {
    await this.requireAssignedWork(id);
    const text = bodyFormat === "html" ? sanitizeCommentHtml(body) : body.trim();
    if (!(bodyFormat === "html" ? commentPlainText(text) : text)) {
      throw AppError.validation("Enter a comment.");
    }
    if (parentId !== null) {
      const parent = await this.repository.getComment(parentId);
      if (!parent || parent.enquiry_id !== id || parent.parent_id !== null) {
        throw AppError.validation("Select a comment from this enquiry to reply to.");
      }
    }
    return this.repository.addComment(id, parentId, text, bodyFormat, actor, requestId);
  }

  private async requireAssignedWork(id: number) {
    const record = await this.get(id);
    if (!this.viewer.canViewAll && record.assignedUserId !== this.viewer.actorUserId)
      throw AppError.forbidden("Only the assignee or an enquiry manager can post work actions.");
    return record;
  }

  private async prepare(
    input: EnquiryInput,
    current: EnquiryRecord | null,
    imported = false
  ): Promise<EnquiryInput> {
    if (input.source === "mobile") {
      input = {
        ...input,
        title: normalizeMobileText(input.title) ?? "",
        description: normalizeMobileText(input.description),
        capturedName: normalizeMobileText(input.capturedName),
        capturedPhone: input.capturedPhone?.trim() || null
      };
    }
    if (
      !this.viewer.canViewAll &&
      (current
        ? input.assignedUserId !== current.assignedUserId
        : input.assignedUserId !== null && input.assignedUserId !== this.viewer.actorUserId)
    )
      throw AppError.forbidden("Only an enquiry manager can change the assignee.");
    const title = input.title.trim() || titleFromMessage(input.description);
    if (!title) throw AppError.validation("Enter an enquiry message or title.");
    if (
      input.source !== "mobile" &&
      !input.contactId &&
      !input.capturedName?.trim() &&
      !input.capturedPhone?.trim()
    ) {
      throw AppError.validation("Customer name or mobile number is required.");
    }
    if (input.contactId && !(await this.relations.contact(input.contactId))) {
      throw AppError.validation("Select an active Core contact.");
    }
    if (input.assignedUserId && !(await this.relations.user(input.assignedUserId))) {
      throw AppError.validation("Select an active user.");
    }
    if (input.listInId && !(await this.relations.listIn(input.listInId))) {
      throw AppError.validation("Select an active List In record.");
    }
    const status = await this.relations.status(input.statusId);
    if (!status) {
      throw AppError.validation("Select an active enquiry status.");
    }
    if (!imported && status.code === "closed" && current?.status !== "closed") {
      throw AppError.validation("Enquiries must be closed through the closure approval workflow.");
    }
    const terminal = new Set(["won", "lost", "closed"]);
    if (!imported && current && current.status !== status.code) {
      if (terminal.has(current.status) && status.code !== "reopen") {
        throw AppError.validation("Re-open this enquiry before changing its status.");
      }
      if (current.status === "new" && terminal.has(status.code)) {
        throw AppError.validation("Open this new call before closing it.");
      }
      if (status.code === "reopen" && !terminal.has(current.status)) {
        throw AppError.validation("Only a completed enquiry can be re-opened.");
      }
    }
    if (terminal.has(status.code) && !input.closedReason?.trim()) {
      throw AppError.validation("Enter an outcome reason before closing this enquiry.");
    }
    if (!(await this.relations.priority(input.priorityId))) {
      throw AppError.validation("Select an active enquiry priority.");
    }
    if (input.contactId)
      return {
        ...input,
        title,
        closedReason: terminal.has(status.code) ? input.closedReason?.trim() || null : null
      };
    return {
      ...input,
      title,
      closedReason: terminal.has(status.code) ? input.closedReason?.trim() || null : null
    };
  }

  private async resolveContact(input: EnquiryInput, transaction: Transaction<EnquiryDatabase>) {
    if (input.contactId) return input;
    if (input.source === "mobile" && !input.capturedName?.trim() && !input.capturedPhone?.trim()) {
      return { ...input, contactId: null, capturedName: null, capturedPhone: null };
    }
    const contact = await this.relations.resolveOrCreateCustomer(
      { name: input.capturedName, mobile: input.capturedPhone },
      transaction
    );
    return {
      ...input,
      contactId: contact.id,
      capturedName: input.capturedName?.trim() || contact.name
    };
  }

  private async withContact(record: EnquiryRecord): Promise<EnquiryRecord> {
    const contact = record.contactId ? await this.relations.contact(record.contactId) : null;
    return { ...record, contactName: contact?.name ?? null };
  }
}

function normalizeMobileText(value: string | null) {
  if (value === null) return null;
  const text = commentPlainText(value).replace(/\s+/gu, " ").trim();
  return text || null;
}

function titleFromMessage(message: string | null) {
  return Array.from((message ?? "").replace(/\s+/gu, " ").trim())
    .slice(0, 100)
    .join("");
}

function isAmbiguousContactMatch(error: unknown) {
  if (!(error instanceof AppError) || error.code !== "CONFLICT") return false;
  return (
    typeof error.details === "object" &&
    error.details !== null &&
    "reason" in error.details &&
    error.details.reason === "ambiguous-mobile-match"
  );
}
