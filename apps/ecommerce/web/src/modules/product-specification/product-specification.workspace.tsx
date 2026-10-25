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
import { ProductSpecificationForm } from "./product-specification.form";
import { ProductSpecificationShow } from "./product-specification.show";
import {
  ProductSpecificationList,
  productSpecificationListColumns
} from "./product-specification.list";
import {
  createProductSpecification,
  setProductSpecificationStatus,
  updateProductSpecification
} from "./product-specification.services";
import {
  productSpecificationQueryKey,
  useProductSpecifications
} from "./product-specification.hooks";
import type {
  ProductSpecificationPayload,
  ProductSpecificationRecord,
  ProductSpecificationStatus
} from "./product-specification.types";

export function ProductSpecificationWorkspace() {
  const listTools = useWorkspaceListTools(productSpecificationListColumns);
  const [statusFilter, setStatusFilter] = useWorkspaceQueryValue("status", "all");
  const [search, setSearch] = useWorkspaceQueryValue("q", "");
  const [pageValue, setPageValue] = useWorkspaceQueryValue("page", "1");
  const [pageSizeValue, setPageSizeValue] = useWorkspaceQueryValue("pageSize", "100");
  const page = Math.max(1, Number(pageValue) || 1);
  const requestedPageSize = Number(pageSizeValue);
  const pageSize = [20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 100;
  const client = useQueryClient();
  const filters = {
    label: listTools.filters.label ?? "",
    product: listTools.filters.product ?? "",
    sortOrder: listTools.filters.sortOrder ?? "",
    value: listTools.filters.value ?? ""
  };
  const query = useProductSpecifications(
    search,
    statusFilter === "all" ? undefined : (statusFilter as ProductSpecificationStatus),
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
  useEffect(() => {
    if (query.data?.page !== undefined && query.data.page !== page) {
      setPageValue(String(query.data.page));
    }
    if (query.data?.pageSize !== undefined && query.data.pageSize !== pageSize) {
      setPageSizeValue(String(query.data.pageSize));
    }
  }, [page, pageSize, query.data?.page, query.data?.pageSize, setPageSizeValue, setPageValue]);
  const [editing, setEditing] = useWorkspaceRecordSelection<ProductSpecificationRecord>(
    records,
    (record) => String(record.id)
  );
  const [viewingId, setViewingId] = useWorkspaceQueryValue("view", "");
  const viewing = viewingId ? records.find((record) => String(record.id) === viewingId) : undefined;
  const refresh = () => client.invalidateQueries({ queryKey: productSpecificationQueryKey });
  const save = useMutation({
    mutationFn: (value: ProductSpecificationPayload) =>
      editing
        ? updateProductSpecification(editing.id, value, editing.revision)
        : createProductSpecification(value),
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      await refresh();
      setEditing(undefined);
      toast.success("Specification saved");
    }
  });
  const changeStatus = useMutation({
    mutationFn: (record: ProductSpecificationRecord) =>
      setProductSpecificationStatus(record.id, record.status === "active" ? "inactive" : "active"),
    onError: (error) => toast.error(error.message),
    onSuccess: refresh
  });
  if (editing !== undefined)
    return (
      <ProductSpecificationForm
        error={save.error}
        loading={save.isPending}
        record={editing}
        onCancel={() => setEditing(undefined)}
        onSubmit={(value) => save.mutate(value)}
      />
    );
  if (viewing)
    return (
      <ProductSpecificationShow
        record={viewing}
        onBack={() => setViewingId("")}
        onEdit={(record) => {
          setViewingId("");
          setEditing(record);
        }}
        onStatus={(record) => changeStatus.mutate(record)}
      />
    );
  if (viewingId) return <MissingRecord title="Specification" onBack={() => setViewingId("")} />;
  return (
    <WorkspacePage
      variant="list"
      title="Specifications"
      description="Manage ordered product specification facts shown on the storefront."
      actions={
        <Button onClick={() => setEditing(null)}>
          <Plus className="size-4" />
          New specification
        </Button>
      }
    >
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
        searchPlaceholder="Search product, label or value"
        searchValue={search}
        onSearchValueChange={(value) => {
          setSearch(value);
          setPageValue("1");
        }}
      />
      <ProductSpecificationList
        listTools={listTools}
        loading={query.isLoading}
        records={records}
        onEdit={setEditing}
        onStatus={(record) => changeStatus.mutate(record)}
        onView={(record) => setViewingId(String(record.id))}
      />
      {total > 100 ? (
        <WorkspacePagination
          page={currentPage}
          rowsPerPage={currentPageSize}
          rowsPerPageOptions={[20, 50, 100]}
          showingLabel={buildShowingLabel(currentPage, currentPageSize, total)}
          singularLabel="specification"
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

function MissingRecord({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <WorkspacePage
      title={title}
      description="This record is not available in the current list."
      onBack={onBack}
    >
      <p className="text-sm text-muted-foreground">
        Clear filters or reload the list, then try again.
      </p>
    </WorkspacePage>
  );
}
