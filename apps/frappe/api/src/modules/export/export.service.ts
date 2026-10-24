import { sql, type Kysely } from "kysely";
import { createHash } from "node:crypto";
import { AppError } from "@codexsun/framework/errors";
import {
  FrappeConnectionAccess,
  FrappeConnectionRepository,
  createEnquiryJobComment,
  listEnquiryJobComments,
  requestFrappe,
  updateEnquiryJobComment
} from "../connection/index.js";
import type { FrappeDatabase, FrappeSettings } from "../connection/index.js";
import {
  mappedEmployeeCodeForLocalUser,
  mappedLocalUserForEmployeeCode
} from "../user-mapping/index.js";
import type { FrappeUserMappingDatabase } from "../user-mapping/index.js";
import { normalizeFrappeEnquiryTitle } from "./enquiry-title.js";
import { assertFrappeExportAllowed } from "./export.policy.js";
import { resolveEnquiryMobile } from "./enquiry-mobile.js";
import { resolveEnquiryStatus } from "./enquiry-status.js";
import type {
  ExportKind,
  ExportMode,
  ExportOutcome,
  ExportPage,
  ExportProgress,
  ExportRow
} from "./export.types.js";

const pageSize = 50;

export class FrappeExportService {
  constructor(
    private readonly database: Kysely<FrappeDatabase>,
    private readonly secret: string,
    private readonly defaults: FrappeSettings
  ) {}

  async preview(kind: ExportKind, page: number): Promise<ExportPage> {
    const offset = (page - 1) * pageSize;
    const result = await this.list(kind, offset);
    return { items: result.items, page, pageSize, total: result.total };
  }

  async validateSelection(kind: ExportKind, ids: number[]) {
    const unique = await this.validateRecordIds(kind, ids, 50);
    const settings = await this.settings();
    return { ids: unique, baseUrl: settings.baseUrl };
  }

  async validateRecordIds(kind: ExportKind, ids: number[], limit = 100) {
    const unique = [...new Set(ids)];
    if (!unique.length || unique.length > limit)
      throw AppError.validation(`Select 1 to ${limit} records.`);
    for (const id of unique) {
      if (!Number.isSafeInteger(id) || id < 1 || !(await this.exists(kind, id)))
        throw AppError.notFound(`Local ${kind} record #${id} was not found.`);
    }
    return unique;
  }

