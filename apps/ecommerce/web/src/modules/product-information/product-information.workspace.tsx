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
import { ProductInformationForm } from "./product-information.form";
import { ProductInformationShow } from "./product-information.show";
import {
  useCoreBrandOptions,
  useCoreProductOptions,
  useProductInformation,
  productInformationQueryKey
} from "./product-information.hooks";
import { ProductInformationList, productinformationListColumns } from "./product-information.list";
import {
  archiveProductInformation,
  createProductInformation,
  updateProductInformation
} from "./product-information.services";
import type {
  ProductInformationPayload,
  ProductInformationRecord,
  PublicationStatus
} from "./product-information.types";
export function ProductInformationWorkspace({ onOpenAi }: { onOpenAi: (draft: string) => void }) {
  const listTools = useWorkspaceListTools(productinformationListColumns);
  const [statusFilter, setStatusFilter] = useWorkspaceQueryValue("status", "all");
  const client = useQueryClient();
  const [search, setSearch] = useWorkspaceQueryValue("q", "");
  const [pageValue, setPageValue] = useWorkspaceQueryValue("page", "1");
  const [pageSizeValue, setPageSizeValue] = useWorkspaceQueryValue("pageSize", "100");
  const page = Math.max(1, Number(pageValue) || 1);
  const requestedPageSize = Number(pageSizeValue);
  const pageSize = [20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 100;
  const filters = {
    brandName: listTools.filters.brandName ?? "",
    coreProductName: listTools.filters.coreProductName ?? "",
    slug: listTools.filters.slug ?? "",
    storefrontTitle: listTools.filters.storefrontTitle ?? ""
  };

  const query = useProductInformation(
    search,
    statusFilter === "all" ? undefined : (statusFilter as PublicationStatus),
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
  const [editing, setEditing] = useWorkspaceRecordSelection<ProductInformationRecord>(
    query.data?.items ?? [],
    (record) => String(record.id)
  );
  const [viewingId, setViewingId] = useWorkspaceQueryValue("view", "");
  const viewing = viewingId
    ? (query.data?.items ?? []).find((record) => String(record.id) === viewingId)
    : undefined;

  useEffect(() => {
    if (query.data?.page !== undefined && query.data.page !== page) {
      setPageValue(String(query.data.page));
    }
    if (query.data?.pageSize !== undefined && query.data.pageSize !== pageSize) {
      setPageSizeValue(String(query.data.pageSize));
    }
  }, [page, pageSize, query.data?.page, query.data?.pageSize, setPageSizeValue, setPageValue]);
  const coreProducts = useCoreProductOptions();
  const brands = useCoreBrandOptions();
  const save = useMutation({
    mutationFn: (payload: ProductInformationPayload) =>
      editing
        ? updateProductInformation(editing.id, payload, editing.revision)
        : createProductInformation(payload),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: productInformationQueryKey });
      setEditing(undefined);
      toast.success("Product information saved");
    },
    onError: (error) =>
      toast.error("Product information could not be saved", { description: error.message })
  });
  const archive = useMutation({
    mutationFn: (record: ProductInformationRecord) => archiveProductInformation(record.id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: productInformationQueryKey });
      toast.success("Product information archived");
    },
    onError: (error) =>
      toast.error("Product information could not be archived", { description: error.message })
  });
  if (editing !== undefined)
    return (
      <ProductInformationForm
        brands={brands.data ?? []}
        coreProducts={coreProducts.data ?? []}
        loading={save.isPending}
        record={editing}
        onCancel={() => setEditing(undefined)}
        onOpenAi={onOpenAi}
        onSubmit={(payload) => save.mutate(payload)}
      />
    );
  if (viewing)
    return (
      <ProductInformationShow
        loading={archive.isPending}
        record={viewing}
        onArchive={(record) => archive.mutate(record)}
        onBack={() => setViewingId("")}
        onEdit={(record) => {
          setViewingId("");
          setEditing(record);
        }}
      />
    );
  if (viewingId) return <MissingRecord title="Item" onBack={() => setViewingId("")} />;
  return (
    <WorkspacePage
      variant="list"
      title="Items"
      description="Manage Frappe-linked items and their complete storefront content."
      actions={
        <div className="flex gap-2">
          <Button onClick={() => setEditing(null)}>
            <Plus className="size-4" />
            New item
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap gap-3">
        <div className="min-w-72 flex-1">
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
              { id: "draft", label: "Draft", count: statusCounts?.draft ?? 0 },
              { id: "published", label: "Published", count: statusCounts?.published ?? 0 },
              { id: "archived", label: "Archived", count: statusCounts?.archived ?? 0 }
            ]}
            searchPlaceholder="Search ecommerce products"
            searchValue={search}
            onSearchValueChange={(value) => {
              setSearch(value);
              setPageValue("1");
            }}
          />
        </div>
      </div>
      <ProductInformationList
        listTools={listTools}
        loading={query.isLoading}
        records={records}
        onEdit={setEditing}
        onArchive={(record) => archive.mutate(record)}
        onView={(record) => setViewingId(String(record.id))}
      />
      {total > 100 ? (
        <WorkspacePagination
          page={currentPage}
          rowsPerPage={currentPageSize}
          rowsPerPageOptions={[20, 50, 100]}
          showingLabel={buildShowingLabel(currentPage, currentPageSize, total)}
          singularLabel="product"
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
