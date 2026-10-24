import { useQuery } from "@tanstack/react-query";
import { listProductVariants, listVariantProducts } from "./product-variant.services";
import type { ProductVariantFilters, VariantStatus } from "./product-variant.types";
export const productVariantQueryKey = ["ecommerce", "catalog", "variants"] as const;
export function useProductVariants(
  search: string,
  status?: VariantStatus,
  page = 1,
  pageSize = 100,
  filters: ProductVariantFilters = {}
) {
  return useQuery({
    queryKey: [...productVariantQueryKey, search, status, page, pageSize, filters],
    queryFn: () => listProductVariants(search, status, page, pageSize, filters)
  });
}
export function useVariantProducts() {
  return useQuery({
    queryKey: [...productVariantQueryKey, "products"],
    queryFn: listVariantProducts,
    staleTime: 300_000
  });
}
