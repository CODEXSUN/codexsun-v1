import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import type { WorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { Button } from "@codexsun/ui/components/button";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import type { ProductAttributeRecord } from "./product-attribute.types";

export const productAttributeListColumns = {
  code: "Code",
  name: "Name",
  dataType: "Type",
  values: "Values",
  sortOrder: "Order",
  status: "Status"
};

export function productAttributeListValues(record: ProductAttributeRecord) {
  return {
    code: record.code,
    dataType: record.dataType,
    name: record.name,
    sortOrder: record.sortOrder,
    status: record.status,
    values: record.valueCount
  };
}

export function ProductAttributeList({
  listTools,
  loading,
  onEdit,
  onStatus,
  onView,
  records
}: {
  listTools?: WorkspaceListTools;
  loading: boolean;
  onEdit: (record: ProductAttributeRecord) => void;
  onStatus: (record: ProductAttributeRecord) => void;
  onView: (record: ProductAttributeRecord) => void;
  records: ProductAttributeRecord[];
}) {
  const columns: ColumnDef<ProductAttributeRecord>[] = [
    {
      accessorFn: (record) => productAttributeListValues(record).name,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          <div className="text-xs text-muted-foreground">{row.original.code}</div>
        </div>
      ),
      header: "Name",
      id: "name"
    },
    {
      accessorFn: (record) => productAttributeListValues(record).dataType,
      cell: ({ row }) => (
        <span>
          {row.original.dataType}
          {row.original.unit ? ` (${row.original.unit})` : ""}
        </span>
      ),
      header: "Type",
      id: "dataType"
    },
    {
      accessorFn: (record) => productAttributeListValues(record).values,
      cell: ({ row }) => <span>{row.original.valueCount}</span>,
      header: "Values",
      id: "values"
    },
    {
      accessorFn: (record) => productAttributeListValues(record).sortOrder,
      cell: ({ row }) => <span>{row.original.sortOrder}</span>,
      header: "Order",
      id: "sortOrder"
    },
    {
      accessorFn: (record) => productAttributeListValues(record).status,
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
      emptyState="No attributes found."
      isLoading={loading}
      minWidth="800px"
      {...(listTools?.showFilters ? { filterRow: listTools.filterRow } : {})}
    />
  );
}
