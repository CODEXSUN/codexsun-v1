export type CatalogActivityResource =
  "attribute" | "collection" | "product-information" | "specification";

export type CatalogActivityRecord = {
  id: number;
  uuid: string;
  resourceType: CatalogActivityResource;
  recordId: number;
  action: string;
  actorEmail: string;
  summary: string;
  createdAt: string;
};

export type CatalogActivityInput = {
  resourceType: CatalogActivityResource;
  recordId: number;
  action: string;
  actorEmail: string;
  summary: string;
};
