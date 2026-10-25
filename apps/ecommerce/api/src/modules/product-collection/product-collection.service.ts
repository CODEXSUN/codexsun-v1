import { AppError } from "@codexsun/framework/errors";
import { CatalogActivityService } from "../catalog-activity/index.js";
import { ProductCollectionRepository } from "./product-collection.repository.js";
import type {
  ProductCollectionCreateInput,
  ProductCollectionFilters,
  ProductCollectionPublication,
  ProductCollectionSaveInput,
  ProductCollectionUpdateInput
} from "./product-collection.types.js";

const MAX_ITEMS = 200;

export class ProductCollectionService {
  constructor(
    private readonly repository = new ProductCollectionRepository(),
    private readonly activity = new CatalogActivityService()
  ) {}
  list(filters: ProductCollectionFilters = {}) {
    if (filters.page === undefined && filters.pageSize === undefined) {
      return this.repository.list(filters);
    }
    return this.repository.page(filters);
  }
  find(id: number) {
    return this.repository.find(id);
  }
  items(id: number) {
    return this.repository.items(id);
  }
  productOptions() {
    return this.repository.productOptions();
  }
  publicList() {
    return this.repository.publicList();
  }
  publicFind(slug: string) {
    return this.repository.publicFind(slug);
  }
  async activityFor(id: number) {
    if (!(await this.repository.find(id))) throw AppError.notFound("Collection was not found.");
    return this.activity.list("collection", id);
  }
  async create(input: ProductCollectionCreateInput, actorEmail = "") {
    const { productInformationIds, ...saveInput } = input;
    const value = normalize(saveInput);
    if (await this.repository.duplicate(value.slug)) {
      throw AppError.conflict("A collection with this slug already exists.");
    }
    const unique = await this.validateProducts(productInformationIds ?? []);
    const created = await this.repository.create(value, unique);
    await this.audit(created?.id ?? 0, "created", actorEmail, `Created collection ${value.slug}.`);
    return created;
  }
  async update(id: number, input: ProductCollectionUpdateInput, actorEmail = "") {
    if (!(await this.repository.find(id))) throw AppError.notFound("Collection was not found.");
    const { expectedRevision, productInformationIds, ...saveInput } = input;
    const value = normalize(saveInput);
    if (await this.repository.duplicate(value.slug, id)) {
      throw AppError.conflict("A collection with this slug already exists.");
    }
    const unique =
      productInformationIds === undefined
        ? undefined
        : await this.validateProducts(productInformationIds);
    const updated = await this.repository.update(id, value, expectedRevision, unique);
    if (!updated) {
      throw AppError.conflict("This collection was changed by someone else. Reload and try again.");
    }
    await this.audit(id, "updated", actorEmail, `Updated collection ${value.slug}.`);
    return updated;
  }
  async setPublication(
    id: number,
    publicationStatus: ProductCollectionPublication,
    actorEmail = ""
  ) {
    if (!(await this.repository.find(id))) throw AppError.notFound("Collection was not found.");
    const updated = await this.repository.setPublication(id, publicationStatus);
    await this.audit(
      id,
      publicationStatus,
      actorEmail,
      `Set collection publication to ${publicationStatus}.`
    );
    return updated;
  }
  async remove(id: number, actorEmail = "") {
    const record = await this.repository.find(id);
    if (!record) throw AppError.notFound("Collection was not found.");
    await this.repository.remove(id);
    await this.audit(id, "deleted", actorEmail, `Deleted collection ${record.slug}.`);
    return record;
  }
  async replaceItems(id: number, productInformationIds: number[], actorEmail = "") {
    if (!(await this.repository.find(id))) throw AppError.notFound("Collection was not found.");
    const unique = await this.validateProducts(productInformationIds);
    const items = await this.repository.replaceItems(id, unique);
    await this.audit(
      id,
      "items.updated",
      actorEmail,
      `Updated collection membership to ${unique.length} products.`
    );
    return items;
  }
  private async validateProducts(productInformationIds: number[]) {
    const unique = [...new Set(productInformationIds)];
    if (unique.length > MAX_ITEMS)
      throw AppError.validation(`A collection may contain at most ${MAX_ITEMS} products.`);
    const valid = await this.repository.validProductIds(unique);
    if (valid.size !== unique.length) {
      throw AppError.validation(
        "Every collection product must exist, be active and not be archived."
      );
    }
    return unique;
  }
  private async audit(recordId: number, action: string, actorEmail: string, summary: string) {
    if (!actorEmail || !recordId) return;
    await this.activity.record({
      action,
      actorEmail,
      recordId,
      resourceType: "collection",
      summary
    });
  }
}

function normalize(input: ProductCollectionSaveInput) {
  const slug = input.slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
  const title = input.title.trim();
  if (!slug) throw AppError.validation("A valid collection slug is required.");
  if (Array.from(slug).length > 191)
    throw AppError.validation("Collection slug must be at most 191 characters.");
  if (!title) throw AppError.validation("Collection title is required.");
  if (Array.from(title).length > 191)
    throw AppError.validation("Collection title must be at most 191 characters.");
  if (Array.from(input.description ?? "").length > 2000)
    throw AppError.validation("Collection description must be at most 2000 characters.");
  if (Array.from(input.heroImageUrl ?? "").length > 1000)
    throw AppError.validation("Collection hero image URL must be at most 1000 characters.");
  return {
    slug,
    title,
    description: input.description?.trim() ?? "",
    heroImageUrl: input.heroImageUrl?.trim() ?? "",
    publicationStatus: input.publicationStatus ?? "draft",
    sortOrder: Math.max(0, input.sortOrder ?? 1000)
  };
}
