import { createHash } from "node:crypto";
import { sql, type Kysely } from "kysely";
import { z } from "zod";
import { AppError } from "@codexsun/framework/errors";
import { FrappeConnectionAccess, requestFrappe } from "../connection/index.js";
import type { FrappeDatabase, FrappeSettings } from "../connection/index.js";
import type { MobileCustomerResolver } from "./contact-import.types.js";

const pairSchema = z.object({
  name: z.string().min(1),
  mobile_contact: z.string().regex(/^\d{10}$/),
  customer: z.string().min(1),
  customer_name: z.string().nullable().optional()
});
const fields = ["name", "mobile_contact", "customer", "customer_name"];
const pageSize = 50;

export class FrappeContactImportService {
  constructor(
    private readonly database: Kysely<FrappeDatabase>,
    private readonly secret: string,
    private readonly defaults: FrappeSettings,
    private readonly resolveContact: MobileCustomerResolver
  ) {}

  async preview(
    page: number,
    lookups: {
      findContactByCode: (code: string) => Promise<{ id: number; code: string } | null>;
      findContactById: (id: number) => Promise<{ id: number; code: string } | null>;
    }
  ) {
    const settings = await this.settings();
    const query = new URLSearchParams({
      fields: JSON.stringify(fields),
      limit_start: String((page - 1) * pageSize),
      limit_page_length: String(pageSize + 1),
      order_by: "creation asc, name asc"
    });
    const response = await requestFrappe<{ data?: unknown }>(
      `/api/resource/Mobile Contact Customer?${query}`,
      "GET",
      settings
    );
    const parsed = z.array(pairSchema).safeParse(response.data);
    if (!parsed.success)
      throw AppError.validation("Frappe returned an invalid Mobile Contact Customer page.");
    const remote = parsed.data.slice(0, pageSize);
    const keys = remote.map((item) => this.linkKey(settings, item.name));
    const customerKeys = remote.map((item) => this.customerIdentityKey(settings, item.customer));
    const links = keys.length
      ? await this.database
          .selectFrom("frappe_contact_imports")
          .select(["remote_name", "local_contact_id"])
          .where("remote_name", "in", keys)
          .execute()
      : [];
    const localByKey = new Map(links.map((link) => [link.remote_name, link.local_contact_id]));
    const identities = customerKeys.length
      ? await this.database
          .selectFrom("frappe_contact_customer_identity")
          .select(["source_key", "remote_name", "local_contact_id"])
          .where((expression) =>
            expression.or([
              expression("source_key", "in", customerKeys),
              expression(
                "remote_name",
                "in",
                remote.map((item) => item.customer)
              )
            ])
          )
          .execute()
      : [];
    const identityByKey = new Map(identities.map((identity) => [identity.source_key, identity]));
    const identitiesByRemote = new Map<string, typeof identities>();
    for (const identity of identities) {
      const rows = identitiesByRemote.get(identity.remote_name) ?? [];
      rows.push(identity);
      identitiesByRemote.set(identity.remote_name, rows);
    }
    return {
      source: "mobile-contact-customer" as const,
      page,
      pageSize,
      hasMore: parsed.data.length > pageSize,
      items: await Promise.all(
        remote.map(async (item) => {
          const sourceKey = this.customerIdentityKey(settings, item.customer);
          const identity = identityByKey.get(sourceKey);
          const foreignIdentity = (identitiesByRemote.get(item.customer) ?? []).some(
            (candidate) => candidate.source_key !== sourceKey
          );
          const linkedId = localByKey.get(this.linkKey(settings, item.name));
          const identityId = identity?.local_contact_id ?? linkedId;
          const local = identityId
            ? await lookups.findContactById(identityId)
            : ((await lookups.findContactByCode(item.customer)) ??
              (await lookups.findContactByCode(
                `EXT-${this.identity(settings, "customer", item.customer).toUpperCase()}`
              )));
          return {
            name: item.name,
            customerId: item.customer,
            displayName: item.customer_name?.trim() || item.customer,
            email: null,
            phone: item.mobile_contact,
            localContactId: local?.id ?? identityId ?? null,
            localContactCode: local?.code ?? null,
            identityStatus: foreignIdentity
              ? ("mismatch" as const)
              : !local
                ? identityId
                  ? ("mismatch" as const)
                  : ("new" as const)
                : (identity?.remote_name === item.customer &&
                      identity.local_contact_id === local.id) ||
                    local.code === item.customer
                  ? ("matched" as const)
                  : ("mismatch" as const)
          };
        })
      )
    };
  }

