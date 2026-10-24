export type PublicationStatus = "draft" | "published" | "archived";
export type ProductInformationRecord = {
  id: number;
  uuid: string;
  coreProductId: number;
  coreProductName: string;
  brandId: number | null;
  brandName: string | null;
  storefrontTitle: string;
  subtitle: string;
  slug: string;
  shortDescription: string;
  description: string;
  bulletPoints: string[];
  material: string;
  countryOfOrigin: string;
  manufacturer: string;
  warranty: string;
  returnPolicy: string;
  shippingClass: string;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  minimumOrderQuantity: number;
  maximumOrderQuantity: number | null;
  seoTitle: string;
  seoDescription: string;
  publicationStatus: PublicationStatus;
  isFeatured: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type ProductInformationPayload = Omit<
  ProductInformationRecord,
  "id" | "uuid" | "coreProductName" | "brandName" | "revision" | "createdAt" | "updatedAt"
>;
export type ProductInformationFilters = {
  storefrontTitle?: string;
  coreProductName?: string;
  brandName?: string;
  slug?: string;
};
export type ProductInformationStatusCounts = {
  all: number;
  draft: number;
  published: number;
  archived: number;
};
export type ProductInformationPage = {
  items: ProductInformationRecord[];
  page: number;
  pageSize: number;
  statusCounts: ProductInformationStatusCounts;
  total: number;
};
export type CoreProductOption = { id: number; name: string };
export type CoreBrandOption = { id: number; name: string };
export type FrappeItemOption = {
  brand: string;
  description: string;
  image: string;
  itemCode: string;
  itemGroup: string;
  itemName: string;
  standardRate: number | null;
  stockUom: string;
};
