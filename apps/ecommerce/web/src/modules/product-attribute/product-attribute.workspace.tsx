import { useEffect } from "react";
import { useWorkspaceListTools } from "@codexsun/ui/workspace/list-tools";
import {
  useWorkspaceQueryValue,
  useWorkspaceRecordSelection
} from "@codexsun/ui/workspace/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Tags } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@codexsun/ui/components/button";
import { WorkspacePagination, buildShowingLabel } from "@codexsun/ui/workspace";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { ProductAttributeAssignmentForm } from "./product-attribute.assignment-form";
import { ProductAttributeForm } from "./product-attribute.form";
import { ProductAttributeShow } from "./product-attribute.show";
import { ProductAttributeList, productAttributeListColumns } from "./product-attribute.list";
import {
  createProductAttribute,
  saveProductAttributeAssignment,
  setProductAttributeStatus,
  updateProductAttribute
} from "./product-attribute.services";
import { useProductAttributes, productAttributeQueryKey } from "./product-attribute.hooks";
import type {
  ProductAttributePayload,
  ProductAttributeRecord,
  ProductAttributeStatus
} from "./product-attribute.types";

export function ProductAttributeWorkspace() {
  const listTools = useWorkspaceListTools(productAttributeListColumns);
  const [statusFilter, setStatusFilter] = useWorkspaceQueryValue("status", "all");
  const [search, setSearch] = useWorkspaceQueryValue("q", "");
  const [pageValue, setPageValue] = useWorkspaceQueryValue("page", "1");
  const [pageSizeValue, setPageSizeValue] = useWorkspaceQueryValue("pageSize", "100");
  const page = Math.max(1, Number(pageValue) || 1);
  const requestedPageSize = Number(pageSizeValue);
  const pageSize = [20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 100;
  const client = useQueryClient();
  const filters = {
    code: listTools.filters.code ?? "",
    dataType: listTools.filters.dataType ?? "",
    name: listTools.filters.name ?? "",
    sortOrder: listTools.filters.sortOrder ?? "",
    values: listTools.filters.values ?? ""
  };
  const query = useProductAttributes(
    search,
    statusFilter === "all" ? undefined : (statusFilter as ProductAttributeStatus),
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
  const [editing, setEditing] = useWorkspaceRecordSelection<ProductAttributeRecord>(
    records,
    (record) => String(record.id)
  );
  const [assigning, setAssigning] = useWorkspaceQueryValue("assign", "0");
  const [viewingId, setViewingId] = useWorkspaceQueryValue("view", "");
  const viewing = viewingId ? records.find((record) => String(record.id) === viewingId) : undefined;
  const refresh = () => client.invalidateQueries({ queryKey: productAttributeQueryKey });
  const save = useMutation({
    mutationFn: (value: ProductAttributePayload) =>
      editing
        ? updateProductAttribute(editing.id, value, editing.revision)
        : createProductAttribute(value),
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      await refresh();
      setEditing(undefined);
      toast.success("Attribute saved");
    }
  });
  const changeStatus = useMutation({
    mutationFn: (record: ProductAttributeRecord) =>
      setProductAttributeStatus(record.id, record.status === "active" ? "inactive" : "active"),
    onError: (error) => toast.error(error.message),
    onSuccess: refresh
  });
  const assign = useMutation({
    mutationFn: ({
      productInformationId,
      values
    }: {
      productInformationId: number;
      values: Array<{ attributeId: number; values: string[] }>;
    }) => saveProductAttributeAssignment(productInformationId, values),
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      await refresh();
      setAssigning("0");
      toast.success("Product attribute values saved");
    }
  });
  if (editing !== undefined)
    return (
      <ProductAttributeForm
        error={save.error}
        loading={save.isPending}
        record={editing}
        onCancel={() => setEditing(undefined)}
        onSubmit={(value) => save.mutate(value)}
      />
    );
  if (assigning === "1")
    return (
      <ProductAttributeAssignmentForm
        loading={assign.isPending}
        onCancel={() => setAssigning("0")}
        onSubmit={(productInformationId, values) => assign.mutate({ productInformationId, values })}
      />
    );
  if (viewing)
    return (
      <ProductAttributeShow
        record={viewing}
        onBack={() => setViewingId("")}
        onEdit={(record) => {
          setViewingId("");
          setEditing(record);
        }}
        onStatus={(record) => changeStatus.mutate(record)}
      />
    );
  if (viewingId) return <MissingRecord title="Attribute" onBack={() => setViewingId("")} />;
  return (
    <WorkspacePage
      variant="list"
      title="Attributes"
      description="Manage reusable, filterable product characteristics and their product values."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAssigning("1")}>
            <Tags className="size-4" />
            Assign to product
          </Button>
          <Button onClick={() => setEditing(null)}>
            <Plus className="size-4" />
            New attribute
          </Button>
        </div>
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
        searchPlaceholder="Search attribute code or name"
        searchValue={search}
        onSearchValueChange={(value) => {
          setSearch(value);
          setPageValue("1");
        }}
      />
      <ProductAttributeList
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
          singularLabel="attribute"
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
