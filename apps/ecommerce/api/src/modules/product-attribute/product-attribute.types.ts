export type ProductAttributeDataType = "text" | "number" | "boolean" | "select" | "color";
export type ProductAttributeStatus = "active" | "inactive";

export type ProductAttributeRecord = {
  id: number;
  uuid: string;
  code: string;
  name: string;
  dataType: ProductAttributeDataType;
  unit: string;
  isFilterable: boolean;
  sortOrder: number;
  status: ProductAttributeStatus;
  valueCount: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductAttributeSaveInput = {
  code: string;
  name: string;
  dataType: ProductAttributeDataType;
  unit?: string;
  isFilterable?: boolean;
  sortOrder?: number;
  status?: ProductAttributeStatus;
};

export type ProductAttributeUpdateInput = ProductAttributeSaveInput & {
  expectedRevision: number;
};

export type ProductAttributeFilters = {
  search?: string;
  status?: ProductAttributeStatus;
  code?: string;
  name?: string;
  dataType?: string;
  values?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
};

export type ProductAttributeStatusCounts = {
  all: number;
  active: number;
  inactive: number;
};

export type ProductAttributePage = {
  items: ProductAttributeRecord[];
  page: number;
  pageSize: number;
  total: number;
  statusCounts: ProductAttributeStatusCounts;
};

export type ProductAttributeAssignment = {
  attributeId: number;
  code: string;
  name: string;
  dataType: ProductAttributeDataType;
  unit: string;
  values: string[];
};

export type ProductAttributeAssignmentSaveInput = {
  values: Array<{ attributeId: number; values: string[] }>;
};
