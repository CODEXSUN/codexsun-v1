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
import { ProductCollectionForm } from "./product-collection.form";
import { ProductCollectionShow } from "./product-collection.show";
import { ProductCollectionList, productCollectionListColumns } from "./product-collection.list";
import {
  createProductCollection,
  setProductCollectionPublication,
  updateProductCollection
} from "./product-collection.services";
import { productCollectionQueryKey, useProductCollections } from "./product-collection.hooks";
import type {
  ProductCollectionPayload,
  ProductCollectionPublication,
  ProductCollectionRecord
} from "./product-collection.types";

export function ProductCollectionWorkspace() {
  const listTools = useWorkspaceListTools(productCollectionListColumns);
  const [publicationFilter, setPublicationFilter] = useWorkspaceQueryValue("publication", "all");
  const [search, setSearch] = useWorkspaceQueryValue("q", "");
  const [pageValue, setPageValue] = useWorkspaceQueryValue("page", "1");
  const [pageSizeValue, setPageSizeValue] = useWorkspaceQueryValue("pageSize", "100");
  const page = Math.max(1, Number(pageValue) || 1);
  const requestedPageSize = Number(pageSizeValue);
  const pageSize = [20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 100;
  const client = useQueryClient();
  const filters = {
    itemCount: listTools.filters.itemCount ?? "",
    sortOrder: listTools.filters.sortOrder ?? "",
    title: listTools.filters.title ?? ""
  };
  const query = useProductCollections(
    search,
    publicationFilter === "all" ? undefined : (publicationFilter as ProductCollectionPublication),
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
  const [editing, setEditing] = useWorkspaceRecordSelection<ProductCollectionRecord>(
    records,
    (record) => String(record.id)
  );
  const [viewingId, setViewingId] = useWorkspaceQueryValue("view", "");
  const viewing = viewingId ? records.find((record) => String(record.id) === viewingId) : undefined;
  const refresh = () => client.invalidateQueries({ queryKey: productCollectionQueryKey });
  const save = useMutation({
    mutationFn: ({
      payload: value,
      productInformationIds
    }: {
      payload: ProductCollectionPayload;
      productInformationIds: number[];
    }) =>
      editing
        ? updateProductCollection(editing.id, value, editing.revision, productInformationIds)
        : createProductCollection(value, productInformationIds),
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      await refresh();
      setEditing(undefined);
      toast.success("Collection saved");
    }
  });
  const changePublication = useMutation({
    mutationFn: (record: ProductCollectionRecord) =>
      setProductCollectionPublication(
        record.id,
        record.publicationStatus === "published" ? "draft" : "published"
      ),
    onError: (error) => toast.error(error.message),
    onSuccess: refresh
  });
  if (editing !== undefined)
    return (
      <ProductCollectionForm
        error={save.error}
        loading={save.isPending}
        record={editing}
        onCancel={() => setEditing(undefined)}
        onSubmit={(value, productInformationIds) =>
          save.mutate({ payload: value, productInformationIds })
        }
      />
    );
  if (viewing)
    return (
      <ProductCollectionShow
        loading={changePublication.isPending}
        record={viewing}
        onBack={() => setViewingId("")}
        onEdit={(record) => {
          setViewingId("");
          setEditing(record);
        }}
        onPublication={(record) => changePublication.mutate(record)}
      />
    );
  if (viewingId) return <MissingRecord title="Collection" onBack={() => setViewingId("")} />;
  return (
    <WorkspacePage
      variant="list"
      title="Collections"
      description="Curate ordered product collections and control storefront publication."
      actions={
        <Button onClick={() => setEditing(null)}>
          <Plus className="size-4" />
          New collection
        </Button>
      }
    >
      <WorkspaceFilters
        toolbarAction={listTools.toolbarAction}
        columnOptions={listTools.columnOptions}
        onShowAllColumns={listTools.onShowAllColumns}
        filterValue={publicationFilter}
        onFilterValueChange={(value) => {
          setPublicationFilter(value);
          setPageValue("1");
        }}
        filterOptions={[
          { id: "all", label: "All publication", count: statusCounts?.all ?? 0 },
          { id: "draft", label: "Draft", count: statusCounts?.draft ?? 0 },
          { id: "published", label: "Published", count: statusCounts?.published ?? 0 },
          { id: "archived", label: "Archived", count: statusCounts?.archived ?? 0 }
        ]}
        searchPlaceholder="Search collection slug, title or description"
        searchValue={search}
        onSearchValueChange={(value) => {
          setSearch(value);
          setPageValue("1");
        }}
      />
      <ProductCollectionList
        listTools={listTools}
        loading={query.isLoading}
        records={records}
        onEdit={setEditing}
        onPublication={(record) => changePublication.mutate(record)}
        onView={(record) => setViewingId(String(record.id))}
      />
      {total > 100 ? (
        <WorkspacePagination
          page={currentPage}
          rowsPerPage={currentPageSize}
          rowsPerPageOptions={[20, 50, 100]}
          showingLabel={buildShowingLabel(currentPage, currentPageSize, total)}
          singularLabel="collection"
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
