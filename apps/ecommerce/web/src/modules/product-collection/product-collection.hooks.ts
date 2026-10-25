import { useQuery } from "@tanstack/react-query";
import {
  listCollectionItems,
  listCollectionProducts,
  listProductCollections
} from "./product-collection.services";
import type {
  ProductCollectionFilters,
  ProductCollectionPublication
} from "./product-collection.types";

export const productCollectionQueryKey = ["ecommerce", "catalog", "collections"] as const;

export function useProductCollections(
  search: string,
  publicationStatus?: ProductCollectionPublication,
  page = 1,
  pageSize = 100,
  filters: ProductCollectionFilters = {}
) {
  return useQuery({
    queryFn: () => listProductCollections(search, publicationStatus, page, pageSize, filters),
    queryKey: [...productCollectionQueryKey, search, publicationStatus, page, pageSize, filters]
  });
}

export function useCollectionProducts() {
  return useQuery({
    queryFn: listCollectionProducts,
    queryKey: [...productCollectionQueryKey, "products"]
  });
}

export function useCollectionItems(id: number | null) {
  return useQuery({
    enabled: id !== null,
    queryFn: () => listCollectionItems(id!),
    queryKey: [...productCollectionQueryKey, "items", id]
  });
}
