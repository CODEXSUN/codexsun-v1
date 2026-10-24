import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import type { WorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { Button } from "@codexsun/ui/components/button";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import type { ProductInformationRecord } from "./product-information.types";
export const productinformationListColumns = {
  storefrontTitle: "Storefront product",
  coreProductName: "Core product",
  brandName: "Brand",
  slug: "Slug",
  publicationStatus: "Status"
};

export function productinformationListValues(record: ProductInformationRecord) {
  return {
    storefrontTitle: record.storefrontTitle,
    coreProductName: record.coreProductName,
    brandName: record.brandName,
    slug: `/${record.slug}`,
    publicationStatus: record.publicationStatus
  };
}

export function ProductInformationList({
  listTools,
  loading,
  onEdit,
  onArchive,
  records
}: {
  listTools?: WorkspaceListTools;
  loading: boolean;
  onEdit: (record: ProductInformationRecord) => void;
  onArchive: (record: ProductInformationRecord) => void;
  records: ProductInformationRecord[];
}) {
  const columns: ColumnDef<ProductInformationRecord>[] = [
    {
      id: "storefrontTitle",
      header: "Storefront product",
      accessorFn: (record) => productinformationListValues(record).storefrontTitle,
      cell: ({ row }) => {
        const record = row.original;
        return <> {record.storefrontTitle} </>;
      }
    },
    {
      id: "coreProductName",
      header: "Core product",
      accessorFn: (record) => productinformationListValues(record).coreProductName,
      cell: ({ row }) => {
        const record = row.original;
        return <> {record.coreProductName} </>;
      }
    },
    {
      id: "brandName",
      header: "Brand",
      accessorFn: (record) => productinformationListValues(record).brandName,
      cell: ({ row }) => {
        const record = row.original;
        return <> {record.brandName || "-"} </>;
      }
    },
    {
      id: "slug",
      header: "Slug",
      accessorFn: (record) => productinformationListValues(record).slug,
      cell: ({ row }) => {
        const record = row.original;
        return <> /{record.slug} </>;
      }
    },
    {
      id: "publicationStatus",
      header: "Status",
      accessorFn: (record) => productinformationListValues(record).publicationStatus,
      cell: ({ row }) => {
        const record = row.original;
        return (
          <>
            {" "}
            <WorkspaceStatusBadge
              label={record.publicationStatus}
              tone={
                record.publicationStatus === "published"
                  ? "success"
                  : record.publicationStatus === "archived"
                    ? "warning"
                    : "neutral"
              }
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
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => onEdit(record)}>
                Edit
              </Button>
              {record.publicationStatus !== "archived" ? (
                <Button size="sm" variant="outline" onClick={() => onArchive(record)}>
                  Archive
                </Button>
              ) : null}
            </div>{" "}
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
      emptyState="No product information records found."
      minWidth="800px"
      {...(listTools?.showFilters ? { filterRow: listTools.filterRow } : {})}
    />
  );
}
