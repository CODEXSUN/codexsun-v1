import { ecommerceFetch } from "../../shared/ecommerce-fetch";
import type {
  CatalogProductOption,
  ProductVariantFilters,
  ProductVariantPage,
  ProductVariantPayload,
  ProductVariantRecord,
  VariantStatus
} from "./product-variant.types";
type Envelope<T> = { data: T; success: true } | { error: { message: string }; success: false };
const base = "/api/platform/ecommerce/catalog/variants";
async function request<T>(url: string, options: RequestInit = {}) {
  const response = await ecommerceFetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const body = (await response.json()) as Envelope<T>;
  if (!response.ok || !body.success)
    throw new Error(body.success ? "Variant request failed." : body.error.message);
  return body.data;
}
export const listProductVariants = (
  search = "",
  status?: VariantStatus,
  page = 1,
  pageSize = 100,
  filters: ProductVariantFilters = {}
) => {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    search
  });
  if (status) query.set("status", status);
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return request<ProductVariantPage>(`${base}?${query.toString()}`);
};
export const listVariantProducts = () => request<CatalogProductOption[]>(`${base}/products`);
export const createProductVariant = (payload: ProductVariantPayload) =>
  request<ProductVariantRecord>(base, { body: JSON.stringify(payload), method: "POST" });
export const updateProductVariant = (
  id: number,
  payload: ProductVariantPayload,
  expectedRevision: number
) =>
  request<ProductVariantRecord>(`${base}/${id}`, {
    body: JSON.stringify({ ...payload, expectedRevision }),
    method: "PUT"
  });
export const changeProductVariantStatus = (id: number, status: VariantStatus) =>
  request<ProductVariantRecord>(
    `${base}/${id}/${status === "active" ? "activate" : "deactivate"}`,
    { body: "{}", method: "POST" }
  );
