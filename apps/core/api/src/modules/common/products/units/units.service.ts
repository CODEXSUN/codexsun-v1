import { AppError } from "@codexsun/framework/errors";
import { UnitsRepository } from "./units.repository.js";
import type { UnitsListFilters, UnitsRecord, UnitsSavePayload } from "./units.types.js";

export class UnitsService {
  constructor(private readonly repository = new UnitsRepository()) {}
  list(filters: UnitsListFilters = {}) {
    return this.repository.list(filters);
  }
  get(id: string) {
    return this.repository.find(id);
  }
  create(input: UnitsSavePayload) {
    this.validate(input);
    return this.save(() => this.repository.create(input));
  }
  async update(id: string, input: UnitsSavePayload) {
    await this.mutable(id);
    this.validate(input);
    return this.save(() => this.repository.update(id, input));
  }
  async setActive(id: string, isActive: boolean) {
    await this.mutable(id);
    return this.repository.setActive(id, isActive);
  }
  async forceDelete(id: string) {
    await this.mutable(id);
    return this.repository.forceDelete(id);
  }
  private async mutable(id: string): Promise<UnitsRecord> {
    const record = await this.repository.find(id);
    if (!record) throw AppError.notFound("Units record was not found.");
    if (record.name.trim() === "-")
      throw AppError.conflict("The default hyphen unit is protected.");
    return record;
  }
  private validate(input: UnitsSavePayload) {
    if (!String(input.name ?? "").trim()) throw new Error("Name is required.");
  }
  private async save<T>(work: () => Promise<T>) {
    try {
      return await work();
    } catch (error) {
      if (isDuplicate(error)) throw AppError.conflict("Units record already exists.");
      throw error;
    }
  }
}

function isDuplicate(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ER_DUP_ENTRY"
  );
}
