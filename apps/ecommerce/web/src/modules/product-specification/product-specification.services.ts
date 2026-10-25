import { ecommerceFetch } from "../../shared/ecommerce-fetch";
import { RequestError } from "../../shared/request-error";
import type {
  ProductSpecificationFilters,
  ProductSpecificationPage,
  ProductSpecificationPayload,
  ProductSpecificationRecord,
  ProductSpecificationStatus,
  SpecificationProductOption
} from "./product-specification.types";

type Envelope<T> =
  | { data: T; success: true }
  | { error: { code?: string; details?: unknown; message: string }; success: false };
const base = "/api/platform/ecommerce/catalog/specifications";

async function request<T>(url: string, options: RequestInit = {}) {
  const response = await ecommerceFetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const body = (await response.json()) as Envelope<T>;
  if (!response.ok || !body.success)
    throw body.success
      ? new RequestError("Specification request failed.")
      : new RequestError(body.error.message, body.error);
  return body.data;
}

export const listProductSpecifications = (
  search = "",
  status?: ProductSpecificationStatus,
  page = 1,
  pageSize = 100,
  filters: ProductSpecificationFilters = {}
) => {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    search
  });
  if (status) query.set("status", status);
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return request<ProductSpecificationPage>(`${base}?${query.toString()}`);
};
export const listSpecificationProducts = () =>
  request<SpecificationProductOption[]>(`${base}/products`);
export const createProductSpecification = (value: ProductSpecificationPayload) =>
  request<ProductSpecificationRecord>(base, { body: JSON.stringify(value), method: "POST" });
export const updateProductSpecification = (
  id: number,
  value: ProductSpecificationPayload,
  expectedRevision: number
) =>
  request<ProductSpecificationRecord>(`${base}/${id}`, {
    body: JSON.stringify({ ...value, expectedRevision }),
    method: "PUT"
  });
export const setProductSpecificationStatus = (id: number, status: ProductSpecificationStatus) =>
  request<ProductSpecificationRecord>(
    `${base}/${id}/${status === "active" ? "activate" : "deactivate"}`,
    { body: "{}", method: "POST" }
  );
export const deleteProductSpecification = (id: number) =>
  request<ProductSpecificationRecord>(`${base}/${id}`, { method: "DELETE" });
