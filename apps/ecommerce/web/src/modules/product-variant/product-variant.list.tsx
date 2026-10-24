import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import type { WorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { Button } from "@codexsun/ui/components/button";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import type { ProductVariantRecord } from "./product-variant.types";
export const productvariantListColumns = {
  sku: "SKU",
  title: "Variant",
  productTitle: "Product",
  options: "Options",
  status: "Status"
};

export function productvariantListValues(record: ProductVariantRecord) {
  return {
    sku: record.sku,
    title: record.title,
    productTitle: record.productTitle,
    options:
      [record.option1Value, record.option2Value, record.option3Value].filter(Boolean).join(" / ") ||
      "Default",
    status: record.status
  };
}

export function ProductVariantList({
  listTools,
  loading,
  onEdit,
  onStatus,
  records
}: {
  listTools?: WorkspaceListTools;
  loading: boolean;
  onEdit: (record: ProductVariantRecord) => void;
  onStatus: (record: ProductVariantRecord) => void;
  records: ProductVariantRecord[];
}) {
  const columns: ColumnDef<ProductVariantRecord>[] = [
    {
      id: "sku",
      header: "SKU",
      accessorFn: (record) => productvariantListValues(record).sku,
      cell: ({ row }) => {
        const record = row.original;
        return <> {record.sku} </>;
      }
    },
    {
      id: "title",
      header: "Variant",
      accessorFn: (record) => productvariantListValues(record).title,
      cell: ({ row }) => {
        const record = row.original;
        return <> {record.title} </>;
      }
    },
    {
      id: "productTitle",
      header: "Product",
      accessorFn: (record) => productvariantListValues(record).productTitle,
      cell: ({ row }) => {
        const record = row.original;
        return <> {record.productTitle} </>;
      }
    },
    {
      id: "options",
      header: "Options",
      accessorFn: (record) => productvariantListValues(record).options,
      cell: ({ row }) => {
        const record = row.original;
        return (
          <>
            {" "}
            {[record.option1Value, record.option2Value, record.option3Value]
              .filter(Boolean)
              .join(" / ") || "Default"}{" "}
          </>
        );
      }
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (record) => productvariantListValues(record).status,
      cell: ({ row }) => {
        const record = row.original;
        return (
          <>
            {" "}
            <WorkspaceStatusBadge
              label={record.status}
              tone={record.status === "active" ? "success" : "neutral"}
            />{" "}
          </>
        );
      }
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => {
        const record = row.original;
        return (
          <>
            {" "}
            <Button size="sm" variant="outline" onClick={() => onEdit(record)}>
              Edit
            </Button>{" "}
            <Button size="sm" variant="outline" onClick={() => onStatus(record)}>
              {record.status === "active" ? "Deactivate" : "Activate"}
            </Button>{" "}
          </>
        );
      }
    }
  ];
  return (
    <WorkspaceTable
      columns={columns.filter((column) => !listTools?.hidden.includes(String(column.id)))}
      data={records}
      isLoading={loading}
      emptyState="No product variant records found."
      minWidth="800px"
      {...(listTools?.showFilters ? { filterRow: listTools.filterRow } : {})}
    />
  );
}
