import { sql, type Transaction } from "kysely";
import {
  getCoreDatabase,
  runWithCoreDatabase,
  runWithCoreTransaction,
  type CoreDatabase
} from "../../../database/core-database.js";
import { ContactService } from "./contact.service.js";
import { ContactRepository } from "./contact.repository.js";

// Policy consumers need every possible identity, including inactive records, without merging them.
export async function contactIdsForEmailPolicy(databaseName: string, recipient: string) {
  const email = recipient.trim().toLowerCase();
  const rows = await sql<{ id: number }>`SELECT c.id FROM core_contacts c
    WHERE LOWER(TRIM(c.primary_email))=${email}
    OR EXISTS(SELECT 1 FROM core_contacts_emails e WHERE e.parent_id=c.id AND LOWER(TRIM(e.email))=${email})`.execute(
    getCoreDatabase(databaseName)
  );
  return rows.rows.map((row) => row.id);
}

export async function getActiveContactForDatabase(databaseName: string, id: number) {
  const result = await sql<{ name: string }>`
    SELECT name FROM core_contacts WHERE id = ${id} AND status = 'active' LIMIT 1
  `.execute(getCoreDatabase(databaseName));
  return result.rows[0] ?? null;
}

export async function lookupActiveContactsForDatabase(databaseName: string, search: string) {
  const term = `%${search.trim().replace(/[\\%_]/g, "\\$&")}%`;
  return (
    await sql<{ id: number; name: string; primaryPhone: string | null }>`
    SELECT id,name,primary_phone AS primaryPhone FROM core_contacts
    WHERE status='active' AND (name LIKE ${term} OR primary_phone LIKE ${term})
    ORDER BY name,id LIMIT 30`.execute(getCoreDatabase(databaseName))
  ).rows;
}

export function resolveOrCreateCustomerForDatabase(
  databaseName: string,
  input: { name: string | null; mobile: string | null },
  transaction?: Transaction<CoreDatabase>
) {
  const resolve = () => new ContactService().resolveOrCreateCustomer(input.name, input.mobile);
  return transaction
    ? runWithCoreTransaction(databaseName, transaction, resolve)
    : runWithCoreDatabase(databaseName, resolve);
}

export async function resolveExternalContactForDatabase(
  databaseName: string,
  input: {
    externalKey: string;
    externalCode: string;
    name: string;
    mobile: string;
    contactType?: "Customer" | "Supplier";
    existingContactId?: number;
  }
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await getCoreDatabase(databaseName)
        .transaction()
        .execute((transaction) =>
          runWithCoreTransaction(databaseName, transaction, () =>
            new ContactService().resolveExternalContact(
              input.externalKey,
              input.externalCode,
              input.name,
              input.mobile,
              input.contactType,
              input.existingContactId
            )
          )
        );
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error ? error.code : null;
      const duplicateContactCode =
        code === "CONFLICT" &&
        error instanceof Error &&
        error.message === "Contact code already exists.";
      if (
        attempt === 2 ||
        (!duplicateContactCode && !["ER_LOCK_DEADLOCK", "ER_DUP_ENTRY"].includes(String(code)))
      )
        throw error;
    }
  }
  throw new Error("External customer resolution failed.");
}

export async function findContactIdentityForDatabase(databaseName: string, code: string) {
  return runWithCoreDatabase(databaseName, () => new ContactRepository().findIdentityByCode(code));
}

export async function findContactIdentityByIdForDatabase(databaseName: string, id: number) {
  return runWithCoreDatabase(databaseName, () => new ContactRepository().findIdentityById(id));
}