  async pull(
    remoteName: string,
    findContactById: (id: number) => Promise<{ id: number; code: string } | null>
  ) {
    const settings = await this.settings();
    const response = await requestFrappe<{ data?: unknown }>(
      `/api/resource/Mobile Contact Customer/${encodeURIComponent(remoteName)}`,
      "GET",
      settings
    );
    const parsed = pairSchema.safeParse(response.data);
    if (!parsed.success || parsed.data.name !== remoteName)
      throw AppError.validation(
        "Frappe Mobile Contact Customer was not found or has invalid fields."
      );
    const pair = parsed.data;
    const mobile = await requestFrappe<{ data?: unknown }>(
      `/api/resource/Mobile Contact/${encodeURIComponent(pair.mobile_contact)}`,
      "GET",
      settings
    );
    const mobileRecord = z
      .object({ name: z.string(), mobile_number: z.string().regex(/^\d{10}$/) })
      .safeParse(mobile.data);
    if (
      !mobileRecord.success ||
      mobileRecord.data.name !== pair.mobile_contact ||
      mobileRecord.data.mobile_number !== pair.mobile_contact
    )
      throw AppError.validation("The selected customer's Mobile Contact is invalid.");
    const customer = await requestFrappe<{ data?: unknown }>(
      `/api/resource/Customer/${encodeURIComponent(pair.customer)}`,
      "GET",
      settings
    );
    const customerRecord = z
      .object({
        name: z.string(),
        customer_name: z.string().trim().min(1),
        disabled: z.union([z.number(), z.boolean()]).optional()
      })
      .safeParse(customer.data);
    if (
      !customerRecord.success ||
      customerRecord.data.name !== pair.customer ||
      customerRecord.data.disabled
    )
      throw AppError.validation("The selected Frappe Customer is missing, invalid, or disabled.");
    const key = this.linkKey(settings, pair.name);
    const existing = await this.database
      .selectFrom("frappe_contact_imports")
      .select("local_contact_id")
      .where("remote_name", "=", key)
      .executeTakeFirst();
    const sourceKey = this.customerIdentityKey(settings, pair.customer);
    const identity = await this.database
      .selectFrom("frappe_contact_customer_identity")
      .select(["remote_name", "local_contact_id"])
      .where("source_key", "=", sourceKey)
      .executeTakeFirst();
    const foreignIdentity = await this.database
      .selectFrom("frappe_contact_customer_identity")
      .select("source_key")
      .where("remote_name", "=", pair.customer)
      .where("source_key", "!=", sourceKey)
      .executeTakeFirst();
    if (foreignIdentity)
      throw AppError.conflict(
        "This Frappe customer ID is already linked from another Frappe site. Resolve the mismatch before importing."
      );
    if (
      identity &&
      (identity.remote_name !== pair.customer ||
        (existing && identity.local_contact_id !== existing.local_contact_id))
    )
      throw AppError.conflict("The Frappe customer identity has conflicting local links.");
    const existingContactId = identity?.local_contact_id ?? existing?.local_contact_id;
    if (existingContactId && !(await findContactById(existingContactId))) {
      throw AppError.conflict(
        "The imported customer link points to a missing Core contact. Resolve the link before importing."
      );
    }
    const local = await this.resolveContact({
      externalKey: this.identity(settings, "customer", pair.customer),
      externalCode: pair.customer,
      name: customerRecord.data.customer_name,
      mobile: pair.mobile_contact,
      ...(existingContactId ? { existingContactId } : {})
    });
    if (existingContactId && existingContactId !== local.id)
      throw AppError.conflict(
        "This mobile/customer association is already linked to a different Core customer."
      );
    await sql`INSERT INTO frappe_contact_customer_identity (source_key,remote_name,local_contact_id)
      VALUES (${sourceKey},${pair.customer},${local.id})
      ON DUPLICATE KEY UPDATE local_contact_id=local_contact_id`.execute(this.database);
    const savedIdentity = await this.database
      .selectFrom("frappe_contact_customer_identity")
      .select(["remote_name", "local_contact_id"])
      .where("source_key", "=", sourceKey)
      .executeTakeFirst();
    if (
      !savedIdentity ||
      savedIdentity.remote_name !== pair.customer ||
      savedIdentity.local_contact_id !== local.id
    )
      throw AppError.conflict(
        "A concurrent import linked this Frappe customer to another Core contact."
      );
    await sql`INSERT INTO frappe_contact_imports (remote_name,local_contact_id) VALUES (${key},${local.id}) ON DUPLICATE KEY UPDATE local_contact_id=local_contact_id`.execute(
      this.database
    );
    const saved = await this.database
      .selectFrom("frappe_contact_imports")
      .select("local_contact_id")
      .where("remote_name", "=", key)
      .executeTakeFirstOrThrow();
    if (saved.local_contact_id !== local.id)
      throw AppError.conflict("A concurrent import linked this association to another customer.");
    return {
      remoteName,
      localId: saved.local_contact_id,
      localCode: local.code,
      status: existingContactId ? ("linked" as const) : ("created" as const)
    };
  }

