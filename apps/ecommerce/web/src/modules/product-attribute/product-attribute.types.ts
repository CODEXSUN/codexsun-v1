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

export type ProductAttributeFilters = {
  code?: string;
  name?: string;
  dataType?: string;
  values?: string;
  sortOrder?: string;
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

export type ProductAttributePayload = {
  code: string;
  name: string;
  dataType: ProductAttributeDataType;
  unit: string;
  isFilterable: boolean;
  sortOrder: number;
  status: ProductAttributeStatus;
};

export type ProductAttributeAssignment = {
  attributeId: number;
  code: string;
  name: string;
  dataType: ProductAttributeDataType;
  unit: string;
  values: string[];
};

export type AttributeProductOption = { id: number; title: string };
