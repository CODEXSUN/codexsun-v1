export type ProductCollectionPublication = "draft" | "published" | "archived";

export type ProductCollectionRecord = {
  id: number;
  uuid: string;
  slug: string;
  title: string;
  description: string;
  heroImageUrl: string;
  publicationStatus: ProductCollectionPublication;
  sortOrder: number;
  revision: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductCollectionSaveInput = {
  slug: string;
  title: string;
  description?: string;
  heroImageUrl?: string;
  publicationStatus?: ProductCollectionPublication;
  sortOrder?: number;
};

export type ProductCollectionCreateInput = ProductCollectionSaveInput & {
  productInformationIds?: number[] | undefined;
};

export type ProductCollectionUpdateInput = ProductCollectionSaveInput & {
  expectedRevision: number;
  productInformationIds?: number[] | undefined;
};

export type ProductCollectionFilters = {
  search?: string;
  publicationStatus?: ProductCollectionPublication;
  title?: string;
  itemCount?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
};

export type ProductCollectionStatusCounts = {
  all: number;
  archived: number;
  draft: number;
  published: number;
};

export type ProductCollectionPage = {
  items: ProductCollectionRecord[];
  page: number;
  pageSize: number;
  total: number;
  statusCounts: ProductCollectionStatusCounts;
};

export type ProductCollectionItem = {
  productInformationId: number;
  title: string;
  slug: string;
  sortOrder: number;
};

export type ProductCollectionPublicItem = ProductCollectionItem & {
  imageUrl: string | null;
};

export type ProductCollectionPublicRecord = {
  slug: string;
  title: string;
  description: string;
  heroImageUrl: string;
  sortOrder: number;
  items: ProductCollectionPublicItem[];
};

export type CollectionProductOption = { id: number; title: string };
