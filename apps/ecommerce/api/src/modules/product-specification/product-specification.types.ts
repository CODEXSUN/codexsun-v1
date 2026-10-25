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

export type ProductSpecificationSaveInput = {
  productInformationId: number;
  label: string;
  value: string;
  sortOrder?: number;
  status?: ProductSpecificationStatus;
};

export type ProductSpecificationUpdateInput = ProductSpecificationSaveInput & {
  expectedRevision: number;
};

export type ProductSpecificationFilters = {
  productInformationId?: number;
  search?: string;
  status?: ProductSpecificationStatus;
  product?: string;
  label?: string;
  value?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
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

export type SpecificationProductOption = { id: number; title: string };