  async exportSelection(
    kind: ExportKind,
    ids: number[],
    mode: ExportMode,
    expectedBaseUrl: string,
    report: (progress: ExportProgress) => Promise<void>
  ) {
    assertFrappeExportAllowed(kind, mode);
    const progress: ExportProgress = {
      scanned: 0,
      exported: 0,
      failed: 0,
      failures: [],
      results: []
    };
    for (const id of ids) {
      const settings = await this.settings();
      if (settings.baseUrl !== expectedBaseUrl)
        throw AppError.conflict("The verified Frappe connection changed during export.");
      try {
        const existing = await this.verifyExisting(kind, id, settings);
        if (mode === "verify") {
          progress.results.push({ id, ...existing, message: existing.message ?? null });
        } else {
          if (kind === "contacts" && existing.outcome === "mismatch")
            throw AppError.conflict(existing.message ?? "Frappe contact identity does not match.");
          let remoteName = "";
          if (kind === "contacts")
            remoteName = await this.exportContact(
              id,
              settings,
              existing.remoteName,
              existing.outcome === "new"
            );
          if (kind === "enquiries")
            remoteName = await this.exportEnquiry(id, settings, existing.remoteName);
          if (kind === "activities")
            remoteName = await this.exportActivity(id, settings, existing.remoteName);
          if (kind === "call-logs")
            remoteName = await this.exportCallLog(id, settings, existing.remoteName);
          progress.exported += 1;
          progress.results.push({
            id,
            outcome: "exported",
            remoteName,
            message: existing.outcome === "matched" ? "Existing Frappe record updated." : null
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Export failed.";
        progress.failed += 1;
        progress.failures.push({ id, message });
        progress.results.push({ id, outcome: "blocked", remoteName: null, message });
      }
      progress.scanned += 1;
      await report(progress);
    }
    return progress;
  }

  async liveSync(
    kind: ExportKind,
    expectedBaseUrl: string,
    report: (progress: ExportProgress) => Promise<void>
  ) {
    const ids = await this.liveCandidateIds(kind);
    if (!ids.length) return { scanned: 0, exported: 0, failed: 0, failures: [], results: [] };
    return this.exportSelection(kind, ids, "export", expectedBaseUrl, report);
  }

  private async liveCandidateIds(kind: ExportKind) {
    const query = {
      contacts: sql`SELECT c.id FROM core_contacts c LEFT JOIN frappe_contact_exports l ON l.local_contact_id=c.id WHERE c.deleted_at IS NULL AND (l.id IS NULL OR c.updated_at > l.updated_at) ORDER BY c.id ASC LIMIT 50`,
      enquiries: sql`SELECT e.id FROM crm_enquiries e LEFT JOIN frappe_enquiry_sync l ON l.enquiry_id=e.id WHERE l.id IS NULL OR e.updated_at > l.synced_at ORDER BY e.id ASC LIMIT 50`,
      activities: sql`SELECT a.id FROM crm_enquiry_activity a LEFT JOIN frappe_activity_imports l ON l.local_activity_id=a.id LEFT JOIN frappe_enquiry_sync e ON e.enquiry_id=a.enquiry_id WHERE e.remote_name IS NOT NULL AND (l.id IS NULL OR a.updated_at > l.updated_at) ORDER BY a.id ASC LIMIT 50`,
      "call-logs": sql`SELECT c.id FROM crm_call_logs c WHERE c.remote_name IS NULL ORDER BY c.id ASC LIMIT 50`
    }[kind];
    const rows = await query.execute(this.database);
    return rows.rows.map((row) => Number((row as { id: number }).id));
  }

  private async verifyExisting(
    kind: ExportKind,
    id: number,
    settings: FrappeSettings
  ): Promise<{ outcome: ExportOutcome; remoteName: string | null; message?: string | null }> {
    if (kind === "contacts") return this.verifyContact(id, settings);
    if (kind === "enquiries") return this.verifyEnquiry(id, settings);
    if (kind === "activities") return this.verifyActivity(id, settings);
    return this.verifyCallLog(id, settings);
  }

  private async list(kind: ExportKind, offset: number) {
    if (kind === "contacts") {
      const rows = await sql<ExportRow>`SELECT c.id, c.name AS label, c.code,
        COALESCE(c.primary_phone, c.primary_email) AS detail,
        link.remote_name AS remoteName,
        CASE WHEN REGEXP_REPLACE(COALESCE(c.primary_phone,''),'[^0-9]','') REGEXP '^[0-9]{10}$'
          THEN NULL ELSE 'A 10-digit mobile number is required.' END AS dependency
        FROM core_contacts c LEFT JOIN frappe_contact_exports link ON link.local_contact_id=c.id
        WHERE c.deleted_at IS NULL ORDER BY c.id ASC LIMIT ${pageSize} OFFSET ${offset}`.execute(
        this.database
      );
      const count = await sql<{
        total: number;
      }>`SELECT COUNT(*) AS total FROM core_contacts WHERE deleted_at IS NULL`.execute(
        this.database
      );
      return { items: rows.rows, total: Number(count.rows[0]?.total ?? 0) };
    }
    if (kind === "enquiries") {
      const rows = await sql<ExportRow>`SELECT e.id, e.title AS label, NULL AS code,
        CONCAT('#', e.enquiry_no, ' · ', e.status) AS detail,
        link.remote_name AS remoteName, NULL AS dependency
        FROM crm_enquiries e
        LEFT JOIN frappe_enquiry_sync link ON link.enquiry_id=e.id
        ORDER BY e.id ASC LIMIT ${pageSize} OFFSET ${offset}`.execute(this.database);
      const count = await sql<{
        total: number;
      }>`SELECT COUNT(*) AS total FROM crm_enquiries`.execute(this.database);
      return { items: rows.rows, total: Number(count.rows[0]?.total ?? 0) };
    }
    if (kind === "activities") {
      const rows = await sql<ExportRow>`SELECT activity.id, activity.action AS label, NULL AS code,
        LEFT(activity.details, 160) AS detail,
        link.remote_name AS remoteName,
        CASE WHEN enquiry.remote_name IS NULL THEN 'Export enquiry first' ELSE NULL END AS dependency
        FROM crm_enquiry_activity activity
        LEFT JOIN frappe_activity_imports link ON link.local_activity_id=activity.id
        LEFT JOIN frappe_enquiry_sync enquiry ON enquiry.enquiry_id=activity.enquiry_id
        ORDER BY activity.id ASC LIMIT ${pageSize} OFFSET ${offset}`.execute(this.database);
      const count = await sql<{
        total: number;
      }>`SELECT COUNT(*) AS total FROM crm_enquiry_activity`.execute(this.database);
      return { items: rows.rows, total: Number(count.rows[0]?.total ?? 0) };
    }
    const rows =
      await sql<ExportRow>`SELECT id, CONCAT(from_number, ' → ', to_number) AS label, NULL AS code,
      CONCAT(direction, ' · ', call_status) AS detail,
      remote_name AS remoteName, NULL AS dependency
      FROM crm_call_logs ORDER BY id ASC LIMIT ${pageSize} OFFSET ${offset}`.execute(this.database);
    const count = await sql<{ total: number }>`SELECT COUNT(*) AS total FROM crm_call_logs`.execute(
      this.database
    );
    return { items: rows.rows, total: Number(count.rows[0]?.total ?? 0) };
  }

  private async exists(kind: ExportKind, id: number) {
    const table = {
      contacts: sql.raw("core_contacts"),
      enquiries: sql.raw("crm_enquiries"),
      activities: sql.raw("crm_enquiry_activity"),
      "call-logs": sql.raw("crm_call_logs")
    }[kind];
    const result = await sql<{
      id: number;
    }>`SELECT id FROM ${table} WHERE id=${id} LIMIT 1`.execute(this.database);
    return Boolean(result.rows[0]);
  }

  private async settings() {
    const settings = await new FrappeConnectionAccess(
      this.database,
      this.secret,
      this.defaults
    ).exportCredentials();
    if (!settings)
      throw AppError.conflict("Enable and verify the Frappe connection before exporting.");
    return settings;
  }

  private async verifyContact(id: number, settings: FrappeSettings) {
    const result = await sql<{
      code: string;
      name: string;
      type_name: string | null;
      primary_phone: string | null;
      remote_name: string | null;
    }>`SELECT c.code,c.name,c.type_name,c.primary_phone,link.remote_name
      FROM core_contacts c LEFT JOIN frappe_contact_exports link ON link.local_contact_id=c.id
      WHERE c.id=${id} AND c.deleted_at IS NULL LIMIT 1`.execute(this.database);
    const contact = result.rows[0];
    if (!contact) throw AppError.notFound("Contact was not found.");
    const contactType = contact.type_name?.trim().toLowerCase();
    const doctype =
      contactType === "supplier" ? "Supplier" : contactType === "customer" ? "Customer" : null;
    const nameField = doctype === "Supplier" ? "supplier_name" : "customer_name";
    if (!doctype)
      return {
        outcome: "mismatch" as const,
        remoteName: null,
        message: "Set this contact type to Customer or Supplier before verifying its Frappe ID."
      };
    const sourceRecords = await this.findRemote<{ name: string; [key: string]: unknown }>(
      doctype,
      ["name", nameField],
      [["name", "=", contact.code]],
      settings
    );
    if (sourceRecords.length !== 1 || sourceRecords[0]?.name !== contact.code)
      return {
        outcome: "mismatch" as const,
        remoteName: null,
        message: `Frappe ${doctype} ${contact.code} was not found. No new Frappe record will be created.`
      };
    const mobile = contact.primary_phone?.replace(/\D/gu, "") ?? "";
    if (!/^\d{10}$/u.test(mobile)) {
      return {
        outcome: "mismatch" as const,
        remoteName: null,
        message: "Add a 10-digit mobile number before verifying this Frappe contact."
      };
    }
    if (contact.remote_name) {
      const remote = await requestFrappe<{ data?: { name?: string; mobile_number?: string } }>(
        `/api/resource/Mobile Contact/${encodeURIComponent(contact.remote_name)}`,
        "GET",
        settings
      );
      if (remote.data?.name !== contact.remote_name) {
        return {
          outcome: "mismatch" as const,
          remoteName: null,
          message:
            "The linked Frappe Mobile Contact is missing. No replacement record will be created."
        };
      }
      if (remote.data.mobile_number?.replace(/\D/gu, "") !== mobile)
        return {
          outcome: "mismatch" as const,
          remoteName: null,
          message: "The local mobile does not match the linked Frappe Mobile Contact."
        };
      return { outcome: "linked" as const, remoteName: contact.remote_name };
    }
    const candidates = await this.findRemote<{ name: string; mobile_number?: string }>(
      "Mobile Contact",
      ["name", "mobile_number"],
      [["mobile_number", "=", mobile]],
      settings
    );
    if (candidates.length > 1)
      return {
        outcome: "mismatch" as const,
        remoteName: null,
        message:
          "Multiple Frappe Mobile Contacts use this number. Review the records before export."
      };
    if (candidates.length === 1) {
      return { outcome: "matched" as const, remoteName: candidates[0]!.name };
    }
    return {
      outcome: "new" as const,
      remoteName: null,
      message: `A Mobile Contact will be created with only the mobile number for Frappe ${doctype} ${contact.code}.`
    };
  }

  private async verifyEnquiry(id: number, settings: FrappeSettings) {
    const result = await sql<{
      title: string;
      captured_phone: string | null;
      captured_name: string | null;
      enquired_at: string | Date;
      created_by: string;
      remote_name: string | null;
    }>`SELECT e.title, e.captured_phone, e.captured_name, e.enquired_at,
      e.created_by, link.remote_name
      FROM crm_enquiries e LEFT JOIN frappe_enquiry_sync link ON link.enquiry_id=e.id
      WHERE e.id=${id} LIMIT 1`.execute(this.database);
    const enquiry = result.rows[0];
    if (!enquiry) throw AppError.notFound("Enquiry was not found.");
    const title = normalizeFrappeEnquiryTitle(enquiry.title);
    if (enquiry.remote_name) {
      await this.verifyRemote("Enquiry", enquiry.remote_name, settings);
      return { outcome: "linked" as const, remoteName: enquiry.remote_name };
    }
    const candidates = await this.findRemote<{
      name: string;
      title?: string;
      mobile?: string;
      customer?: string;
      date?: string;
    }>(
      "Enquiry",
      ["name", "title", "mobile", "customer", "date"],
      [
        ["title", "=", title],
        ["date", "=", dateOnly(enquiry.enquired_at)]
      ],
      settings
    );
    const exact = candidates.filter(
      (candidate) =>
        normalized(candidate.title) === normalized(title) &&
        (enquiry.captured_phone
          ? samePhone(candidate.mobile, enquiry.captured_phone)
          : Boolean(
              enquiry.captured_name &&
              normalized(candidate.customer) === normalized(enquiry.captured_name)
            ))
    );
    if (exact.length === 1) {
      await this.ensureUnclaimed("enquiries", exact[0]!.name, id);
      return { outcome: "matched" as const, remoteName: exact[0]!.name };
    }
    if (candidates.length)
      throw AppError.conflict("Similar Frappe enquiries exist. Review them before export.");
    if (!enquiry.captured_phone?.trim())
      throw AppError.conflict("Add a mobile number before creating this enquiry in Frappe.");
    await this.creatorEmployee(enquiry.created_by, settings);
    return { outcome: "new" as const, remoteName: null };
  }

  private async creatorEmployee(email: string, settings: FrappeSettings) {
    const code = await mappedEmployeeCodeForLocalUser(
      this.database as Kysely<FrappeUserMappingDatabase>,
      email,
      settings.baseUrl
    );
    if (!code)
      throw AppError.conflict("Map this enquiry's creator to a Frappe employee before export.");
    return code;
  }

  private async verifyActivity(id: number, settings: FrappeSettings) {
    const result = await sql<{
      details: string;
      action: string;
      created_at: string | Date;
      enquiry_remote: string | null;
      remote_name: string | null;
    }>`SELECT activity.details, activity.action, activity.created_at,
      enquiry.remote_name AS enquiry_remote, link.remote_name
      FROM crm_enquiry_activity activity
      LEFT JOIN frappe_enquiry_sync enquiry ON enquiry.enquiry_id=activity.enquiry_id
      LEFT JOIN frappe_activity_imports link ON link.local_activity_id=activity.id
      WHERE activity.id=${id} LIMIT 1`.execute(this.database);
    const activity = result.rows[0];
    if (!activity) throw AppError.notFound("Activity was not found.");
    if (!activity.enquiry_remote) throw AppError.conflict("Export the activity's enquiry first.");
    const messages = await listEnquiryJobComments(settings, [activity.enquiry_remote]);
    if (activity.remote_name) {
      if (!messages.some((message) => message.name === activity.remote_name))
        throw AppError.conflict("The linked Frappe activity is missing. Review before export.");
      return { outcome: "linked" as const, remoteName: activity.remote_name };
    }
    const similar = messages.filter(
      (message) =>
        normalized(message.comment) === normalized(activity.details) &&
        normalized(message.mode) === normalized(activity.action)
    );
    const createdAt = new Date(activity.created_at).getTime();
    const exact = similar.filter(
      (message) =>
        message.creation && Math.abs(new Date(message.creation).getTime() - createdAt) < 60_000
    );
    if (exact.length === 1 && exact[0]!.name) {
      await this.ensureUnclaimed("activities", exact[0]!.name!, id);
      return { outcome: "matched" as const, remoteName: exact[0]!.name! };
    }
    if (similar.length)
      throw AppError.conflict("Similar Frappe activities exist. Review them before export.");
    return { outcome: "new" as const, remoteName: null };
  }

  private async verifyCallLog(id: number, settings: FrappeSettings) {
    const result = await sql<{
      from_number: string;
      to_number: string;
      direction: string;
      started_at: string | Date;
      remote_name: string | null;
    }>`SELECT from_number, to_number, direction, started_at, remote_name
      FROM crm_call_logs WHERE id=${id} LIMIT 1`.execute(this.database);
    const call = result.rows[0];
    if (!call) throw AppError.notFound("Call log was not found.");
    if (call.remote_name) {
      await this.verifyRemote("CRM Call Log", call.remote_name, settings);
      return { outcome: "linked" as const, remoteName: call.remote_name };
    }
    const candidates = await this.findRemote<{ name: string }>(
      "CRM Call Log",
      ["name"],
      [
        ["from", "=", call.from_number],
        ["to", "=", call.to_number],
        ["type", "=", call.direction],
        ["start_time", "=", frappeDateTime(call.started_at)]
      ],
      settings
    );
    if (candidates.length === 1) {
      await this.ensureUnclaimed("call-logs", candidates[0]!.name, id);
      return { outcome: "matched" as const, remoteName: candidates[0]!.name };
    }
    if (candidates.length)
      throw AppError.conflict(
        "Multiple matching Frappe call logs exist. Review them before export."
      );
    return { outcome: "new" as const, remoteName: null };
  }

  private async findRemote<T>(
    doctype: string,
    fields: string[],
    filters: unknown[],
    settings: FrappeSettings
  ): Promise<T[]> {
    const query = new URLSearchParams({
      fields: JSON.stringify(fields),
      filters: JSON.stringify(filters),
      limit_page_length: "51"
    });
    const response = await requestFrappe<{ data?: T[] }>(
      `/api/resource/${encodeURIComponent(doctype)}?${query}`,
      "GET",
      settings
    );
    if (!Array.isArray(response.data))
      throw AppError.conflict("Frappe returned an invalid verification result.");
    if (response.data.length > 50)
      throw AppError.conflict("Too many similar Frappe records exist. Review before export.");
    return response.data;
  }

  private async verifyRemote(doctype: string, name: string, settings: FrappeSettings) {
    const response = await requestFrappe<{ data?: { name?: string } }>(
      `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
      "GET",
      settings
    );
    if (response.data?.name !== name)
      throw AppError.conflict("The linked Frappe record is missing. Review before export.");
  }

  private async ensureUnclaimed(kind: ExportKind, name: string, id: number) {
    let claimedId: number | undefined;
    if (kind === "contacts") {
      const row = await sql<{
        local_contact_id: number;
      }>`SELECT local_contact_id FROM frappe_contact_exports WHERE remote_name=${name} LIMIT 1`.execute(
        this.database
      );
      claimedId = row.rows[0]?.local_contact_id;
    } else if (kind === "enquiries") {
      const row = await sql<{
        enquiry_id: number;
      }>`SELECT enquiry_id FROM frappe_enquiry_sync WHERE remote_name=${name} LIMIT 1`.execute(
        this.database
      );
      claimedId = row.rows[0]?.enquiry_id;
    } else if (kind === "activities") {
      const row = await sql<{
        local_activity_id: number;
      }>`SELECT local_activity_id FROM frappe_activity_imports WHERE remote_name=${name} LIMIT 1`.execute(
        this.database
      );
      claimedId = row.rows[0]?.local_activity_id;
    } else {
      const row = await sql<{
        id: number;
      }>`SELECT id FROM crm_call_logs WHERE remote_name=${name} LIMIT 1`.execute(this.database);
      claimedId = row.rows[0]?.id;
    }
    if (claimedId && claimedId !== id)
      throw AppError.conflict("This Frappe record is already linked to another local record.");
  }

  private async exportContact(
    id: number,
    settings: FrappeSettings,
    verifiedRemoteName: string | null,
    createIfMissing: boolean
  ) {
    const result = await sql<{
      primary_phone: string | null;
      remote_name: string | null;
    }>`
      SELECT c.primary_phone, link.remote_name
      FROM core_contacts c LEFT JOIN frappe_contact_exports link ON link.local_contact_id=c.id
      WHERE c.id=${id} AND c.deleted_at IS NULL LIMIT 1`.execute(this.database);
    const contact = result.rows[0];
    if (!contact) throw AppError.notFound("Contact was not found.");
    const linkedName = verifiedRemoteName;
    if (!linkedName && !createIfMissing)
      throw AppError.conflict(
        "No matching Frappe Mobile Contact was verified. Verify it again before export."
      );
    const mobile = contact.primary_phone?.replace(/\D/gu, "") ?? "";
    if (!/^\d{10}$/u.test(mobile)) {
      throw AppError.conflict(
        "Add a 10-digit mobile number before exporting this contact to Frappe."
      );
    }
    const response = await requestFrappe<{
      data?: { name?: string; mobile_number?: string };
    }>(
      linkedName
        ? `/api/resource/Mobile Contact/${encodeURIComponent(linkedName)}`
        : "/api/resource/Mobile Contact",
      linkedName ? "PUT" : "POST",
      settings,
      { mobile_number: mobile },
      { allowExport: true }
    );
    const remoteName = response.data?.name || linkedName;
    if (!remoteName) throw AppError.conflict("Frappe did not return the contact ID.");
    if (response.data?.mobile_number && response.data.mobile_number !== mobile)
      throw AppError.conflict("Frappe returned a different mobile number than requested.");
    await sql`INSERT INTO frappe_contact_exports (remote_name, local_contact_id)
      VALUES (${remoteName}, ${id}) ON DUPLICATE KEY UPDATE remote_name=VALUES(remote_name)`.execute(
      this.database
    );
    return remoteName;
  }

  private async exportEnquiry(
    id: number,
    settings: FrappeSettings,
    verifiedRemoteName: string | null
  ) {
    const result = await sql<{
      title: string;
      description: string | null;
      captured_phone: string | null;
      status: string;
      status_name: string;
      priority: string;
      enquired_at: string | Date;
      due_date: string | Date | null;
      captured_name: string | null;
      source: string;
      created_by: string;
      contact_id: number | null;
      assigned_user_id: number | null;
      assignee_email: string | null;
      remote_name: string | null;
    }>`SELECT e.title, e.description, e.captured_phone, status_master.code AS status, status_master.name AS status_name, priority_master.name AS priority,
      e.enquired_at, e.due_date, e.captured_name, e.source, e.created_by, e.contact_id,
      e.assigned_user_id, assignee.email AS assignee_email,
      link.remote_name FROM crm_enquiries e
      INNER JOIN crm_enquiry_statuses status_master ON status_master.id=e.status_id
      INNER JOIN crm_enquiry_priorities priority_master ON priority_master.id=e.priority_id
      LEFT JOIN frappe_enquiry_sync link ON link.enquiry_id=e.id
      LEFT JOIN app_users assignee ON assignee.id=e.assigned_user_id AND assignee.status='active'
      WHERE e.id=${id} LIMIT 1`.execute(this.database);
    const enquiry = result.rows[0];
    if (!enquiry) throw AppError.notFound("Enquiry was not found.");
    const title = normalizeFrappeEnquiryTitle(enquiry.title);
    if (!title)
      throw AppError.validation("Add readable text to the enquiry title before exporting.");
    const linkedName = verifiedRemoteName ?? enquiry.remote_name;
    const assignee = enquiry.assigned_user_id
      ? await mappedEmployeeCodeForLocalUser(
          this.database as Kysely<FrappeUserMappingDatabase>,
          enquiry.assignee_email ?? "",
          settings.baseUrl
        )
      : null;
    if (enquiry.assigned_user_id && !assignee)
      throw AppError.conflict(
        "Map this enquiry's assignee to one active Frappe employee before export."
      );
    if (
      assignee &&
      (await mappedLocalUserForEmployeeCode(
        this.database as Kysely<FrappeUserMappingDatabase>,
        assignee,
        settings.baseUrl
      )) !== enquiry.assigned_user_id
    )
      throw AppError.conflict(
        "This Frappe employee has ambiguous CRM user mappings. Resolve the assignee mapping before export."
      );
    const creator = linkedName
      ? undefined
      : await this.creatorEmployee(enquiry.created_by, settings);
    if (!linkedName && !enquiry.captured_phone?.trim())
      throw AppError.conflict("Add a mobile number before creating this enquiry in Frappe.");
    let mobileLink: Awaited<ReturnType<typeof resolveEnquiryMobile>> | undefined;
    if (!linkedName) {
      let customer: string | null = null;
      let mobileOnly = false;
      if (enquiry.contact_id) {
        const identities = await this.database
          .selectFrom("frappe_contact_customer_identity")
          .select(["source_key", "remote_name"])
          .where("local_contact_id", "=", enquiry.contact_id)
          .execute();
        const matches = identities.filter(
          (identity) =>
            identity.source_key ===
            createHash("sha256")
              .update(
                JSON.stringify([
                  new URL(settings.baseUrl).origin.toLowerCase(),
                  "Mobile Contact Customer",
                  "customer",
                  identity.remote_name
                ])
              )
              .digest("hex")
        );
        if (matches.length > 1)
          throw AppError.conflict(
            "This enquiry's Customer has no unique identity on the connected Frappe site. Verify its Customer mapping before retrying."
          );
        customer = matches[0]?.remote_name ?? null;
        mobileOnly = matches.length === 0;
      }
      mobileLink = await resolveEnquiryMobile(settings, enquiry.captured_phone!, customer, {
        mobileOnly
      });
    }
    const payload = {
      title,
      enquiry_details: enquiry.description || title,
      mobile: enquiry.captured_phone || undefined,
      ...mobileLink,
      date: dateOnly(enquiry.enquired_at),
      due_date: enquiry.due_date ? dateOnly(enquiry.due_date) : undefined,
      priority: titleCase(enquiry.priority),
      status: await resolveEnquiryStatus(settings, enquiry.status_name),
      user_employee: creator,
      assigned_to_employee: assignee
    };
    const response = await requestFrappe<{ data?: { name?: string } }>(
      linkedName
        ? `/api/resource/Enquiry/${encodeURIComponent(linkedName)}`
        : "/api/resource/Enquiry",
      linkedName ? "PUT" : "POST",
      settings,
      payload,
      { allowExport: true }
    );
    const remoteName = response.data?.name || linkedName;
    if (!remoteName) throw AppError.conflict("Frappe did not return the enquiry ID.");
    await new FrappeConnectionRepository(this.database).save(id, remoteName);
    return remoteName;
  }

  private async exportActivity(
    id: number,
    settings: FrappeSettings,
    verifiedRemoteName: string | null
  ) {
    const result = await sql<{
      details: string;
      action: string;
      enquiry_remote: string | null;
      remote_name: string | null;
    }>`SELECT activity.details, activity.action, enquiry.remote_name AS enquiry_remote,
      link.remote_name FROM crm_enquiry_activity activity
      LEFT JOIN frappe_enquiry_sync enquiry ON enquiry.enquiry_id=activity.enquiry_id
      LEFT JOIN frappe_activity_imports link ON link.local_activity_id=activity.id
      WHERE activity.id=${id} LIMIT 1`.execute(this.database);
    const activity = result.rows[0];
    if (!activity) throw AppError.notFound("Activity was not found.");
    if (!activity.enquiry_remote) throw AppError.conflict("Export the activity's enquiry first.");
    const linkedName = verifiedRemoteName ?? activity.remote_name;
    const messages = await listEnquiryJobComments(settings, [activity.enquiry_remote]);
    let remoteName = linkedName ?? "";
    if (linkedName) {
      if (!messages.some((message) => message.name === linkedName))
        throw AppError.conflict("The linked Frappe activity is missing. Review before export.");
      await updateEnquiryJobComment(
        settings,
        linkedName,
        { comment: activity.details, mode: activity.action },
        true
      );
    } else {
      const created = await createEnquiryJobComment(
        settings,
        {
          enquiryName: activity.enquiry_remote,
          comment: activity.details,
          mode: activity.action
        },
        true
      );
      remoteName = created.name;
    }
    if (!remoteName) throw AppError.conflict("Frappe did not return the activity ID.");
    await sql`INSERT INTO frappe_activity_imports (remote_name, local_activity_id)
      VALUES (${remoteName}, ${id}) ON DUPLICATE KEY UPDATE remote_name=VALUES(remote_name)`.execute(
      this.database
    );
    return remoteName;
  }

  private async exportCallLog(
    id: number,
    settings: FrappeSettings,
    verifiedRemoteName: string | null
  ) {
    const result = await sql<{
      direction: string;
      from_number: string;
      to_number: string;
      call_status: string;
      duration_seconds: number;
      user_email: string | null;
      started_at: string | Date;
      remote_name: string | null;
    }>`SELECT direction, from_number, to_number, call_status, duration_seconds,
      user_email, started_at, remote_name FROM crm_call_logs WHERE id=${id} LIMIT 1`.execute(
      this.database
    );
    const call = result.rows[0];
    if (!call) throw AppError.notFound("Call log was not found.");
    const linkedName = verifiedRemoteName ?? call.remote_name;
    const payload = {
      from: call.from_number,
      to: call.to_number,
      type: call.direction,
      status: call.call_status,
      duration: call.duration_seconds,
      start_time: frappeDateTime(call.started_at),
      ...(call.direction === "Incoming"
        ? { receiver: call.user_email }
        : { caller: call.user_email })
    };
    const response = await requestFrappe<{ data?: { name?: string } }>(
      linkedName
        ? `/api/resource/CRM%20Call%20Log/${encodeURIComponent(linkedName)}`
        : "/api/resource/CRM%20Call%20Log",
      linkedName ? "PUT" : "POST",
      settings,
      payload,
      { allowExport: true }
    );
    const remoteName = response.data?.name || linkedName;
    if (!remoteName) throw AppError.conflict("Frappe did not return the call log ID.");
    await sql`UPDATE crm_call_logs SET remote_name=${remoteName} WHERE id=${id}`.execute(
      this.database
    );
    return remoteName;
  }
}

function dateOnly(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function frappeDateTime(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 19).replace("T", " ") : String(value);
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

function normalized(value: string | null | undefined) {
  return (value || "").trim().replace(/\s+/gu, " ").toLowerCase();
}

function digits(value: string | null | undefined) {
  return (value || "").replace(/\D/gu, "");
}

function samePhone(left: string | null | undefined, right: string | null | undefined) {
  const a = digits(left);
  const b = digits(right);
  if (a.length < 7 || b.length < 7) return false;
  return a === b || (a.length >= 10 && b.length >= 10 && a.slice(-10) === b.slice(-10));
}
