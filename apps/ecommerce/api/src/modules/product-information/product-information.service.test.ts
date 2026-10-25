import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogActivityInput } from "../catalog-activity/index.js";
import { ProductInformationService } from "./product-information.service.js";

test("product information changes are attributed to the acting staff user", async () => {
  const events: CatalogActivityInput[] = [];
  const repository = {
    coreProductExists: async () => true,
    coreBrandExists: async () => true,
    duplicate: async () => false,
    create: async () => ({ id: 7, storefrontTitle: "Fixture item" }),
    find: async () => ({ id: 7, storefrontTitle: "Fixture item" }),
    archive: async () => ({ id: 7, publicationStatus: "archived" }),
    update: async () => ({ id: 7, storefrontTitle: "Fixture item", revision: 2 })
  };
  const activity = {
    list: async () => [],
    record: async (input: CatalogActivityInput) => {
      events.push(input);
    }
  };
  const service = new ProductInformationService(repository as never, activity as never);
  await service.create(
    { coreProductId: 3, slug: "fixture-item", storefrontTitle: "Fixture item" },
    "staff@example.com"
  );
  await service.archive(7, "staff@example.com");
  assert.deepEqual(
    events.map((event) => [event.resourceType, event.recordId, event.action]),
    [
      ["product-information", 7, "created"],
      ["product-information", 7, "archived"]
    ]
  );
});
