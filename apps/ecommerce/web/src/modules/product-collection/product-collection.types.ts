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

export type ProductCollectionFilters = {
  title?: string;
  itemCount?: string;
  sortOrder?: string;
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

export type ProductCollectionPayload = {
  slug: string;
  title: string;
  description: string;
  heroImageUrl: string;
  publicationStatus: ProductCollectionPublication;
  sortOrder: number;
};

export type ProductCollectionItem = {
  productInformationId: number;
  title: string;
  slug: string;
  sortOrder: number;
};

export type CollectionProductOption = { id: number; title: string };
