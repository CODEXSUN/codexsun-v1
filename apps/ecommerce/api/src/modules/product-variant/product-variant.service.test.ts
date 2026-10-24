import assert from "node:assert/strict";
import test from "node:test";
import { AppError, isAppError } from "@codexsun/framework/errors";
import { ProductVariantService } from "./product-variant.service.js";
import type {
  ProductVariantInput,
  ProductVariantRecord,
  ProductVariantSaveInput
} from "./product-variant.types.js";

type Repository = ConstructorParameters<typeof ProductVariantService>[0];

function variantRecord(input: ProductVariantSaveInput, id: number): ProductVariantRecord {
  return {
    ...input,
    createdAt: "2026-10-24T00:00:00.000Z",
    id,
    productTitle: "Parent product",
    revision: 1,
    updatedAt: "2026-10-24T00:00:00.000Z",
    uuid: `0000000${id}`
  };
}

function repository(options: { createError?: unknown; updateError?: unknown } = {}) {
  const created: ProductVariantSaveInput[] = [];
  const duplicateChecks: string[] = [];
  let nextId = 1;
  return {
    created,
    duplicateChecks,
    repository: {
      create: async (input: ProductVariantSaveInput) => {
        if (options.createError) throw options.createError;
        created.push(input);
        return variantRecord(input, nextId++);
      },
      duplicateOptions: async (_productId: number, signature: string, exceptId = 0) => {
        duplicateChecks.push(signature);
        return created.some(
          (input, index) => input.optionSignature === signature && index + 1 !== exceptId
        );
      },
      duplicateSku: async (sku: string, exceptId = 0) =>
        created.some((input, index) => input.sku === sku && index + 1 !== exceptId),
      find: async (id: number) => created[id - 1] ?? null,
      list: async () => ({
        items: [],
        page: 1,
        pageSize: 100,
        statusCounts: { all: 0, active: 0, inactive: 0 },
        total: 0
      }),
      productExists: async () => true,
      productOptions: async () => [],
      setActive: async (id: number) => {
        const input = created[id - 1];
        return input ? variantRecord(input, id) : null;
      },
      update: async (id: number, input: ProductVariantSaveInput) => {
        if (options.updateError) throw options.updateError;
        return variantRecord(input, id);
      }
    }
  };
}

function options(
  first: readonly [string, string],
  second?: readonly [string, string],
  third?: readonly [string, string]
): ProductVariantInput {
  const pairs = [first, second, third];
  const names = pairs.map((pair) => pair?.[0] ?? "");
  const values = pairs.map((pair) => pair?.[1] ?? "");
  return {
    barcode: "",
    compareAtAdjustment: 0,
    costAdjustment: 0,
    option1Name: names[0]!,
    option1Value: values[0]!,
    option2Name: names[1]!,
    option2Value: values[1]!,
    option3Name: names[2]!,
    option3Value: values[2]!,
    priceAdjustment: 0,
    productInformationId: 12,
    sku: "SKU",
    sortOrder: 1000,
    status: "active",
    title: "",
    weight: 0
  };
}

test("equivalent option combinations collide regardless of input slot order", async () => {
  const { repository: fake } = repository();
  const service = new ProductVariantService(fake as Repository);

  await service.create({ ...options(["Color", "Red"], ["Size", "M"]), sku: "SKU-RED-M" });
  await assert.rejects(
    () => service.create({ ...options(["Size", "m"], ["color", " red "]), sku: "SKU-M-RED" }),
    (error: unknown) => isAppError(error) && error.statusCode === 409
  );
});

test("different combinations are not collapsed by delimiter-bearing values", async () => {
  const { repository: fake } = repository();
  const service = new ProductVariantService(fake as Repository);

  await service.create({ ...options(["a", "b|c=d"]), sku: "SKU-ONE-OPTION" });
  await service.create({
    ...options(["a", "b"], ["c", "d"]),
    sku: "SKU-TWO-OPTIONS"
  });
});