  private linkKey(settings: FrappeSettings, name: string) {
    return `mobile-customer:${this.identity(settings, "pair", name)}`;
  }
  private customerIdentityKey(settings: FrappeSettings, name: string) {
    return this.identity(settings, "customer", name);
  }
  private identity(settings: FrappeSettings, kind: string, name: string) {
    return createHash("sha256")
      .update(
        JSON.stringify([
          new URL(settings.baseUrl).origin.toLowerCase(),
          "Mobile Contact Customer",
          kind,
          name
        ])
      )
      .digest("hex");
  }
  private async settings() {
    const settings = await new FrappeConnectionAccess(
      this.database,
      this.secret,
      this.defaults
    ).credentials();
    if (!settings)
      throw AppError.conflict("Verify the Frappe connection before importing mobile customers.");
    return settings;
  }
}

export async function findEnquiryCustomerIdentity(
  database: Kysely<FrappeDatabase>,
  sourceKey: string,
  remoteName: string
) {
  const identities = await database
    .selectFrom("frappe_contact_customer_identity")
    .select(["source_key", "remote_name", "local_contact_id"])
    .where((expression) =>
      expression.or([
        expression("source_key", "=", sourceKey),
        expression("remote_name", "=", remoteName)
      ])
    )
    .execute();
  if (
    identities.some(
      (identity) => identity.source_key !== sourceKey || identity.remote_name !== remoteName
    )
  )
    throw AppError.conflict("The Frappe Customer identity belongs to another source.");
  return identities[0]?.local_contact_id ?? null;
}

export async function linkEnquiryCustomerIdentity(
  database: Kysely<FrappeDatabase>,
  sourceKey: string,
  remoteName: string,
  localContactId: number
) {
  const identities = await database
    .selectFrom("frappe_contact_customer_identity")
    .select(["source_key", "remote_name", "local_contact_id"])
    .where((expression) =>
      expression.or([
        expression("source_key", "=", sourceKey),
        expression("remote_name", "=", remoteName)
      ])
    )
    .execute();
  const sourceIdentity = identities.find((identity) => identity.source_key === sourceKey);
  const remoteIdentity = identities.find((identity) => identity.remote_name === remoteName);
  if (
    (sourceIdentity &&
      (sourceIdentity.remote_name !== remoteName ||
        sourceIdentity.local_contact_id !== localContactId)) ||
    (remoteIdentity &&
      (remoteIdentity.source_key !== sourceKey ||
        remoteIdentity.local_contact_id !== localContactId))
  )
    throw AppError.conflict(
      "The Frappe Customer identity is already linked to a different Core contact."
    );
  await sql`INSERT INTO frappe_contact_customer_identity
    (source_key, remote_name, local_contact_id)
    VALUES (${sourceKey}, ${remoteName}, ${localContactId})
    ON DUPLICATE KEY UPDATE local_contact_id=VALUES(local_contact_id)`.execute(database);
}
