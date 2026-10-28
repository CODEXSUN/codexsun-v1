import {
  getActiveContactForDatabase,
  resolveOrCreateCustomerForDatabase,
  resolveExternalContactForDatabase
} from "@codexsun/core-api";
import {
  EnquiryContactLookup,
  getActiveListInForDatabase,
  getActiveStatusForDatabase,
  getActivePriorityForDatabase,
  type EnquiryDatabase,
  type ListInDatabase,
  type StatusDatabase,
  type PriorityDatabase
} from "@codexsun/crm-api";

import { tenantAccessContext } from "./auth/tenant-access-context.js";
import { findEnquiryCustomerIdentity, type FrappeDatabase } from "@codexsun/frappe-api";

const enquiryContactLookup = new EnquiryContactLookup();

export const enquiryRelations = (
  context: Pick<ReturnType<typeof tenantAccessContext>, "database" | "tenantDatabase">
) => ({
  contact: (id: number) =>
    enquiryContactLookup.find(context.tenantDatabase, id, () =>
      getActiveContactForDatabase(context.tenantDatabase, id)
    ),
  resolveExternalCustomer: async (input: {
    externalKey: string;
    externalCode: string;
    name: string;
    mobile: string;
  }) => {
    const existingContactId = await findEnquiryCustomerIdentity(
      context.database as unknown as import("kysely").Kysely<FrappeDatabase>,
      input.externalKey,
      input.externalCode
    );
    const resolved = await resolveExternalContactForDatabase(context.tenantDatabase, {
      ...input,
      ...(existingContactId ? { existingContactId } : {})
    });
    const contact = await getActiveContactForDatabase(context.tenantDatabase, resolved.id);
    return { id: resolved.id, name: contact?.name ?? input.name };
  },
  resolveOrCreateCustomer: (
    input: { name: string | null; mobile: string | null },
    transaction?: import("kysely").Transaction<EnquiryDatabase>
  ) =>
    resolveOrCreateCustomerForDatabase(
      context.tenantDatabase,
      input,
      transaction as unknown as Parameters<typeof resolveOrCreateCustomerForDatabase>[2]
    ),
  user: async (id: number) =>
    (await context.database
      .selectFrom("app_users")
      .select("name")
      .where("id", "=", id)
      .where("status", "=", "active")
      .executeTakeFirst()) ?? null,
  listIn: (id: number) =>
    getActiveListInForDatabase(
      context.database as unknown as import("kysely").Kysely<ListInDatabase>,
      id
    ),
  status: (id: number) =>
    getActiveStatusForDatabase(
      context.database as unknown as import("kysely").Kysely<StatusDatabase>,
      id
    ),
  priority: (id: number) =>
    getActivePriorityForDatabase(
      context.database as unknown as import("kysely").Kysely<PriorityDatabase>,
      id
    )
});
