import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@codexsun/ui/components/button";
import { Card } from "@codexsun/ui/components/card";
import { Input } from "@codexsun/ui/components/input";
import { Label } from "@codexsun/ui/components/label";
import { useAttributeProducts, useProductAttributeAssignment } from "./product-attribute.hooks";

export function ProductAttributeAssignmentForm({
  loading,
  onCancel,
  onSubmit
}: {
  loading: boolean;
  onCancel: () => void;
  onSubmit: (
    productInformationId: number,
    values: Array<{ attributeId: number; values: string[] }>
  ) => void;
}) {
  const products = useAttributeProducts();
  const [productInformationId, setProductInformationId] = useState<number | null>(null);
  const assignment = useProductAttributeAssignment(productInformationId);
  const [values, setValues] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    if (!assignment.data) return;
    setValues(
      Object.fromEntries(
        assignment.data.map((entry) => [entry.attributeId, entry.values.join(", ")])
      )
    );
  }, [assignment.data]);
  const submit = () => {
    if (productInformationId === null) return setError("Choose a product first.");
    const entries = (assignment.data ?? [])
      .map((entry) => ({
        attributeId: entry.attributeId,
        values: (values[entry.attributeId] ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      }))
      .filter((entry) => entry.values.length > 0);
    setError("");
    onSubmit(productInformationId, entries);
  };
  return (
    <Card
      title="Assign product attributes"
      description="Set the active attribute values for one product. Saving replaces this product's values."
    >
      <div className="max-w-md space-y-2">
        <Label>Product *</Label>
        <select
          className="h-10 w-full rounded-md border bg-background px-3"
          value={productInformationId ?? ""}
          onChange={(event) =>
            setProductInformationId(event.target.value ? Number(event.target.value) : null)
          }
        >
          <option value="">Choose a product</option>
          {(products.data ?? []).map((product) => (
            <option key={product.id} value={product.id}>
              {product.title}
            </option>
          ))}
        </select>
      </div>
      {productInformationId === null ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Select a product to load its attribute values.
        </p>
      ) : assignment.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading attributes…</p>
      ) : (assignment.data ?? []).length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Create an active attribute definition first.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(assignment.data ?? []).map((entry) => (
            <Field
              key={entry.attributeId}
              label={`${entry.name}${entry.unit ? ` (${entry.unit})` : ""}`}
            >
              <Input
                placeholder="Comma-separated values"
                value={values[entry.attributeId] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [entry.attributeId]: event.target.value
                  }))
                }
              />
            </Field>
          ))}
        </div>
      )}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={loading || productInformationId === null} onClick={submit}>
          {loading ? "Saving..." : "Save values"}
        </Button>
      </div>
    </Card>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
