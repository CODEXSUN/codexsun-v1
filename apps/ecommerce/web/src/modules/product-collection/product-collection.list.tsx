import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import type { WorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { Button } from "@codexsun/ui/components/button";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import type { ProductCollectionRecord } from "./product-collection.types";

export const productCollectionListColumns = {
  title: "Collection",
  publicationStatus: "Publication",
  itemCount: "Products",
  sortOrder: "Order"
};

export function productCollectionListValues(record: ProductCollectionRecord) {
  return {
    itemCount: record.itemCount,
    publicationStatus: record.publicationStatus,
    sortOrder: record.sortOrder,
    title: `${record.title} ${record.slug}`
  };
}

export function ProductCollectionList({
  listTools,
  loading,
  onEdit,
  onPublication,
  onView,
  records
}: {
  listTools?: WorkspaceListTools;
  loading: boolean;
  onEdit: (record: ProductCollectionRecord) => void;
  onPublication: (record: ProductCollectionRecord) => void;
  onView: (record: ProductCollectionRecord) => void;
  records: ProductCollectionRecord[];
}) {
  const columns: ColumnDef<ProductCollectionRecord>[] = [
    {
      accessorFn: (record) => productCollectionListValues(record).title,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.title}</div>
          <div className="text-xs text-muted-foreground">{row.original.slug}</div>
        </div>
      ),
      header: "Collection",
      id: "title"
    },
    {
      accessorFn: (record) => productCollectionListValues(record).publicationStatus,
      cell: ({ row }) => (
        <WorkspaceStatusBadge
          label={row.original.publicationStatus}
          tone={row.original.publicationStatus === "published" ? "success" : "neutral"}
        />
      ),
      header: "Publication",
      id: "publicationStatus"
    },
    {
      accessorFn: (record) => productCollectionListValues(record).itemCount,
      cell: ({ row }) => <span>{row.original.itemCount}</span>,
      header: "Products",
      id: "itemCount"
    },
    {
      accessorFn: (record) => productCollectionListValues(record).sortOrder,
      cell: ({ row }) => <span>{row.original.sortOrder}</span>,
      header: "Order",
      id: "sortOrder"
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
          {row.original.publicationStatus !== "archived" ? (
            <Button size="sm" variant="outline" onClick={() => onPublication(row.original)}>
              {row.original.publicationStatus === "published" ? "Unpublish" : "Publish"}
            </Button>
          ) : null}
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
      emptyState="No collections found."
      isLoading={loading}
      minWidth="800px"
      {...(listTools?.showFilters ? { filterRow: listTools.filterRow } : {})}
    />
  );
}
