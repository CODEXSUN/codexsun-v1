import { useQuery } from "@tanstack/react-query";
import { ecommerceFetch } from "./ecommerce-fetch";

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

type Envelope<T> = { data: T; success: true } | { error: { message: string }; success: false };

const paths: Record<CatalogActivityResource, string> = {
  attribute: "/api/platform/ecommerce/catalog/attributes",
  collection: "/api/platform/ecommerce/catalog/collections",
  "product-information": "/api/platform/ecommerce/catalog/product-information",
  specification: "/api/platform/ecommerce/catalog/specifications"
};

export async function listCatalogActivity(resourceType: CatalogActivityResource, recordId: number) {
  const response = await ecommerceFetch(`${paths[resourceType]}/${recordId}/activity`, {
    headers: { Accept: "application/json" }
  });
  const body = (await response.json()) as Envelope<CatalogActivityRecord[]>;
  if (!response.ok || !body.success)
    throw new Error(body.success ? "Activity request failed." : body.error.message);
  return body.data;
}

export function useCatalogActivity(resourceType: CatalogActivityResource, recordId: number) {
  return useQuery({
    enabled: recordId > 0,
    queryFn: () => listCatalogActivity(resourceType, recordId),
    queryKey: ["ecommerce", "catalog", "activity", resourceType, recordId]
  });
}
