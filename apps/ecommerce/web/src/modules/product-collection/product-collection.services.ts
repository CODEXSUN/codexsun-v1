import { ecommerceFetch } from "../../shared/ecommerce-fetch";
import { RequestError } from "../../shared/request-error";
import type {
  CollectionProductOption,
  ProductCollectionFilters,
  ProductCollectionItem,
  ProductCollectionPage,
  ProductCollectionPayload,
  ProductCollectionPublication,
  ProductCollectionRecord
} from "./product-collection.types";

type Envelope<T> =
  | { data: T; success: true }
  | { error: { code?: string; details?: unknown; message: string }; success: false };
const base = "/api/platform/ecommerce/catalog/collections";

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
      ? new RequestError("Collection request failed.")
      : new RequestError(body.error.message, body.error);
  return body.data;
}

export const listProductCollections = (
  search = "",
  publicationStatus?: ProductCollectionPublication,
  page = 1,
  pageSize = 100,
  filters: ProductCollectionFilters = {}
) => {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    search
  });
  if (publicationStatus) query.set("publicationStatus", publicationStatus);
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return request<ProductCollectionPage>(`${base}?${query.toString()}`);
};
export const listCollectionProducts = () => request<CollectionProductOption[]>(`${base}/products`);
export const listCollectionItems = (id: number) =>
  request<ProductCollectionItem[]>(`${base}/${id}/items`);
export const createProductCollection = (
  value: ProductCollectionPayload,
  productInformationIds: number[] = []
) =>
  request<ProductCollectionRecord>(base, {
    body: JSON.stringify({ ...value, productInformationIds }),
    method: "POST"
  });
export const updateProductCollection = (
  id: number,
  value: ProductCollectionPayload,
  expectedRevision: number,
  productInformationIds: number[] = []
) =>
  request<ProductCollectionRecord>(`${base}/${id}`, {
    body: JSON.stringify({ ...value, expectedRevision, productInformationIds }),
    method: "PUT"
  });
export const saveCollectionItems = (id: number, productInformationIds: number[]) =>
  request<ProductCollectionItem[]>(`${base}/${id}/items`, {
    body: JSON.stringify({ productInformationIds }),
    method: "PUT"
  });
export const setProductCollectionPublication = (
  id: number,
  publicationStatus: ProductCollectionPublication
) =>
  request<ProductCollectionRecord>(
    `${base}/${id}/${publicationStatus === "published" ? "publish" : publicationStatus === "archived" ? "archive" : "unpublish"}`,
    { body: "{}", method: "POST" }
  );
