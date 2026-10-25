import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@codexsun/ui/components/input";
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
import { useSpecificationProducts } from "./product-specification.hooks";
import { productSpecificationSchema } from "./product-specification.schema";
import type {
  ProductSpecificationPayload,
  ProductSpecificationRecord
} from "./product-specification.types";

const empty: ProductSpecificationPayload = {
  label: "",
  productInformationId: 0,
  sortOrder: 1000,
  status: "active",
  value: ""
};

export function ProductSpecificationForm({
  error,
  loading,
  onCancel,
  onSubmit,
  record
}: {
  error?: unknown;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (value: ProductSpecificationPayload) => void;
  record: ProductSpecificationRecord | null;
}) {
  const products = useSpecificationProducts();
  const [value, setValue] = useState(record ? payload(record) : empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => setValue(record ? payload(record) : empty), [record]);
  useEffect(() => {
    setErrors(requestFieldErrors(error));
  }, [error]);
  const update = <K extends keyof ProductSpecificationPayload>(
    key: K,
    next: ProductSpecificationPayload[K]
  ) => {
    setValue((current) => ({ ...current, [key]: next }));
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[String(key)];
      return nextErrors;
    });
  };
  const submit = () => {
    const parsed = productSpecificationSchema.safeParse(value);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };
  const productOptions = [
    { label: "Choose a product", value: "0" },
    ...(products.data ?? []).map((product) => ({
      label: product.title,
      value: String(product.id)
    }))
  ];
  return (
    <WorkspaceUpsertPage
      title={record ? "Edit specification" : "New specification"}
      description="Specifications are labelled product facts shown on the storefront."
      onBack={onCancel}
    >
      <WorkspaceFormPanel>
        {error instanceof Error ? (
          <WorkspaceFormBanner title="Specification could not be saved">
            {error.message}
          </WorkspaceFormBanner>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <WorkspaceFormGrid>
            <Field error={errors.productInformationId} label="Product" required>
              <WorkspaceSelect
                ariaLabel="Product"
                options={productOptions}
                value={String(value.productInformationId)}
                onValueChange={(next) => update("productInformationId", Number(next) || 0)}
              />
            </Field>
            <Field error={errors.label} label="Label" required>
              <Input
                value={value.label}
                onChange={(event) => update("label", event.target.value)}
              />
            </Field>
            <Field error={errors.value} label="Value" required>
              <Input
                value={value.value}
                onChange={(event) => update("value", event.target.value)}
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
          </WorkspaceFormGrid>
          <label className="mt-5 flex items-center gap-2 text-sm">
            <input
              checked={value.status === "active"}
              type="checkbox"
              onChange={(event) => update("status", event.target.checked ? "active" : "inactive")}
            />
            Active
          </label>
          <div className="mt-6">
            <WorkspaceFormFooter
              onCancel={onCancel}
              primaryLabel={loading ? "Saving..." : "Save"}
              primaryLoading={loading}
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

function payload(record: ProductSpecificationRecord): ProductSpecificationPayload {
  return {
    label: record.label,
    productInformationId: record.productInformationId,
    sortOrder: record.sortOrder,
    status: record.status,
    value: record.value
  };
}
