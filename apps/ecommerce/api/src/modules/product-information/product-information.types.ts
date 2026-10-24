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
  weight: number;
  length: number;
  width: number;
  height: number;
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

export type ProductInformationSaveInput = {
  coreProductId: number;
  brandId?: number | null;
  storefrontTitle: string;
  subtitle?: string;
  slug: string;
  shortDescription?: string;
  description?: string;
  bulletPoints?: string[];
  material?: string;
  countryOfOrigin?: string;
  manufacturer?: string;
  warranty?: string;
  returnPolicy?: string;
  shippingClass?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  minimumOrderQuantity?: number;
  maximumOrderQuantity?: number | null;
  seoTitle?: string;
  seoDescription?: string;
  publicationStatus?: PublicationStatus;
  isFeatured?: boolean;
};

export type ProductInformationUpdateInput = ProductInformationSaveInput & {
  expectedRevision: number;
};
export type ProductInformationFilters = {
  search?: string;
  status?: PublicationStatus;
  storefrontTitle?: string;
  coreProductName?: string;
  brandName?: string;
  slug?: string;
  page?: number;
  pageSize?: number;
};
export type ProductInformationStatusCounts = {
  all: number;
  draft: number;
  published: number;
  archived: number;
};
export type ProductInformationPage = {
  items: ProductInformationRecord[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: ProductInformationStatusCounts;
};
export type CoreProductOption = { id: number; name: string };
export type CoreBrandOption = { id: number; name: string };
