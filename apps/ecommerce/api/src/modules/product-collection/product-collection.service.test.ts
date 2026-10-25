import assert from "node:assert/strict";
import test from "node:test";
import { isAppError } from "@codexsun/framework/errors";
import type { CatalogActivityInput } from "../catalog-activity/index.js";
import { ProductCollectionService } from "./product-collection.service.js";
import type {
  ProductCollectionRecord,
  ProductCollectionSaveInput
} from "./product-collection.types.js";

type Repository = ConstructorParameters<typeof ProductCollectionService>[0];

function record(input: ProductCollectionSaveInput, id = 1, revision = 1): ProductCollectionRecord {
  return {
    ...input,
    createdAt: "2026-10-25T00:00:00.000Z",
    description: input.description ?? "",
    heroImageUrl: input.heroImageUrl ?? "",
    id,
    itemCount: 0,
    publicationStatus: input.publicationStatus ?? "draft",
    revision,
    sortOrder: input.sortOrder ?? 1000,
    updatedAt: "2026-10-25T00:00:00.000Z",
    uuid: "c0000001"
  };
}

function repository() {
  const created: ProductCollectionSaveInput[] = [];
  return {
    created,
    repository: {
      create: async (input: ProductCollectionSaveInput) => {
        created.push(input);
        return record(input, created.length);
      },
      duplicate: async (slug: string, exceptId = 0) =>
        created.some((input, index) => input.slug === slug && index + 1 !== exceptId),
      find: async (id: number) => {
        const input = created[id - 1];
        return input ? record(input, id) : null;
      },
      items: async () => [],
      list: async () => [],
      page: async () => ({
        items: [],
        page: 1,
        pageSize: 100,
        statusCounts: { all: 0, archived: 0, draft: 0, published: 0 },
        total: 0
      }),
      productOptions: async () => [],
      publicFind: async () => null,
      publicList: async () => [],
      remove: async () => true,
      replaceItems: async (_id: number, ids: number[]) =>
        ids.map((id) => ({
          productInformationId: id,
          slug: `product-${id}`,
          sortOrder: 0,
          title: `Product ${id}`
        })),
      setPublication: async (id: number, publicationStatus: "draft" | "published" | "archived") => {
        const input = created[id - 1];
        return input ? record({ ...input, publicationStatus }, id) : null;
      },
      statusCounts: async () => ({ all: 0, archived: 0, draft: 0, published: 0 }),
      update: async (id: number, input: ProductCollectionSaveInput, expectedRevision: number) => {
        const current = created[id - 1];
        if (!current || expectedRevision !== 1) return null;
        created[id - 1] = input;
        return record(input, id, expectedRevision + 1);
      },
      validProductIds: async (ids: number[]) => new Set(ids.filter((id) => id !== 99))
    }
  };
}

test("collection slugs normalize and duplicate slugs conflict", async () => {
  const { created, repository: fake } = repository();
  const service = new ProductCollectionService(fake as Repository);
  await service.create({ slug: " New Arrivals ", title: "New arrivals" });
  assert.equal(created[0]?.slug, "new-arrivals");
  await assert.rejects(
    () => service.create({ slug: "new arrivals", title: "Duplicate" }),
    (error: unknown) => isAppError(error) && error.statusCode === 409
  );
});

test("stale collection revisions conflict instead of overwriting", async () => {
  const { repository: fake } = repository();
  const service = new ProductCollectionService(fake as Repository);
  await service.create({ slug: "featured", title: "Featured" });
  await assert.rejects(
    () => service.update(1, { expectedRevision: 2, slug: "featured", title: "Changed" }),
    (error: unknown) => isAppError(error) && error.statusCode === 409
  );
});

test("collection save rejects invalid membership before writing the record", async () => {
  const { created, repository: fake } = repository();
  const service = new ProductCollectionService(fake as Repository);
  await assert.rejects(
    () =>
      service.create({
        productInformationIds: [1, 99],
        slug: "atomic",
        title: "Atomic"
      }),
    (error: unknown) => isAppError(error) && error.statusCode === 400
  );
  assert.equal(created.length, 0, "A failed atomic create must not persist a collection.");

  await service.create({ productInformationIds: [1], slug: "atomic", title: "Atomic" });
  const before = created[0];
  await assert.rejects(
    () =>
      service.update(1, {
        expectedRevision: 1,
        productInformationIds: [1, 99],
        slug: "atomic",
        title: "Changed"
      }),
    (error: unknown) => isAppError(error) && error.statusCode === 400
  );
  assert.equal(created[0], before, "A failed atomic update must leave the record unchanged.");
});

test("collection membership rejects missing products and removes duplicates", async () => {
  const { repository: fake } = repository();
  const service = new ProductCollectionService(fake as Repository);
  await service.create({ slug: "featured", title: "Featured" });
  await assert.rejects(
    () => service.replaceItems(1, [2, 99]),
    (error: unknown) => isAppError(error) && error.statusCode === 400
  );
  const items = await service.replaceItems(1, [2, 2, 3]);
  assert.deepEqual(
    items.map((item) => item.productInformationId),
    [2, 3]
  );
});

test("collection publication and membership changes are audited", async () => {
  const { repository: fake } = repository();
  const events: CatalogActivityInput[] = [];
  const activity = {
    list: async () => [],
    record: async (input: CatalogActivityInput) => {
      events.push(input);
    }
  };
  const service = new ProductCollectionService(fake as Repository, activity as never);
  await service.create({ slug: "featured", title: "Featured" }, "staff@example.com");
  await service.setPublication(1, "published", "staff@example.com");
  await service.replaceItems(1, [2], "staff@example.com");
  assert.deepEqual(
    events.map((event) => event.action),
    ["created", "published", "items.updated"]
  );
  assert.equal(
    events.every((event) => event.recordId === 1),
    true
  );
});
