import { randomBytes } from "node:crypto";
import { sql, type Kysely } from "kysely";
import { AppError } from "@codexsun/framework/errors";
import type { MarketingContext, MarketingDatabase } from "../../context.js";
import type { SubmissionDependencies, SubmissionInput } from "./submission.types.js";
import { SubmissionService } from "./submission.service.js";

export async function migrateSubmissionImport(database: Kysely<MarketingDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS marketing_submission_imports(
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, uuid CHAR(8) NOT NULL UNIQUE,
    company_id INT NOT NULL, actor_email VARCHAR(191) NOT NULL, filename VARCHAR(191) NOT NULL,
    mapping_json TEXT NOT NULL, rows_json MEDIUMTEXT NOT NULL, total INT NOT NULL,
    completed INT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX import_owner(company_id, actor_email, id)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS marketing_submission_import_receipts(
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, import_uuid CHAR(8) NOT NULL,
    row_index INT NOT NULL, submission_uuid CHAR(8) NOT NULL,
    UNIQUE KEY import_row(import_uuid, row_index)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
}

type ImportRecord = {
  uuid: string;
  filename: string;
  mappingJson: string;
  rowsJson: string;
  total: number;
  completed: number;
};
export async function purgeExpiredSubmissionImports(database: Kysely<MarketingDatabase>) {
  await database.transaction().execute(async (transaction) => {
    await sql`DELETE r FROM marketing_submission_import_receipts r INNER JOIN marketing_submission_imports i ON i.uuid=r.import_uuid WHERE i.created_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 7 DAY)`.execute(transaction);
    await sql`DELETE FROM marketing_submission_imports WHERE created_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 7 DAY)`.execute(transaction);
  });
}

export class SubmissionImportSession {
  constructor(
    private readonly context: MarketingContext,
    private readonly deps: SubmissionDependencies
  ) {}

  async create(filename: string, mapping: Record<string, string>, rows: SubmissionInput[]) {
    await this.context.authorize("marketing.submission.record.create");
    const keys = rows.map((row) => `${row.captureUuid}:${row.sourceKey}`);
    if (new Set(keys).size !== keys.length)
      throw AppError.validation("Duplicate capture and source keys in the import.");
    for (const row of rows) {
      if (!row.email && !row.phone)
        throw AppError.validation("Every row requires an email address or phone number.");
      const capture = await this.deps.capture(this.context, row.captureUuid);
      if (!this.context.allowedBrands.includes(capture.brandUuid))
        throw AppError.notFound("Capture form was not found.");
    }
    const uuid = randomBytes(4).toString("hex");
    await sql`INSERT INTO marketing_submission_imports(uuid,company_id,actor_email,filename,mapping_json,rows_json,total)
      VALUES(${uuid},${this.context.companyId},${this.context.actorEmail},${filename},${JSON.stringify(mapping)},${JSON.stringify(rows)},${rows.length})`.execute(
      this.context.database
    );
    return this.get(uuid);
  }

  async list() {
    await this.context.authorize("marketing.submission.record.create");
    const records = (
      await sql<ImportRecord>`SELECT uuid,filename,mapping_json AS mappingJson,rows_json AS rowsJson,total,completed
      FROM marketing_submission_imports WHERE company_id=${this.context.companyId} AND actor_email=${this.context.actorEmail}
      AND completed < total AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 7 DAY) ORDER BY id DESC LIMIT 20`.execute(this.context.database)
    ).rows;
    const visible = [];
    for (const row of records) {
      await this.checkCaptures(row);
      visible.push(this.summary(row));
    }
    return visible;
  }

  async get(uuid: string) {
    await this.context.authorize("marketing.submission.record.create");
    const record = await this.record(uuid);
    await this.checkCaptures(record);
    return this.summary(record);
  }

  async advance(uuid: string) {
    await this.context.authorize("marketing.submission.record.create");
    const pending: string[] = [];
    const result = await this.context.database.transaction().execute(async (database) => {
      const context = { ...this.context, database };
      const locked = new SubmissionImportSession(context, this.deps);
      const session = await locked.record(uuid, true);
      await locked.checkCaptures(session);
      if (session.completed >= session.total) return locked.summary(session);
      const rows = JSON.parse(session.rowsJson) as SubmissionInput[];
      const row = rows[session.completed];
      if (!row) throw AppError.conflict("The import session is incomplete.");
      const saved = await new SubmissionService(context, {
        ...this.deps,
        enqueue: async (_ctx, submissionUuid) => { pending.push(submissionUuid); }
      }).accept(row);
      await sql`INSERT INTO marketing_submission_import_receipts(import_uuid,row_index,submission_uuid)
        VALUES(${uuid},${session.completed},${saved.uuid}) ON DUPLICATE KEY UPDATE submission_uuid=submission_uuid`.execute(database);
      await sql`UPDATE marketing_submission_imports SET rows_json=IF(completed+1>=total,'[]',rows_json),mapping_json=IF(completed+1>=total,'{}',mapping_json),completed=completed+1 WHERE uuid=${uuid}`.execute(database);
      return locked.summary({ ...session, completed: session.completed + 1 });
    });
    for (const submissionUuid of pending) {
      try { await this.deps.enqueue(this.context, submissionUuid); } catch { /* The relay retries pending submissions. */ }
    }
    return result;
  }

  async cancel(uuid: string) {
    await this.context.authorize("marketing.submission.record.create");
    await this.context.database.transaction().execute(async (database) => {
      const locked = new SubmissionImportSession({ ...this.context, database }, this.deps);
      await locked.record(uuid, true);
      await sql`DELETE FROM marketing_submission_import_receipts WHERE import_uuid=${uuid}`.execute(database);
      await sql`DELETE FROM marketing_submission_imports WHERE uuid=${uuid} AND company_id=${this.context.companyId} AND actor_email=${this.context.actorEmail}`.execute(database);
    });
    return { cancelled: true };
  }

  private async record(uuid: string, lock = false) {
    const row = (
      await sql<ImportRecord>`SELECT uuid,filename,mapping_json AS mappingJson,rows_json AS rowsJson,total,completed
      FROM marketing_submission_imports WHERE uuid=${uuid} AND company_id=${this.context.companyId}
      AND actor_email=${this.context.actorEmail} AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 7 DAY) ${lock ? sql`FOR UPDATE` : sql``}`.execute(this.context.database)
    ).rows[0];
    if (!row) throw AppError.notFound("Import session was not found.");
    return row;
  }

  private summary(row: ImportRecord) {
    return { uuid: row.uuid, filename: row.filename, total: row.total, completed: row.completed };
  }

  private async checkCaptures(record: ImportRecord) {
    const rows = JSON.parse(record.rowsJson) as SubmissionInput[];
    for (const uuid of new Set(rows.map((row) => row.captureUuid))) {
      const capture = await this.deps.capture(this.context, uuid);
      if (!this.context.allowedBrands.includes(capture.brandUuid))
        throw AppError.notFound("Import session was not found.");
    }
  }
}
