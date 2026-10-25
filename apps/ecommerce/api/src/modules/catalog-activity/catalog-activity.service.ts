import { CatalogActivityRepository } from "./catalog-activity.repository.js";
import type { CatalogActivityInput, CatalogActivityResource } from "./catalog-activity.types.js";

export class CatalogActivityService {
  constructor(private readonly repository = new CatalogActivityRepository()) {}
  list(resourceType: CatalogActivityResource, recordId: number) {
    return this.repository.list(resourceType, recordId);
  }
  record(input: CatalogActivityInput) {
    return this.repository.record(input);
  }
}
