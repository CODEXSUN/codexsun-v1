export type ProductVariantStatus = "active" | "inactive";
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
  status: ProductVariantStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type ProductVariantInput = Omit<
  ProductVariantRecord,
  "id" | "uuid" | "productTitle" | "revision" | "createdAt" | "updatedAt"
>;
export type ProductVariantSaveInput = ProductVariantInput & { optionSignature: string };
export type ProductVariantUpdateInput = ProductVariantInput & { expectedRevision: number };
export type ProductVariantFilters = {
  productInformationId?: number;
  search?: string;
  status?: ProductVariantStatus;
  sku?: string;
  title?: string;
  productTitle?: string;
  options?: string;
  page?: number;
  pageSize?: number;
};
export type ProductVariantStatusCounts = {
  all: number;
  active: number;
  inactive: number;
};
export type ProductVariantPage = {
  items: ProductVariantRecord[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: ProductVariantStatusCounts;
};
export type ProductInformationOption = { id: number; title: string };
