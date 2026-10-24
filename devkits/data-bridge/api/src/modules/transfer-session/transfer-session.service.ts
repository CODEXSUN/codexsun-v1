import { CompanySeedReuse } from "../master-tables/index.js";
import { TransferReferences } from "./transfer-session.references.js";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { AppError } from "@codexsun/framework/errors";
import type { RowDataPacket } from "mysql2/promise";
import { withConnections } from "../import-review/index.js";
import { DatabaseImportLock } from "../database-connection/index.js";
import type { CommonTableImportHost } from "../import-review/index.js";
import { TransferRepository } from "./transfer-session.repository.js";
import { TransferDatabase, identifier } from "./transfer-session.database.js";
import type {
  TransferSession,
  TransferRow,
  TransferField,
  TransferParentMapping
} from "./transfer-session.types.js";
export class TransferService {
  private readonly repository: TransferRepository;
  private readonly locks: DatabaseImportLock;
  constructor(private readonly host: CommonTableImportHost) {
    this.repository = new TransferRepository(host.database);
    this.locks = new DatabaseImportLock(host.database);
  }
  async list() {
    return (await this.repository.list()).filter((session) => !session.context?.businessRunId);
  }
  get(id: string) {
    return this.repository.get(id);
  }
  async create(
    sourceId: number,
    targetTenantId: number,
    actor: string,
    context?: TransferSession["context"]
  ) {
    const [source, target] = await Promise.all([
      this.host.dataMigration.resolveSource(sourceId),
      this.host.resolveTenant(targetTenantId)
    ]);
    if (source.database === target.database && source.port === target.port)
      throw AppError.validation("Source and target must be different databases.");
    await withConnections(source, target, async (db, to) => {
      await db.query("SELECT 1");
      await to.query("SELECT 1");
    });
    return this.repository.create({
      ...(context ? { context } : {}),
      id: randomUUID(),
      revision: 0,
      stage: 2,
      status: "draft",
      sourceId,
      targetTenantId,
      sourceDatabase: source.database,
      targetDatabase: target.database,
      sourceTable: "",
      targetTable: "",
      fields: [],
      schemaHash: "",
      rows: [],
      actor,
      updatedAt: new Date().toISOString(),
      message: "Database connections verified."
    });
  }
  async inspect(id: string) {
    const session = await this.get(id);
    return this.connect(session, async (db) => ({
      tables: await db.tables().then((tables) => ({
        source: tables.source,
        target: session.context
          ? tables.target.filter((name) => session.context!.targetTables.includes(name))
          : tables.target
      })),
      schema: session.sourceTable ? await db.schema(session.sourceTable, session.targetTable) : null
    }));
  }
  async mapTables(
    id: string,
    revision: number,
    sourceTable: string,
    targetTable: string,
    actor: string
  ) {
    return this.change(id, revision, async (session) => {
      if (session.context && !session.context.targetTables.includes(targetTable))
        throw AppError.validation("Choose a destination table from this import group.");
      await this.connect(session, (db) => db.schema(sourceTable, targetTable));
      Object.assign(session, {
        sourceTable,
        targetTable,
        fields: [],
        schemaHash: "",
        rows: [],
        stage: 3,
        status: "draft",
        actor,
        message: "Table pair verified."
      });
    });
  }
  async mapFields(id: string, revision: number, fields: TransferField[], actor: string) {
    return this.change(id, revision, async (session) => {
      if (!session.sourceTable) throw AppError.validation("Verify tables first.");
      const schema = await this.connect(session, (db) =>
        db.verify(session.sourceTable, session.targetTable, fields)
      );
      Object.assign(session, {
        fields,
        schemaHash: schema.hash,
        rows: [],
        stage: 4,
        status: "draft",
        actor,
        message: "Field mapping verified."
      });
    });
  }
  async preview(id: string, page: number) {
    const session = await this.get(id);
    if (session.stage < 4) throw AppError.validation("Verify field mappings first.");
    return this.connect(session, async (db) => {
      const schema = await db.verify(session.sourceTable, session.targetTable, session.fields);
      if (schema.hash !== session.schemaHash)
        throw AppError.validation("Schema changed. Verify fields again.");
      const sourceColumns = [
        ...new Set([
          "id",
          ...session.fields.filter((field) => field.mode === "source").map((field) => field.source!)
        ])
      ];
      if (!sourceColumns.includes("id"))
        throw AppError.validation("Source requires an integer id field for selecting records.");
      const [rows] = await db.source.query<RowDataPacket[]>(
        `SELECT ${sourceColumns.map(identifier).join(",")} FROM ${identifier(session.sourceTable)} ORDER BY id LIMIT 100 OFFSET ${(page - 1) * 100}`
      );
      const [count] = await db.source.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM ${identifier(session.sourceTable)}`
      );
      return { rows: rows.map((row) => ({ ...row })), total: Number(count[0]!.total) };
    });
  }
  async parents(id: string, field: string) {
    const session = await this.get(id);
    return this.connect(session, async (db) => {
      const schema = await db.schema(session.sourceTable, session.targetTable);
      const parent = schema.target.find((c) => c.name === field)?.parent;
      if (!parent || parent === "unsupported")
        throw AppError.validation("This field has no supported parent.");
      const columns = await db.columns(db.target, parent);
      const label = columns.find((c) => ["name", "label", "code", "key"].includes(c.name))?.name;
      const [rows] = await db.target.query<RowDataPacket[]>(
        `SELECT id${label ? `,${identifier(label)} AS label` : ""} FROM ${identifier(parent)} ORDER BY id LIMIT 1000`
      );
      return rows.map((r) => ({ id: Number(r.id), label: String(r.label ?? r.id) }));
    });
  }
  async prepare(
    id: string,
    revision: number,
    ids: number[],
    actor: string,
    options?: { parents?: TransferParentMapping[]; blocked?: Map<number, string> }
  ) {
    return this.change(id, revision, async (session) => {
      if (session.stage < 4) throw AppError.validation("Verify fields before preparing data.");
      await this.connect(session, async (db) => {
        const schema = await db.verify(session.sourceTable, session.targetTable, session.fields);
        if (schema.hash !== session.schemaHash)
          throw AppError.validation("Schema changed. Verify fields again.");
        const columns = [
          ...new Set([
            "id",
            ...session.fields.filter((f) => f.mode === "source").map((f) => f.source!)
          ])
        ];
        const [rows] = await db.source.query<RowDataPacket[]>(
          `SELECT ${columns.map(identifier).join(",")} FROM ${identifier(session.sourceTable)} WHERE id IN (${ids.map(() => "?").join(",")}) ORDER BY id`,
          ids
        );
        if (rows.length !== new Set(ids).size)
          throw AppError.validation("Selected source rows changed. Refresh the preview.");
        session.rows = [];
        const references = new TransferReferences(db, options?.parents);
        for (const source of rows) {
          const data: Record<string, unknown> = {};
          for (const field of session.fields) {
            if (field.mode === "default") continue;
            data[field.target] =
              field.mode === "source"
                ? source[field.source!]
                : field.mode === "uuid"
                  ? randomBytes(4).toString("hex")
                  : field.mode === "now"
                    ? new Date().toISOString().slice(0, 19).replace("T", " ")
                    : field.value;
          }
          const row: TransferRow = {
            sourceId: Number(source.id),
            source: Object.fromEntries(
              session.fields
                .filter((f) => f.mode === "source")
                .map((f) => [f.source!, source[f.source!]])
            ),
            data,
            target: null,
            status: "ready" as "ready" | "warning",
            message: ""
          };
          try {
            row.data = await references.translate(
              data,
              session.fields,
              schema.source,
              schema.target
            );
            await db.audit(session.targetTable, row, session.fields);
            await new CompanySeedReuse(db.source, db.target, this.host.isCompanySeed).prepare(
              session.sourceTable,
              session.targetTable,
              row
            );
            if (row.status === "ready" && options?.blocked?.has(row.sourceId)) {
              row.status = "warning";
              row.message = options.blocked.get(row.sourceId)!;
            }
          } catch (error) {
            row.status = "warning";
            row.message =
              error instanceof AppError
                ? error.message
                : "Parent resolution failed. Check the mapped relationships.";
          }
          session.rows.push(row);
        }
      });
      Object.assign(session, {
        stage: 5,
        status: "prepared",
        actor,
        message:
          "Selected target data prepared and audited. Existing and conflicting rows will be skipped."
      });
    });
  }
  async commit(id: string, revision: number, actor: string, correlationId: string) {
    return this.locks.withImportLock(`transfer:${id}`, async () => {
      const session = await this.get(id);
      this.editable(session, revision);
      if (session.stage !== 5 || session.status !== "prepared" || !session.rows.length)
        throw AppError.validation("Prepare selected rows before confirming import.");
      await this.connect(session, async (db) => {
        const schema = await db.verify(session.sourceTable, session.targetTable, session.fields);
        if (schema.hash !== session.schemaHash)
          throw AppError.validation("Schema changed. Verify fields again.");
      });
      if (!this.host.enqueueTransfer) throw AppError.validation("Import worker is unavailable.");
      session.status = "queued";
      session.actor = actor;
      session.stage = 6;
      session.message = "Import queued.";
      await this.repository.save(session);
      try {
        await this.host.enqueueTransfer({
          runId: id,
          targetTenantId: session.targetTenantId,
          actor,
          correlationId
        });
      } catch (error) {
        session.status = "prepared";
        session.stage = 5;
        session.message = "Queue unavailable. Confirm import again.";
        await this.repository.save(session);
        throw error;
      }
      return session;
    });
  }
  // Execute a saved chunk inside an already authenticated, target-scoped parent queue job.
  async executePrepared(id: string, revision: number, targetTenantId: number, actor: string) {
    await this.locks.withImportLock(`transfer:${id}`, async () => {
      const session = await this.get(id);
      if (session.targetTenantId !== targetTenantId)
        throw AppError.forbidden("Wrong import target context.");
      if (["queued", "completed"].includes(session.status)) return;
      this.editable(session, revision);
      if (session.stage !== 5 || session.status !== "prepared" || !session.rows.length)
        throw AppError.validation("Prepare selected rows before worker execution.");
      const schema = await this.connect(session, (db) =>
        db.verify(session.sourceTable, session.targetTable, session.fields)
      );
      if (schema.hash !== session.schemaHash)
        throw AppError.validation("Schema changed. Prepare this table again.");
      session.status = "queued";
      session.stage = 6;
      session.actor = actor;
      await this.repository.save(session);
    });
    return this.run(id, targetTenantId);
  }
  async run(id: string, targetTenantId: number) {
    return this.locks.withImportLock(`transfer:${id}`, async () => {
      const session = await this.get(id);
      if (session.targetTenantId !== targetTenantId)
        throw AppError.forbidden("Wrong import target context.");
      if (session.status === "completed") return session;
      if (session.status !== "queued") throw AppError.validation("Import is not queued.");
      try {
        await this.connect(session, async (db) => {
          const schema = await db.verify(session.sourceTable, session.targetTable, session.fields);
          if (schema.hash !== session.schemaHash)
            throw AppError.validation("Target schema changed. Import blocked.");
          const lockName = `codexsun.bridge.table:${createHash("sha256").update(`${session.targetDatabase}.${session.targetTable}`).digest("hex").slice(0, 32)}`;
          const [lock] = await db.target.query<RowDataPacket[]>(
            "SELECT GET_LOCK(?,10) AS acquired",
            [lockName]
          );
          if (Number(lock[0]?.acquired) !== 1)
            throw AppError.validation(
              "Another import is processing this target table. Retry after it finishes."
            );
          try {
            await db.target.beginTransaction();
            try {
              for (const row of session.rows) {
                if (row.status === "warning") continue;
                if (row.reuse && row.status === "ready") {
                  await new CompanySeedReuse(db.source, db.target, this.host.isCompanySeed).commit(
                    session.sourceTable,
                    session.targetTable,
                    row
                  );
                  const check = { ...row };
                  await db.audit(session.targetTable, check, session.fields);
                  if (check.status !== "existing")
                    throw AppError.validation("Company reuse verification failed. Rolled back.");
                  row.target = check.target;
                  continue;
                }
                const approved = row.status === "ready";
                await db.audit(session.targetTable, row, session.fields);
                if (!approved) {
                  await new CompanySeedReuse(
                    db.source,
                    db.target,
                    this.host.isCompanySeed
                  ).claimExisting(session.targetTable, row);
                  if (row.status === "ready") {
                    row.status = "warning";
                    row.message =
                      "Destination changed after preparation. This row was not approved for insertion.";
                  }
                  continue;
                }
                if (row.status !== "ready") continue;
                const columns = Object.keys(row.data);
                try {
                  await db.target.execute(
                    `INSERT INTO ${identifier(session.targetTable)} (${columns.map(identifier).join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
                    columns.map((name) => {
                      const value = row.data[name];
                      return value === null ||
                        typeof value === "string" ||
                        typeof value === "number" ||
                        typeof value === "boolean"
                        ? value
                        : JSON.stringify(value);
                    })
                  );
                  row.status = "imported";
                  row.message = "Inserted and committed.";
                  const check = { ...row };
                  await db.audit(session.targetTable, check, session.fields);
                  row.target = check.target;
                } catch (error) {
                  if (
                    error &&
                    typeof error === "object" &&
                    "errno" in error &&
                    error.errno === 1062
                  ) {
                    row.status = "warning";
                    row.message = "Unique key occupied. Existing record preserved.";
                  } else throw error;
                }
              }
              await db.target.commit();
            } catch (error) {
              await db.target.rollback();
              throw error;
            }
          } finally {
            await db.target.query("SELECT RELEASE_LOCK(?)", [lockName]);
          }
        });
        session.status = "completed";
        session.message = "Import complete. Review row results.";
      } catch (error) {
        session.status = "failed";
        session.message =
          error instanceof AppError
            ? error.message
            : "Import failed; the table transaction was rolled back.";
        for (const row of session.rows) {
          if (row.status === "ready" || row.status === "imported") {
            row.status = "warning";
            row.target = null;
            row.message = "Not committed. Import transaction failed.";
          }
        }
      }
      return this.repository.save(session);
    });
  }
  private async change(
    id: string,
    revision: number,
    operation: (value: TransferSession) => Promise<void>
  ) {
    return this.locks.withImportLock(`transfer:${id}`, async () => {
      const session = await this.get(id);
      this.editable(session, revision);
      await operation(session);
      return this.repository.save(session);
    });
  }
  private editable(session: TransferSession, revision: number) {
    if (session.revision !== revision)
      throw AppError.validation("Session changed. Refresh before saving.");
    if (["queued", "completed"].includes(session.status))
      throw AppError.validation(
        "Queued or completed imports cannot be changed. Start a new import."
      );
  }
  private async connect<T>(
    session: TransferSession,
    operation: (db: TransferDatabase) => Promise<T>
  ) {
    const [source, target] = await Promise.all([
      this.host.dataMigration.resolveSource(session.sourceId),
      this.host.resolveTenant(session.targetTenantId)
    ]);
    if (source.database !== session.sourceDatabase || target.database !== session.targetDatabase)
      throw AppError.validation("Connection databases changed. Start a new import.");
    return withConnections(source, target, (from, to) => operation(new TransferDatabase(from, to)));
  }
}
