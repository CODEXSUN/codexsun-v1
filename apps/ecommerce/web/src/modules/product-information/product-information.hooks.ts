import { useQuery } from "@tanstack/react-query";
import {
  listCoreBrandOptions,
  listCoreProductOptions,
  listFrappeItems,
  listProductInformation
} from "./product-information.services";
import type { ProductInformationFilters, PublicationStatus } from "./product-information.types";
export const productInformationQueryKey = ["ecommerce", "catalog", "product-information"] as const;
export const coreProductOptionsQueryKey = ["ecommerce", "catalog", "core-product-options"] as const;
export const coreBrandOptionsQueryKey = ["ecommerce", "catalog", "core-brand-options"] as const;
export const frappeItemOptionsQueryKey = ["ecommerce", "catalog", "frappe-item-options"] as const;
export function useProductInformation(
  search: string,
  status?: PublicationStatus,
  page = 1,
  pageSize = 100,
  filters: ProductInformationFilters = {}
) {
  return useQuery({
    queryKey: [...productInformationQueryKey, search, status, page, pageSize, filters],
    queryFn: () => listProductInformation(search, status, page, pageSize, filters)
  });
}
export function useCoreProductOptions() {
  return useQuery({
    queryKey: coreProductOptionsQueryKey,
    queryFn: listCoreProductOptions,
    staleTime: 300_000
  });
}
export function useCoreBrandOptions() {
  return useQuery({
    queryKey: coreBrandOptionsQueryKey,
    queryFn: listCoreBrandOptions,
    staleTime: 300_000
  });
}
export function useFrappeItemOptions(search: string) {
  return useQuery({
    queryKey: [...frappeItemOptionsQueryKey, search],
    queryFn: () => listFrappeItems(search),
    staleTime: 60_000
  });
}
