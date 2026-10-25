import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import type { WorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { Button } from "@codexsun/ui/components/button";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import type { ProductSpecificationRecord } from "./product-specification.types";

export const productSpecificationListColumns = {
  product: "Product",
  label: "Label",
  value: "Value",
  sortOrder: "Order",
  status: "Status"
};

export function productSpecificationListValues(record: ProductSpecificationRecord) {
  return {
    label: record.label,
    product: record.productTitle,
    sortOrder: record.sortOrder,
    status: record.status,
    value: record.value
  };
}

export function ProductSpecificationList({
  listTools,
  loading,
  onEdit,
  onStatus,
  onView,
  records
}: {
  listTools?: WorkspaceListTools;
  loading: boolean;
  onEdit: (record: ProductSpecificationRecord) => void;
  onStatus: (record: ProductSpecificationRecord) => void;
  onView: (record: ProductSpecificationRecord) => void;
  records: ProductSpecificationRecord[];
}) {
  const columns: ColumnDef<ProductSpecificationRecord>[] = [
    {
      accessorFn: (record) => productSpecificationListValues(record).product,
      cell: ({ row }) => <span>{row.original.productTitle}</span>,
      header: "Product",
      id: "product"
    },
    {
      accessorFn: (record) => productSpecificationListValues(record).label,
      cell: ({ row }) => <span className="font-medium">{row.original.label}</span>,
      header: "Label",
      id: "label"
    },
    {
      accessorFn: (record) => productSpecificationListValues(record).value,
      cell: ({ row }) => <span>{row.original.value}</span>,
      header: "Value",
      id: "value"
    },
    {
      accessorFn: (record) => productSpecificationListValues(record).sortOrder,
      cell: ({ row }) => <span>{row.original.sortOrder}</span>,
      header: "Order",
      id: "sortOrder"
    },
    {
      accessorFn: (record) => productSpecificationListValues(record).status,
      cell: ({ row }) => (
        <WorkspaceStatusBadge
          label={row.original.status}
          tone={row.original.status === "active" ? "success" : "neutral"}
        />
      ),
      header: "Status",
      id: "status"
    },
    {
      cell: ({ row }) => (
        <>
          <Button size="sm" variant="outline" onClick={() => onView(row.original)}>
            View
          </Button>{" "}
          <Button size="sm" variant="outline" onClick={() => onEdit(row.original)}>
            Edit
          </Button>{" "}
          <Button size="sm" variant="outline" onClick={() => onStatus(row.original)}>
            {row.original.status === "active" ? "Deactivate" : "Activate"}
          </Button>
        </>
      ),
      enableSorting: false,
      header: "Actions",
      id: "actions"
    }
  ];
  return (
    <WorkspaceTable
      columns={columns.filter((column) => !listTools?.hidden.includes(String(column.id)))}
      data={records}
      emptyState="No specifications found."
      isLoading={loading}
      minWidth="800px"
      {...(listTools?.showFilters ? { filterRow: listTools.filterRow } : {})}
    />
  );
}
