import assert from "node:assert/strict";
import test from "node:test";
import { isAppError } from "@codexsun/framework/errors";
import type { CatalogActivityInput } from "../catalog-activity/index.js";
import { ProductSpecificationService } from "./product-specification.service.js";
import type {
  ProductSpecificationRecord,
  ProductSpecificationSaveInput
} from "./product-specification.types.js";

type Repository = ConstructorParameters<typeof ProductSpecificationService>[0];

function record(input: ProductSpecificationSaveInput, id = 1): ProductSpecificationRecord {
  return {
    ...input,
    createdAt: "2026-10-25T00:00:00.000Z",
    id,
    productTitle: "Product",
    revision: 1,
    sortOrder: input.sortOrder ?? 1000,
    status: input.status ?? "active",
    updatedAt: "2026-10-25T00:00:00.000Z",
    uuid: "50000001"
  };
}

function repository() {
  const created: ProductSpecificationSaveInput[] = [];
  return {
    repository: {
      create: async (input: ProductSpecificationSaveInput) => {
        created.push(input);
        return record(input, created.length);
      },
      duplicate: async (productId: number, label: string, exceptId = 0) =>
        created.some(
          (input, index) =>
            input.productInformationId === productId &&
            input.label.toLowerCase() === label.toLowerCase() &&
            index + 1 !== exceptId
        ),
      find: async (id: number) => {
        const input = created[id - 1];
        return input ? record(input, id) : null;
      },
      list: async () => [],
      page: async () => ({
        items: [],
        page: 1,
        pageSize: 100,
        statusCounts: { active: 0, all: 0, inactive: 0 },
        total: 0
      }),
      productExists: async (id: number) => id === 3,
      productOptions: async () => [],
      remove: async () => true,
      setStatus: async (id: number) => {
        const input = created[id - 1];
        return input ? record(input, id) : null;
      },
      statusCounts: async () => ({ active: 0, all: 0, inactive: 0 }),
      update: async (
        id: number,
        input: ProductSpecificationSaveInput,
        expectedRevision: number
      ) => {
        const current = created[id - 1];
        if (!current || expectedRevision !== 1) return null;
        created[id - 1] = input;
        return record(input, id);
      }
    }
  };
}

test("specifications require a live product and trim their values", async () => {
  const { repository: fake } = repository();
  const service = new ProductSpecificationService(fake as Repository);
  await assert.rejects(
    () => service.create({ label: "Material", productInformationId: 99, value: "Cotton" }),
    (error: unknown) => isAppError(error) && error.statusCode === 400
  );
  assert.equal(
    (
      await service.create({
        label: " Material ",
        productInformationId: 3,
        value: " Cotton "
      })
    )?.value,
    "Cotton"
  );
});

test("duplicate labels conflict per product, not globally", async () => {
  const { repository: fake } = repository();
  const service = new ProductSpecificationService(fake as Repository);
  await service.create({ label: "Material", productInformationId: 3, value: "Cotton" });
  await assert.rejects(
    () => service.create({ label: "material", productInformationId: 3, value: "Linen" }),
    (error: unknown) => isAppError(error) && error.statusCode === 409
  );
});

test("stale specification revisions conflict instead of overwriting", async () => {
  const { repository: fake } = repository();
  const service = new ProductSpecificationService(fake as Repository);
  await service.create({ label: "Material", productInformationId: 3, value: "Cotton" });
  await assert.rejects(
    () =>
      service.update(1, {
        expectedRevision: 2,
        label: "Material",
        productInformationId: 3,
        value: "Linen"
      }),
    (error: unknown) => isAppError(error) && error.statusCode === 409
  );
});

test("specification changes are attributed to the acting staff user", async () => {
  const { repository: fake } = repository();
  const events: CatalogActivityInput[] = [];
  const activity = {
    list: async () => [],
    record: async (input: CatalogActivityInput) => {
      events.push(input);
    }
  };
  const service = new ProductSpecificationService(fake as Repository, activity as never);
  await service.create(
    { label: "Material", productInformationId: 3, value: "Cotton" },
    "staff@example.com"
  );
  assert.equal(events[0]?.resourceType, "specification");
  assert.equal(events[0]?.recordId, 1);
  assert.equal(events[0]?.action, "created");
});
