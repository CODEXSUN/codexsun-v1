import { AppError } from "@codexsun/framework/errors";
import { CatalogActivityService } from "../catalog-activity/index.js";
import { ProductAttributeRepository } from "./product-attribute.repository.js";
import type {
  ProductAttributeAssignmentSaveInput,
  ProductAttributeDataType,
  ProductAttributeFilters,
  ProductAttributeSaveInput,
  ProductAttributeStatus,
  ProductAttributeUpdateInput
} from "./product-attribute.types.js";

const MAX_VALUES_PER_ATTRIBUTE = 50;

export class ProductAttributeService {
  constructor(
    private readonly repository = new ProductAttributeRepository(),
    private readonly activity = new CatalogActivityService()
  ) {}
  list(filters: ProductAttributeFilters = {}) {
    if (filters.page === undefined && filters.pageSize === undefined) {
      return this.repository.list(filters);
    }
    return this.repository.page(filters);
  }
  find(id: number) {
    return this.repository.find(id);
  }
  productOptions() {
    return this.repository.productOptions();
  }
  async activityFor(id: number) {
    if (!(await this.repository.find(id))) throw AppError.notFound("Attribute was not found.");
    return this.activity.list("attribute", id);
  }
  async create(input: ProductAttributeSaveInput, actorEmail = "") {
    const value = normalize(input);
    if (await this.repository.duplicate(value.code)) {
      throw AppError.conflict("An attribute with this code already exists.");
    }
    const created = await this.repository.create(value);
    await this.audit(created?.id ?? 0, "created", actorEmail, `Created attribute ${value.code}.`);
    return created;
  }
  async update(id: number, input: ProductAttributeUpdateInput, actorEmail = "") {
    if (!(await this.repository.find(id))) throw AppError.notFound("Attribute was not found.");
    const { expectedRevision, ...saveInput } = input;
    const value = normalize(saveInput);
    if (await this.repository.duplicate(value.code, id)) {
      throw AppError.conflict("An attribute with this code already exists.");
    }
    const updated = await this.repository.update(id, value, expectedRevision);
    if (!updated) {
      throw AppError.conflict("This attribute was changed by someone else. Reload and try again.");
    }
    await this.audit(id, "updated", actorEmail, `Updated attribute ${value.code}.`);
    return updated;
  }
  async setStatus(id: number, status: ProductAttributeStatus, actorEmail = "") {
    const current = await this.repository.find(id);
    if (!current) throw AppError.notFound("Attribute was not found.");
    const updated = await this.repository.setStatus(id, status);
    await this.audit(
      id,
      status === "active" ? "activated" : "deactivated",
      actorEmail,
      `${status === "active" ? "Activated" : "Deactivated"} attribute ${current.code}.`
    );
    return updated;
  }
  async remove(id: number, actorEmail = "") {
    const record = await this.repository.find(id);
    if (!record) throw AppError.notFound("Attribute was not found.");
    if (record.valueCount > 0) {
      throw AppError.conflict(
        "Remove this attribute from every product before deleting its definition."
      );
    }
    await this.repository.remove(id);
    await this.audit(id, "deleted", actorEmail, `Deleted attribute ${record.code}.`);
    return record;
  }
  async assignment(productInformationId: number) {
    if (!(await this.repository.productExists(productInformationId)))
      throw AppError.notFound("A live product with this id was not found.");
    return this.repository.assignment(productInformationId);
  }
  async replaceAssignment(
    productInformationId: number,
    input: ProductAttributeAssignmentSaveInput,
    actorEmail = ""
  ) {
    if (!(await this.repository.productExists(productInformationId)))
      throw AppError.notFound("A live product with this id was not found.");
    const uniqueAttributes = new Set<number>();
    const normalized = input.values.map((entry) => {
      if (uniqueAttributes.has(entry.attributeId)) {
        throw AppError.validation("Each attribute may appear only once for a product.");
      }
      uniqueAttributes.add(entry.attributeId);
      const seen = new Set<string>();
      const values: string[] = [];
      for (const rawValue of entry.values) {
        const value = rawValue.trim();
        const identity = value.toLocaleLowerCase();
        if (!value || seen.has(identity)) continue;
        seen.add(identity);
        values.push(value);
      }
      if (values.length > MAX_VALUES_PER_ATTRIBUTE) {
        throw AppError.validation(
          `An attribute may have at most ${MAX_VALUES_PER_ATTRIBUTE} values on one product.`
        );
      }
      if (values.some((value) => Array.from(value).length > 191)) {
        throw AppError.validation("Attribute values must be at most 191 characters.");
      }
      return { attributeId: entry.attributeId, values };
    });
    const active = await this.repository.activeAttributeIds([...uniqueAttributes]);
    if (active.size !== uniqueAttributes.size) {
      throw AppError.validation("Every assigned attribute must exist and be active.");
    }
    for (const entry of normalized) {
      const dataType = active.get(entry.attributeId);
      for (const value of entry.values) validateValue(dataType, value);
    }
    const assignment = await this.repository.replaceAssignment(productInformationId, {
      values: normalized
    });
    for (const entry of normalized) {
      await this.audit(
        entry.attributeId,
        "assignment.updated",
        actorEmail,
        `Updated values for product ${productInformationId}.`
      );
    }
    return assignment;
  }
  private async audit(recordId: number, action: string, actorEmail: string, summary: string) {
    if (!actorEmail || !recordId) return;
    await this.activity.record({
      action,
      actorEmail,
      recordId,
      resourceType: "attribute",
      summary
    });
  }
}

function validateValue(dataType: ProductAttributeDataType | undefined, value: string) {
  if (dataType === "number" && !Number.isFinite(Number(value))) {
    throw AppError.validation(`Attribute value "${value}" must be a number.`);
  }
  if (dataType === "boolean" && !/^(true|false|yes|no|1|0)$/iu.test(value)) {
    throw AppError.validation(`Attribute value "${value}" must be yes or no.`);
  }
  if (dataType === "color" && !/^#[0-9a-f]{6}$/iu.test(value)) {
    throw AppError.validation(`Attribute value "${value}" must be a six-digit hex colour.`);
  }
}

function normalize(input: ProductAttributeSaveInput) {
  const code = input.code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
  const name = input.name.trim();
  if (!code || code.length > 64) throw AppError.validation("A valid attribute code is required.");
  if (!name) throw AppError.validation("Attribute name is required.");
  if (Array.from(name).length > 191)
    throw AppError.validation("Attribute name must be at most 191 characters.");
  if (Array.from(input.unit ?? "").length > 32)
    throw AppError.validation("Attribute unit must be at most 32 characters.");
  return {
    code,
    name,
    dataType: input.dataType,
    unit: input.unit?.trim() ?? "",
    isFilterable: input.isFilterable ?? true,
    sortOrder: Math.max(0, input.sortOrder ?? 1000),
    status: input.status ?? "active"
  };
}
