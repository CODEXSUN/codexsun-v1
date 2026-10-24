import { useEffect } from "react";
import { useWorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import {
  useWorkspaceQueryValue,
  useWorkspaceRecordSelection
} from "@codexsun/ui/workspace/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { WorkspacePagination, buildShowingLabel } from "@codexsun/ui/workspace";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { ProductVariantForm } from "./product-variant.form";
import {
  productVariantQueryKey,
  useProductVariants,
  useVariantProducts
} from "./product-variant.hooks";
import { ProductVariantList, productvariantListColumns } from "./product-variant.list";
import {
  changeProductVariantStatus,
  createProductVariant,
  updateProductVariant
} from "./product-variant.services";
import type {
  ProductVariantPayload,
  ProductVariantRecord,
  VariantStatus
} from "./product-variant.types";
export function ProductVariantWorkspace() {
  const listTools = useWorkspaceListTools(productvariantListColumns);
  const [statusFilter, setStatusFilter] = useWorkspaceQueryValue("status", "all");
  const client = useQueryClient();
  const [search, setSearch] = useWorkspaceQueryValue("q", "");
  const [pageValue, setPageValue] = useWorkspaceQueryValue("page", "1");
  const [pageSizeValue, setPageSizeValue] = useWorkspaceQueryValue("pageSize", "100");
  const page = Math.max(1, Number(pageValue) || 1);
  const requestedPageSize = Number(pageSizeValue);
  const pageSize = [20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 100;
  const filters = {
    options: listTools.filters.options ?? "",
    productTitle: listTools.filters.productTitle ?? "",
    sku: listTools.filters.sku ?? "",
    title: listTools.filters.title ?? ""
  };

  const query = useProductVariants(
    search,
    statusFilter === "all" ? undefined : (statusFilter as VariantStatus),
    page,
    pageSize,
    filters
  );
  const total = query.data?.total ?? 0;
  const currentPage = query.data?.page ?? page;
  const currentPageSize = query.data?.pageSize ?? pageSize;
  const pageCount = Math.max(1, Math.ceil(total / currentPageSize));
  const statusCounts = query.data?.statusCounts;
  const records = query.data?.items ?? [];
  const [editing, setEditing] = useWorkspaceRecordSelection<ProductVariantRecord>(
    query.data?.items ?? [],
    (record) => String(record.id)
  );

  useEffect(() => {
    if (query.data?.page !== undefined && query.data.page !== page) {
      setPageValue(String(query.data.page));
    }
    if (query.data?.pageSize !== undefined && query.data.pageSize !== pageSize) {
      setPageSizeValue(String(query.data.pageSize));
    }
  }, [page, pageSize, query.data?.page, query.data?.pageSize, setPageSizeValue, setPageValue]);
  const products = useVariantProducts();
  const refresh = () => client.invalidateQueries({ queryKey: productVariantQueryKey });
  const save = useMutation({
    mutationFn: (value: ProductVariantPayload) =>
      editing
        ? updateProductVariant(editing.id, value, editing.revision)
        : createProductVariant(value),
    onSuccess: async () => {
      await refresh();
      setEditing(undefined);
      toast.success("Variant saved");
    },
    onError: (error) => toast.error(error.message)
  });
  const statusMutation = useMutation({
    mutationFn: (record: ProductVariantRecord) =>
      changeProductVariantStatus(record.id, record.status === "active" ? "inactive" : "active"),
    onSuccess: refresh
  });
  if (editing !== undefined)
    return (
      <ProductVariantForm
        loading={save.isPending}
        products={products.data ?? []}
        record={editing}
        onCancel={() => setEditing(undefined)}
        onSubmit={(value) => save.mutate(value)}
      />
    );
  return (
    <WorkspacePage
      variant="list"
      title="Product Variants"
      description="Manage purchasable SKUs, option combinations, adjustments, and weights."
      actions={
        <div className="flex gap-2">
          <Button onClick={() => setEditing(null)}>
            <Plus className="size-4" />
            New
          </Button>
        </div>
      }
    >
      <div className="flex gap-3">
        <div className="flex-1">
          <WorkspaceFilters
            toolbarAction={listTools.toolbarAction}
            columnOptions={listTools.columnOptions}
            onShowAllColumns={listTools.onShowAllColumns}
            filterValue={statusFilter}
            onFilterValueChange={(value) => {
              setStatusFilter(value);
              setPageValue("1");
            }}
            filterOptions={[
              { id: "all", label: "All statuses", count: statusCounts?.all ?? 0 },
              { id: "active", label: "Active", count: statusCounts?.active ?? 0 },
              { id: "inactive", label: "Inactive", count: statusCounts?.inactive ?? 0 }
            ]}
            searchPlaceholder="Search SKU, title, or product"
            searchValue={search}
            onSearchValueChange={(value) => {
              setSearch(value);
              setPageValue("1");
            }}
          />
        </div>
      </div>
      <ProductVariantList
        listTools={listTools}
        loading={query.isLoading}
        records={records}
        onEdit={setEditing}
        onStatus={(record) => statusMutation.mutate(record)}
      />
      {total > 100 ? (
        <WorkspacePagination
          page={currentPage}
          rowsPerPage={currentPageSize}
          rowsPerPageOptions={[20, 50, 100]}
          showingLabel={buildShowingLabel(currentPage, currentPageSize, total)}
          singularLabel="variant"
          totalCount={total}
          totalPages={pageCount}
          onNextPage={() => setPageValue(String(Math.min(pageCount, currentPage + 1)))}
          onPageChange={(next) => setPageValue(String(next))}
          onPreviousPage={() => setPageValue(String(Math.max(1, currentPage - 1)))}
          onRowsPerPageChange={(value) => {
            setPageSizeValue(String(value));
            setPageValue("1");
          }}
        />
      ) : null}
    </WorkspacePage>
  );
}
