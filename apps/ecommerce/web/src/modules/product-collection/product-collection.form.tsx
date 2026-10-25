import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@codexsun/ui/components/input";
import { Label } from "@codexsun/ui/components/label";
import { Textarea } from "@codexsun/ui/components/textarea";
import { WorkspaceSelect } from "@codexsun/ui/workspace/select";
import {
  WorkspaceFormBanner,
  WorkspaceFormField,
  WorkspaceFormFooter,
  WorkspaceFormGrid,
  WorkspaceFormPanel,
  WorkspaceUpsertPage
} from "@codexsun/ui/workspace/upsert";
import { fieldErrors } from "../../shared/form-errors";
import { requestFieldErrors } from "../../shared/request-error";
import { useCollectionItems, useCollectionProducts } from "./product-collection.hooks";
import { productCollectionSchema } from "./product-collection.schema";
import type { ProductCollectionPayload, ProductCollectionRecord } from "./product-collection.types";

const empty: ProductCollectionPayload = {
  description: "",
  heroImageUrl: "",
  publicationStatus: "draft",
  slug: "",
  sortOrder: 1000,
  title: ""
};

const publicationOptions = [
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" }
];

export function ProductCollectionForm({
  error,
  loading,
  onCancel,
  onSubmit,
  record
}: {
  error?: unknown;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (value: ProductCollectionPayload, productInformationIds: number[]) => void;
  record: ProductCollectionRecord | null;
}) {
  const products = useCollectionProducts();
  const items = useCollectionItems(record?.id ?? null);
  const [value, setValue] = useState(record ? payload(record) : empty);
  const [selected, setSelected] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => setValue(record ? payload(record) : empty), [record]);
  useEffect(() => {
    if (items.data) setSelected(items.data.map((item) => item.productInformationId));
  }, [items.data]);
  useEffect(() => {
    setErrors(requestFieldErrors(error));
  }, [error]);
  const update = <K extends keyof ProductCollectionPayload>(
    key: K,
    next: ProductCollectionPayload[K]
  ) => {
    setValue((current) => ({ ...current, [key]: next }));
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[String(key)];
      return nextErrors;
    });
  };
  const toggle = (id: number) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  const submit = () => {
    const parsed = productCollectionSchema.safeParse(value);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    onSubmit(parsed.data, selected);
  };
  const waitingForItems = record !== null && items.isLoading;
  return (
    <WorkspaceUpsertPage
      title={record ? "Edit collection" : "New collection"}
      description="Curate an ordered product collection and publish it to the storefront."
      onBack={onCancel}
    >
      <WorkspaceFormPanel>
        {error instanceof Error ? (
          <WorkspaceFormBanner title="Collection could not be saved">
            {error.message}
          </WorkspaceFormBanner>
        ) : null}
        {items.isError ? (
          <WorkspaceFormBanner title="Collection products could not be loaded" tone="warning">
            {items.error instanceof Error ? items.error.message : "Reload before saving changes."}
          </WorkspaceFormBanner>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <WorkspaceFormGrid>
            <Field error={errors.title} label="Title" required>
              <Input
                value={value.title}
                onChange={(event) => update("title", event.target.value)}
              />
            </Field>
            <Field error={errors.slug} label="Slug" required>
              <Input value={value.slug} onChange={(event) => update("slug", event.target.value)} />
            </Field>
            <Field error={errors.heroImageUrl} label="Hero image URL">
              <Input
                value={value.heroImageUrl}
                onChange={(event) => update("heroImageUrl", event.target.value)}
              />
            </Field>
            <Field label="Publication">
              <WorkspaceSelect
                ariaLabel="Publication"
                options={publicationOptions}
                value={value.publicationStatus}
                onValueChange={(next) =>
                  update("publicationStatus", next as ProductCollectionPayload["publicationStatus"])
                }
              />
            </Field>
            <Field error={errors.sortOrder} label="Sort order">
              <Input
                min="0"
                type="number"
                value={value.sortOrder}
                onChange={(event) => update("sortOrder", Number(event.target.value))}
              />
            </Field>
            <div className="md:col-span-2">
              <Field error={errors.description} label="Description">
                <Textarea
                  value={value.description}
                  onChange={(event) => update("description", event.target.value)}
                />
              </Field>
            </div>
          </WorkspaceFormGrid>
          <div className="mt-5">
            <Label>Products ({selected.length})</Label>
            <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
              {products.isLoading || waitingForItems ? (
                <p className="text-sm text-muted-foreground">Loading products...</p>
              ) : (products.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No live products are available.</p>
              ) : (
                (products.data ?? []).map((product) => (
                  <label className="flex items-center gap-2 text-sm" key={product.id}>
                    <input
                      checked={selected.includes(product.id)}
                      disabled={waitingForItems}
                      type="checkbox"
                      onChange={() => toggle(product.id)}
                    />
                    {product.title}
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="mt-6">
            <WorkspaceFormFooter
              onCancel={onCancel}
              primaryLabel={loading ? "Saving..." : "Save"}
              primaryLoading={loading || waitingForItems}
            />
          </div>
        </form>
      </WorkspaceFormPanel>
    </WorkspaceUpsertPage>
  );
}

function Field({
  children,
  error,
  label,
  required = false
}: {
  children: ReactNode;
  error?: string | undefined;
  label: string;
  required?: boolean;
}) {
  return (
    <WorkspaceFormField label={label} required={required}>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </WorkspaceFormField>
  );
}

function payload(record: ProductCollectionRecord): ProductCollectionPayload {
  return {
    description: record.description,
    heroImageUrl: record.heroImageUrl,
    publicationStatus: record.publicationStatus,
    slug: record.slug,
    sortOrder: record.sortOrder,
    title: record.title
  };
}
