export type ProductSpecificationStatus = "active" | "inactive";

export type ProductSpecificationRecord = {
  id: number;
  uuid: string;
  productInformationId: number;
  productTitle: string;
  label: string;
  value: string;
  sortOrder: number;
  status: ProductSpecificationStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductSpecificationFilters = {
  product?: string;
  label?: string;
  value?: string;
  sortOrder?: string;
};

export type ProductSpecificationStatusCounts = {
  all: number;
  active: number;
  inactive: number;
};

export type ProductSpecificationPage = {
  items: ProductSpecificationRecord[];
  page: number;
  pageSize: number;
  total: number;
  statusCounts: ProductSpecificationStatusCounts;
};

export type ProductSpecificationPayload = {
  productInformationId: number;
  label: string;
  value: string;
  sortOrder: number;
  status: ProductSpecificationStatus;
};

export type SpecificationProductOption = { id: number; title: string };
