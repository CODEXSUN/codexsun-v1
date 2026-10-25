import { AppError } from "@codexsun/framework/errors";
import { CatalogActivityService } from "../catalog-activity/index.js";
import { ProductSpecificationRepository } from "./product-specification.repository.js";
import type {
  ProductSpecificationFilters,
  ProductSpecificationSaveInput,
  ProductSpecificationStatus,
  ProductSpecificationUpdateInput
} from "./product-specification.types.js";

export class ProductSpecificationService {
  constructor(
    private readonly repository = new ProductSpecificationRepository(),
    private readonly activity = new CatalogActivityService()
  ) {}
  list(filters: ProductSpecificationFilters = {}) {
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
    if (!(await this.repository.find(id))) throw AppError.notFound("Specification was not found.");
    return this.activity.list("specification", id);
  }
  async create(input: ProductSpecificationSaveInput, actorEmail = "") {
    const value = normalize(input);
    await this.validate(value);
    const created = await this.repository.create(value);
    await this.audit(
      created?.id ?? 0,
      "created",
      actorEmail,
      `Created specification ${value.label}.`
    );
    return created;
  }
  async update(id: number, input: ProductSpecificationUpdateInput, actorEmail = "") {
    const current = await this.repository.find(id);
    if (!current) throw AppError.notFound("Specification was not found.");
    const { expectedRevision, ...saveInput } = input;
    const value = normalize(saveInput);
    await this.validate(value, id);
    const updated = await this.repository.update(id, value, expectedRevision);
    if (!updated) {
      throw AppError.conflict(
        "This specification was changed by someone else. Reload and try again."
      );
    }
    await this.audit(id, "updated", actorEmail, `Updated specification ${value.label}.`);
    return updated;
  }
  async setStatus(id: number, status: ProductSpecificationStatus, actorEmail = "") {
    const current = await this.repository.find(id);
    if (!current) throw AppError.notFound("Specification was not found.");
    const updated = await this.repository.setStatus(id, status);
    await this.audit(
      id,
      status === "active" ? "activated" : "deactivated",
      actorEmail,
      `${status === "active" ? "Activated" : "Deactivated"} specification ${current.label}.`
    );
    return updated;
  }
  async remove(id: number, actorEmail = "") {
    const record = await this.repository.find(id);
    if (!record) throw AppError.notFound("Specification was not found.");
    await this.repository.remove(id);
    await this.audit(id, "deleted", actorEmail, `Deleted specification ${record.label}.`);
    return record;
  }
  private async audit(recordId: number, action: string, actorEmail: string, summary: string) {
    if (!actorEmail || !recordId) return;
    await this.activity.record({
      action,
      actorEmail,
      recordId,
      resourceType: "specification",
      summary
    });
  }
  private async validate(input: ProductSpecificationSaveInput, exceptId = 0) {
    if (!(await this.repository.productExists(input.productInformationId))) {
      throw AppError.validation("A live product with this id was not found.");
    }
    if (await this.repository.duplicate(input.productInformationId, input.label, exceptId)) {
      throw AppError.conflict("This product already has a specification with this label.");
    }
  }
}

function normalize(input: ProductSpecificationSaveInput) {
  const label = input.label.trim();
  const value = input.value.trim();
  if (!label) throw AppError.validation("Specification label is required.");
  if (!value) throw AppError.validation("Specification value is required.");
  if (Array.from(label).length > 120)
    throw AppError.validation("Specification label must be at most 120 characters.");
  if (Array.from(value).length > 500)
    throw AppError.validation("Specification value must be at most 500 characters.");
  return {
    productInformationId: input.productInformationId,
    label,
    value,
    sortOrder: Math.max(0, input.sortOrder ?? 1000),
    status: input.status ?? "active"
  };
}
