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
import { productAttributeSchema } from "./product-attribute.schema";
import type { ProductAttributePayload, ProductAttributeRecord } from "./product-attribute.types";

const empty: ProductAttributePayload = {
  code: "",
  dataType: "text",
  isFilterable: true,
  name: "",
  sortOrder: 1000,
  status: "active",
  unit: ""
};

const dataTypeOptions = [
  { label: "Text", value: "text" },
  { label: "Number", value: "number" },
  { label: "Yes / no", value: "boolean" },
  { label: "Select", value: "select" },
  { label: "Colour", value: "color" }
];

export function ProductAttributeForm({
  error,
  loading,
  onCancel,
  onSubmit,
  record
}: {
  error?: unknown;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (value: ProductAttributePayload) => void;
  record: ProductAttributeRecord | null;
}) {
  const [value, setValue] = useState(record ? payload(record) : empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => setValue(record ? payload(record) : empty), [record]);
  useEffect(() => {
    setErrors(requestFieldErrors(error));
  }, [error]);
  const update = <K extends keyof ProductAttributePayload>(
    key: K,
    next: ProductAttributePayload[K]
  ) => {
    setValue((current) => ({ ...current, [key]: next }));
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[String(key)];
      return nextErrors;
    });
  };
  const submit = () => {
    const parsed = productAttributeSchema.safeParse(value);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };
  return (
    <WorkspaceUpsertPage
      title={record ? "Edit attribute" : "New attribute"}
      description="Attributes are reusable, filterable product characteristics."
      onBack={onCancel}
    >
      <WorkspaceFormPanel>
        {error instanceof Error ? (
          <WorkspaceFormBanner title="Attribute could not be saved">
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
            <Field error={errors.code} label="Code" required>
              <Input value={value.code} onChange={(event) => update("code", event.target.value)} />
            </Field>
            <Field error={errors.name} label="Name" required>
              <Input value={value.name} onChange={(event) => update("name", event.target.value)} />
            </Field>
            <Field label="Data type">
              <WorkspaceSelect
                ariaLabel="Data type"
                options={dataTypeOptions}
                value={value.dataType}
                onValueChange={(next) =>
                  update("dataType", next as ProductAttributePayload["dataType"])
                }
              />
            </Field>
            <Field error={errors.unit} label="Unit">
              <Input value={value.unit} onChange={(event) => update("unit", event.target.value)} />
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
          <div className="mt-5 flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input
                checked={value.isFilterable}
                type="checkbox"
                onChange={(event) => update("isFilterable", event.target.checked)}
              />
              Filterable on the storefront
            </label>
            <label className="flex items-center gap-2">
              <input
                checked={value.status === "active"}
                type="checkbox"
                onChange={(event) => update("status", event.target.checked ? "active" : "inactive")}
              />
              Active
            </label>
          </div>
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

function payload(record: ProductAttributeRecord): ProductAttributePayload {
  const {
    createdAt: _created,
    id: _id,
    revision: _revision,
    updatedAt: _updated,
    uuid: _uuid,
    valueCount: _count,
    ...value
  } = record;
  return value;
}
