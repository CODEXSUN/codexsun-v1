import { ecommerceFetch } from "../../shared/ecommerce-fetch";
import { RequestError } from "../../shared/request-error";
import type {
  AttributeProductOption,
  ProductAttributeAssignment,
  ProductAttributeFilters,
  ProductAttributePage,
  ProductAttributePayload,
  ProductAttributeRecord,
  ProductAttributeStatus
} from "./product-attribute.types";

type Envelope<T> =
  | { data: T; success: true }
  | { error: { code?: string; details?: unknown; message: string }; success: false };
const base = "/api/platform/ecommerce/catalog/attributes";

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
      ? new RequestError("Attribute request failed.")
      : new RequestError(body.error.message, body.error);
  return body.data;
}

export const listProductAttributes = (
  search = "",
  status?: ProductAttributeStatus,
  page = 1,
  pageSize = 100,
  filters: ProductAttributeFilters = {}
) => {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    search
  });
  if (status) query.set("status", status);
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return request<ProductAttributePage>(`${base}?${query.toString()}`);
};
export const listAttributeProducts = () => request<AttributeProductOption[]>(`${base}/products`);
export const createProductAttribute = (value: ProductAttributePayload) =>
  request<ProductAttributeRecord>(base, { body: JSON.stringify(value), method: "POST" });
export const updateProductAttribute = (
  id: number,
  value: ProductAttributePayload,
  expectedRevision: number
) =>
  request<ProductAttributeRecord>(`${base}/${id}`, {
    body: JSON.stringify({ ...value, expectedRevision }),
    method: "PUT"
  });
export const setProductAttributeStatus = (id: number, status: ProductAttributeStatus) =>
  request<ProductAttributeRecord>(
    `${base}/${id}/${status === "active" ? "activate" : "deactivate"}`,
    {
      body: "{}",
      method: "POST"
    }
  );
export const deleteProductAttribute = (id: number) =>
  request<ProductAttributeRecord>(`${base}/${id}`, { method: "DELETE" });
export const getProductAttributeAssignment = (productInformationId: number) =>
  request<ProductAttributeAssignment[]>(`${base}/assignments/${productInformationId}`);
export const saveProductAttributeAssignment = (
  productInformationId: number,
  values: Array<{ attributeId: number; values: string[] }>
) =>
  request<ProductAttributeAssignment[]>(`${base}/assignments/${productInformationId}`, {
    body: JSON.stringify({ values }),
    method: "PUT"
  });
