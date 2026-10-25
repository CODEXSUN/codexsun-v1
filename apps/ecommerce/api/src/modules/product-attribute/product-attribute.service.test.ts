import assert from "node:assert/strict";
import test from "node:test";
import { isAppError } from "@codexsun/framework/errors";
import type { CatalogActivityInput } from "../catalog-activity/index.js";
import { ProductAttributeService } from "./product-attribute.service.js";
import type {
  ProductAttributeDataType,
  ProductAttributeRecord,
  ProductAttributeSaveInput
} from "./product-attribute.types.js";

type Repository = ConstructorParameters<typeof ProductAttributeService>[0];

function record(input: ProductAttributeSaveInput, id = 1): ProductAttributeRecord {
  return {
    ...input,
    createdAt: "2026-10-25T00:00:00.000Z",
    id,
    isFilterable: input.isFilterable ?? true,
    revision: 1,
    sortOrder: input.sortOrder ?? 1000,
    status: input.status ?? "active",
    unit: input.unit ?? "",
    updatedAt: "2026-10-25T00:00:00.000Z",
    uuid: "a0000001",
    valueCount: 0
  };
}

function repository() {
  const created: ProductAttributeSaveInput[] = [];
  return {
    created,
    repository: {
      activeAttributeIds: async (ids: number[]): Promise<Map<number, ProductAttributeDataType>> =>
        new Map(ids.filter((id) => id === 7).map((id) => [id, "text" as const])),
      assignment: async () => [],
      create: async (input: ProductAttributeSaveInput) => {
        created.push(input);
        return record(input, created.length);
      },
      duplicate: async (code: string, exceptId = 0) =>
        created.some((input, index) => input.code === code && index + 1 !== exceptId),
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
      productExists: async () => true,
      productOptions: async () => [],
      remove: async () => true,
      replaceAssignment: async (_id: number, _input: unknown): Promise<never[]> => [],
      setStatus: async (id: number) => {
        const input = created[id - 1];
        return input ? record(input, id) : null;
      },
      statusCounts: async () => ({ active: 0, all: 0, inactive: 0 }),
      update: async (id: number, input: ProductAttributeSaveInput, expectedRevision: number) => {
        const current = created[id - 1];
        if (!current || expectedRevision !== 1) return null;
        created[id - 1] = input;
        return record(input, id);
      }
    }
  };
}

test("attribute codes normalize and duplicate codes conflict", async () => {
  const { created, repository: fake } = repository();
  const service = new ProductAttributeService(fake as Repository);
  await service.create({ code: "  Primary Colour ", dataType: "text", name: "Primary colour" });
  assert.equal(created[0]?.code, "primary-colour");
  await assert.rejects(
    () => service.create({ code: "primary colour", dataType: "text", name: "Duplicate" }),
    (error: unknown) => isAppError(error) && error.statusCode === 409
  );
});

test("stale attribute revisions conflict instead of overwriting", async () => {
  const { repository: fake } = repository();
  const service = new ProductAttributeService(fake as Repository);
  await service.create({ code: "material", dataType: "text", name: "Material" });
  await assert.rejects(
    () =>
      service.update(1, {
        code: "material",
        dataType: "text",
        expectedRevision: 2,
        name: "Changed"
      }),
    (error: unknown) => isAppError(error) && error.statusCode === 409
  );
});

test("assignment rejects duplicate attributes and inactive definitions", async () => {
  const { repository: fake } = repository();
  const service = new ProductAttributeService(fake as Repository);
  await assert.rejects(
    () =>
      service.replaceAssignment(3, {
        values: [
          { attributeId: 7, values: ["Red"] },
          { attributeId: 7, values: ["Blue"] }
        ]
      }),
    (error: unknown) => isAppError(error) && error.statusCode === 400
  );
  await assert.rejects(
    () => service.replaceAssignment(3, { values: [{ attributeId: 8, values: ["Red"] }] }),
    (error: unknown) => isAppError(error) && error.statusCode === 400
  );
});

test("assignment enforces the attribute data type", async () => {
  const { repository: fake } = repository();
  fake.activeAttributeIds = async () => new Map([[7, "number"]]);
  const service = new ProductAttributeService(fake as Repository);
  await assert.rejects(
    () => service.replaceAssignment(3, { values: [{ attributeId: 7, values: ["not-a-number"] }] }),
    (error: unknown) => isAppError(error) && error.statusCode === 400
  );
});

test("assignment trims, removes blanks and de-duplicates within an attribute", async () => {
  const { repository: fake } = repository();
  let saved: unknown;
  fake.replaceAssignment = async (_id: number, input: unknown) => {
    saved = input;
    return [];
  };
  const service = new ProductAttributeService(fake as Repository);
  await service.replaceAssignment(3, {
    values: [{ attributeId: 7, values: [" Red ", "red", "", "Blue"] }]
  });
  assert.deepEqual(saved, { values: [{ attributeId: 7, values: ["Red", "Blue"] }] });
});

test("attribute mutations record the acting staff user", async () => {
  const { repository: fake } = repository();
  const events: CatalogActivityInput[] = [];
  const activity = {
    list: async () => [],
    record: async (input: CatalogActivityInput) => {
      events.push(input);
    }
  };
  const service = new ProductAttributeService(fake as Repository, activity as never);
  await service.create(
    { code: "material", dataType: "text", name: "Material" },
    "staff@example.com"
  );
  assert.equal(events[0]?.resourceType, "attribute");
  assert.equal(events[0]?.recordId, 1);
  assert.equal(events[0]?.actorEmail, "staff@example.com");
  assert.equal(events[0]?.action, "created");
});