test("the signature fits the storage budget for every legal maximum payload", async () => {
  const { duplicateChecks, repository: fake } = repository();
  const service = new ProductVariantService(fake as Repository);
  const long = options(
    ["n".repeat(80), "v".repeat(120)],
    [`${"m".repeat(79)}1`, `${"w".repeat(119)}1`],
    [`${"m".repeat(79)}2`, `${"w".repeat(119)}2`]
  );

  await service.create(long);
  const signature = duplicateChecks[0]!;
  assert.equal(signature.length, 64);
});

test("concurrent equivalent creates resolve as a conflict, not an internal error", async () => {
  const duplicate = Object.assign(new Error("Duplicate entry for option combination"), {
    code: "ER_DUP_ENTRY"
  });
  const { repository: fake } = repository({ createError: duplicate });
  const service = new ProductVariantService(fake as Repository);

  await assert.rejects(
    () => service.create({ ...options(["Color", "Red"]), sku: "SKU-CONCURRENT" }),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 409 &&
      /already exists/iu.test(error.message)
  );
});

test("case and surrounding whitespace normalize to the same identity", async () => {
  const { repository: fake } = repository();
  const service = new ProductVariantService(fake as Repository);

  await service.create({ ...options(["Colour", "Ocean Blue"]), sku: "SKU-CASE-ONE" });
  await assert.rejects(
    () => service.create({ ...options(["  COLOUR  ", "  ocean blue  "]), sku: "SKU-CASE-TWO" }),
    (error: unknown) => isAppError(error) && error.statusCode === 409
  );
});

test("case-insensitive duplicate option names are rejected", async () => {
  const { repository: fake } = repository();
  const service = new ProductVariantService(fake as Repository);

  await assert.rejects(
    () => service.create({ ...options(["Color", "Red"], ["color", "Blue"]), sku: "SKU-DUP-NAME" }),
    (error: unknown) => isAppError(error) && error.statusCode === 400
  );
});

test("partial options are rejected", async () => {
  const { repository: fake } = repository();
  const service = new ProductVariantService(fake as Repository);

  await assert.rejects(
    () => service.create({ ...options(["Size", ""]), sku: "SKU-PARTIAL" }),
    (error: unknown) => isAppError(error) && error.statusCode === 400
  );
});

test("the digest is bounded for a maximum Unicode payload", async () => {
  const { duplicateChecks, repository: fake } = repository();
  const service = new ProductVariantService(fake as Repository);
  const unicode = options(
    ["Ş".repeat(80), "色".repeat(120)],
    [`${"名".repeat(79)}1`, `${"値".repeat(119)}1`],
    [`${"名".repeat(79)}2`, `${"値".repeat(119)}2`]
  );

  await service.create(unicode);
  const signature = duplicateChecks[0]!;
  assert.equal(signature.length, 64);
  assert.match(signature, /^[a-f0-9]{64}$/u);
});

test("an update keeps its identity when the same variant keeps its options", async () => {
  const { repository: fake } = repository();
  const service = new ProductVariantService(fake as Repository);

  await service.create({ ...options(["Color", "Red"], ["Size", "M"]), sku: "SKU-KEEP" });
  const updated = await service.update(1, {
    ...options(["size", "m"], ["color", "red"]),
    sku: "SKU-KEEP",
    expectedRevision: 1
  });

  assert.equal(updated?.id, 1);
});

test("concurrent update duplicate keys resolve as a conflict", async () => {
  const duplicate = Object.assign(new Error("Duplicate entry for option combination"), {
    code: "ER_DUP_ENTRY"
  });
  const { repository: fake } = repository({ updateError: duplicate });
  const service = new ProductVariantService(fake as Repository);

  await service.create({ ...options(["Color", "Red"]), sku: "SKU-UPDATE-DUP" });
  await assert.rejects(
    () =>
      service.update(1, {
        ...options(["Color", "Red"]),
        sku: "SKU-UPDATE-DUP",
        expectedRevision: 1
      }),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 409 &&
      /already exists/iu.test(error.message)
  );
});
