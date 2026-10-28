import { AppError } from "@codexsun/framework/errors";
import type { Kysely } from "kysely";
import type { EnquiryDatabase } from "./enquiry.types.js";
import { insertEnquiryActivity } from "./enquiry.repository.js";

export type EnquiryNumberLink = { enquiryId: number; remoteName: string };

export function planEnquiryNumbers(
  records: Array<{ id: number; enquiryNo: number }>,
  links: EnquiryNumberLink[],
  nextNumber: number,
  protectedIds: ReadonlySet<number> = new Set()
) {
  const targets = new Map<number, number>();
  const owners = new Map<number, number>();
  const protectedNumbers = new Map(
    records
      .filter((record) => protectedIds.has(record.id))
      .map((record) => [record.enquiryNo, record.id])
  );
  for (const link of links) {
    const match = /^(?:ENQ|Q)([1-9]\d*)$/u.exec(link.remoteName);
    const number = match ? Number(match[1]) : NaN;
    if (!Number.isSafeInteger(number) || number > 2147483647)
      throw AppError.conflict(`Frappe enquiry ${link.remoteName} has an unsupported number.`);
    const protectedOwner = protectedNumbers.get(number);
    if (protectedIds.has(link.enquiryId) || (protectedOwner && protectedOwner !== link.enquiryId))
      continue;
    if (owners.has(number) && owners.get(number) !== link.enquiryId)
      throw AppError.conflict(
        `Frappe names share enquiry number ${number}. Resolve the Q/ENQ collision before renumbering.`
      );
    targets.set(link.enquiryId, number);
    owners.set(number, link.enquiryId);
  }
  let spare = records.reduce((maximum, row) => Math.max(maximum, row.enquiryNo + 1), nextNumber);
  for (const number of owners.keys()) spare = Math.max(spare, number + 1);
  const remoteMaximum = Math.max(0, ...owners.keys());
  const vacated = records
    .filter((row) => targets.has(row.id) && targets.get(row.id) !== row.enquiryNo)
    .map((row) => row.enquiryNo)
    .filter((number) => number > remoteMaximum)
    .sort((left, right) => left - right);
  const changes = records.flatMap((row) => {
    const desired =
      targets.get(row.id) ??
      (owners.has(row.enquiryNo) ? (vacated.shift() ?? spare++) : row.enquiryNo);
    return desired === row.enquiryNo ? [] : [{ id: row.id, before: row.enquiryNo, after: desired }];
  });
  // Temporary numbers permit swaps without breaking the unique serial constraint.
  let temporary = spare;
  const moves = changes.map((change) => ({ ...change, temporary: temporary++ }));
  if (temporary > 2147483647) throw AppError.conflict("Enquiry number range is exhausted.");
  const finalNumbers = new Map(changes.map((change) => [change.id, change.after]));
  const finalMaximum = records.reduce(
    (maximum, row) => Math.max(maximum, finalNumbers.get(row.id) ?? row.enquiryNo),
    0
  );
  return { moves, nextNumber: Math.max(nextNumber, finalMaximum + 1) };
}

export class EnquiryNumbering {
  constructor(private readonly database: Kysely<EnquiryDatabase>) {}

  async reconcile(links: EnquiryNumberLink[], protectedIds: ReadonlySet<number> = new Set()) {
    if (!links.length) return;
    return this.database.transaction().execute(async (transaction) => {
      const sequence = await transaction
        .selectFrom("crm_enquiry_number_sequence")
        .select("next_no")
        .where("id", "=", 1)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const records = await transaction
        .selectFrom("crm_enquiries")
        .select(["id", "enquiry_no as enquiryNo"])
        .orderBy("id")
        .forUpdate()
        .execute();
      const plan = planEnquiryNumbers(records, links, sequence.next_no, protectedIds);
      for (const move of plan.moves)
        await transaction
          .updateTable("crm_enquiries")
          .set({ enquiry_no: move.temporary })
          .where("id", "=", move.id)
          .execute();
      for (const move of plan.moves) {
        await transaction
          .updateTable("crm_enquiries")
          .set({ enquiry_no: move.after })
          .where("id", "=", move.id)
          .execute();
        await insertEnquiryActivity(
          transaction,
          move.id,
          "renumbered",
          `Enquiry number changed from #${move.before} to #${move.after} to match Frappe numbering.`,
          "frappe-sync"
        );
      }
      await transaction
        .updateTable("crm_enquiry_number_sequence")
        .set({ next_no: plan.nextNumber })
        .where("id", "=", 1)
        .execute();
      return plan;
    });
  }
}
