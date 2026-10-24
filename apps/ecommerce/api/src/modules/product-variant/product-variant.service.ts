import { AppError } from "@codexsun/framework/errors";
import { normalizeVariantOptions } from "./product-variant.identity.js";
import { ProductVariantRepository } from "./product-variant.repository.js";
import type {
  ProductVariantFilters,
  ProductVariantInput,
  ProductVariantSaveInput,
  ProductVariantUpdateInput
} from "./product-variant.types.js";

const MAX_PAGE_SIZE = 100;

export class ProductVariantService {
  constructor(private readonly repository = new ProductVariantRepository()) {}
  list(filters: ProductVariantFilters = {}) {
    return this.repository.list({
      ...filters,
      page: Math.max(1, filters.page ?? 1),
      pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? MAX_PAGE_SIZE))
    });
  }
  find(id: number) {
    return this.repository.find(id);
  }
  productOptions() {
    return this.repository.productOptions();
  }
  async create(input: ProductVariantInput) {
    const value = await this.validate(input);
    try {
      return await this.repository.create(value);
    } catch (error) {
      throw variantWriteConflict(error);
    }
  }
  async update(id: number, input: ProductVariantUpdateInput) {
    const { expectedRevision, ...saveInput } = input;
    if (!(await this.repository.find(id))) throw AppError.notFound("Variant was not found.");
    const value = await this.validate(saveInput, id);
    let updated: Awaited<ReturnType<ProductVariantRepository["update"]>>;
    try {
      updated = await this.repository.update(id, value, expectedRevision);
    } catch (error) {
      throw variantWriteConflict(error);
    }
    if (!updated) {
      throw AppError.conflict("This variant was changed by someone else. Reload it and try again.");
    }
    return updated;
  }
  async setActive(id: number, active: boolean) {
    if (!(await this.repository.find(id))) throw AppError.notFound("Variant was not found.");
    return this.repository.setActive(id, active);
  }
  private async validate(
    input: ProductVariantInput,
    exceptId = 0
  ): Promise<ProductVariantSaveInput> {
    const sku = input.sku.trim().toUpperCase();
    if (!sku) throw AppError.validation("SKU is required.");
    if (!(await this.repository.productExists(input.productInformationId))) {
      throw AppError.validation(
        "The parent product was not found, is archived, or its Core product is inactive."
      );
    }
    if (await this.repository.duplicateSku(sku, exceptId)) {
      throw AppError.conflict("Variant SKU already exists.");
    }
    const options = normalizeVariantOptions(input);
    if (
      await this.repository.duplicateOptions(
        input.productInformationId,
        options.optionSignature,
        exceptId
      )
    ) {
      throw AppError.conflict("This option combination already exists for the product.");
    }
    return {
      ...input,
      ...options,
      sku,
      title: input.title.trim() || sku
    };
  }
}

function variantWriteConflict(error: unknown): AppError {
  if (!isDuplicateKeyError(error)) throw error;
  const message = String((error as { message?: unknown }).message ?? "");
  if (message.includes("ecommerce_product_variants_option_unique")) {
    return AppError.conflict("This option combination already exists for the product.");
  }
  if (message.includes("ecommerce_product_variants_sku_unique")) {
    return AppError.conflict("Variant SKU already exists.");
  }
  return AppError.conflict("A variant with the same SKU or option combination already exists.");
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "ER_DUP_ENTRY" || code === "SQLITE_CONSTRAINT_UNIQUE";
}
