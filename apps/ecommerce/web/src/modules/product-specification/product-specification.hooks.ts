import { useQuery } from "@tanstack/react-query";
import {
  listProductSpecifications,
  listSpecificationProducts
} from "./product-specification.services";
import type {
  ProductSpecificationFilters,
  ProductSpecificationStatus
} from "./product-specification.types";

export const productSpecificationQueryKey = ["ecommerce", "catalog", "specifications"] as const;

export function useProductSpecifications(
  search: string,
  status?: ProductSpecificationStatus,
  page = 1,
  pageSize = 100,
  filters: ProductSpecificationFilters = {}
) {
  return useQuery({
    queryFn: () => listProductSpecifications(search, status, page, pageSize, filters),
    queryKey: [...productSpecificationQueryKey, search, status, page, pageSize, filters]
  });
}

export function useSpecificationProducts() {
  return useQuery({
    queryFn: listSpecificationProducts,
    queryKey: [...productSpecificationQueryKey, "products"]
  });
}
