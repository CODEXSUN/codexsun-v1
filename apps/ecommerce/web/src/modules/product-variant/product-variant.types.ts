export type VariantStatus = "active" | "inactive";
export type CatalogProductOption = { id: number; title: string };
export type ProductVariantRecord = {
  id: number;
  uuid: string;
  productInformationId: number;
  productTitle: string;
  sku: string;
  title: string;
  barcode: string;
  option1Name: string;
  option1Value: string;
  option2Name: string;
  option2Value: string;
  option3Name: string;
  option3Value: string;
  priceAdjustment: number;
  compareAtAdjustment: number;
  costAdjustment: number;
  weight: number;
  sortOrder: number;
  status: VariantStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type ProductVariantPayload = Omit<
  ProductVariantRecord,
  "id" | "uuid" | "productTitle" | "revision" | "createdAt" | "updatedAt"
>;
export type ProductVariantFilters = {
  sku?: string;
  title?: string;
  productTitle?: string;
  options?: string;
};
export type ProductVariantStatusCounts = {
  all: number;
  active: number;
  inactive: number;
};
export type ProductVariantPage = {
  items: ProductVariantRecord[];
  page: number;
  pageSize: number;
  statusCounts: ProductVariantStatusCounts;
  total: number;
};
