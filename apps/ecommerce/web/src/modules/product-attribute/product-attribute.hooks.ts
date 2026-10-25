import { useQuery } from "@tanstack/react-query";
import {
  getProductAttributeAssignment,
  listAttributeProducts,
  listProductAttributes
} from "./product-attribute.services";
import type { ProductAttributeFilters, ProductAttributeStatus } from "./product-attribute.types";

export const productAttributeQueryKey = ["ecommerce", "catalog", "attributes"] as const;
export const productAttributeProductsQueryKey = [
  "ecommerce",
  "catalog",
  "attribute-products"
] as const;

export function useProductAttributes(
  search: string,
  status?: ProductAttributeStatus,
  page = 1,
  pageSize = 100,
  filters: ProductAttributeFilters = {}
) {
  return useQuery({
    queryFn: () => listProductAttributes(search, status, page, pageSize, filters),
    queryKey: [...productAttributeQueryKey, search, status, page, pageSize, filters]
  });
}

export function useAttributeProducts() {
  return useQuery({
    queryFn: listAttributeProducts,
    queryKey: productAttributeProductsQueryKey
  });
}

export function useProductAttributeAssignment(productInformationId: number | null) {
  return useQuery({
    enabled: productInformationId !== null,
    queryFn: () => getProductAttributeAssignment(productInformationId!),
    queryKey: [...productAttributeQueryKey, "assignment", productInformationId]
  });
}
