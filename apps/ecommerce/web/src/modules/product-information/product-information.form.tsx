import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import { Label } from "@codexsun/ui/components/label";
import { Textarea } from "@codexsun/ui/components/textarea";
import { WorkspaceLookup } from "@codexsun/ui/workspace/lookup";
import { WorkspaceAnimatedTabs } from "@codexsun/ui/workspace/animated-tabs";
import {
  WorkspaceFormBanner,
  WorkspaceFormPanel,
  WorkspaceUpsertPage
} from "@codexsun/ui/workspace/upsert";
import { fieldErrors } from "../../shared/form-errors";
import { useFrappeItemOptions } from "./product-information.hooks";
import { getFrappeItem } from "./product-information.services";
import { ProductInformationPreview } from "./product-information.preview";
import { buildPikoItemDraft } from "./product-information.ai";
import { productInformationSchema } from "./product-information.schema";
import type {
  CoreBrandOption,
  CoreProductOption,
  FrappeItemOption,
  ProductInformationPayload,
  ProductInformationRecord,
  PublicationStatus
} from "./product-information.types";

const empty: ProductInformationPayload = {
  coreProductId: 0,
  brandId: null,
  storefrontTitle: "",
  subtitle: "",
  slug: "",
  shortDescription: "",
  description: "",
  bulletPoints: [],
  material: "",
  countryOfOrigin: "",
  manufacturer: "",
  warranty: "",
  returnPolicy: "",
  shippingClass: "",
  weight: null,
  length: null,
  width: null,
  height: null,
  minimumOrderQuantity: 1,
  maximumOrderQuantity: null,
  seoTitle: "",
  seoDescription: "",
  publicationStatus: "draft",
  isFeatured: false
};
export function ProductInformationForm({
  brands,
  coreProducts,
  loading,
  onOpenAi,
  onCancel,
  onSubmit,
  record
}: {
  brands: CoreBrandOption[];
  coreProducts: CoreProductOption[];
  loading: boolean;
  onCancel: () => void;
  onOpenAi: (draft: string) => void;
  onSubmit: (payload: ProductInformationPayload) => void;
  record: ProductInformationRecord | null;
}) {
  const [value, setValue] = useState<ProductInformationPayload>(record ? toPayload(record) : empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [frappeSearch, setFrappeSearch] = useState("");
  const [frappeItemCode, setFrappeItemCode] = useState("");
  const [frappeMessage, setFrappeMessage] = useState("");
  const [selectedFrappeItem, setSelectedFrappeItem] = useState<FrappeItemOption | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const frappeItems = useFrappeItemOptions(frappeSearch);
  const frappeOptions = useMemo(
    () =>
      (frappeItems.data ?? []).map((item) => ({
        value: item.itemCode,
        label: item.itemName,
        description: item.itemCode,
        meta: [item.itemGroup, item.brand].filter(Boolean).join(" · ")
      })),
    [frappeItems.data]
  );
  useEffect(() => setValue(record ? toPayload(record) : empty), [record]);
  const update = <K extends keyof ProductInformationPayload>(
    key: K,
    next: ProductInformationPayload[K]
  ) => {
    setValue((current) => ({ ...current, [key]: next }));
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[String(key)];
      return nextErrors;
    });
  };
  const number = (raw: string) => (raw === "" ? null : Number(raw));
  const submit = () => {
    const parsed = productInformationSchema.safeParse(value);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };
  const selectFrappeItem = async (itemCode: string) => {
    setFrappeItemCode(itemCode);
    if (!itemCode) {
      setSelectedFrappeItem(null);
      setFrappeMessage("");
      return;
    }
    setFrappeMessage("Loading the latest item from Frappe…");
    try {
      const item = await getFrappeItem(itemCode);
      setSelectedFrappeItem(item);
      const product = coreProducts.find((candidate) =>
        [item.itemCode, item.itemName].some(
          (name) => candidate.name.trim().toLowerCase() === name.trim().toLowerCase()
        )
      );
      const brand = brands.find(
        (candidate) => candidate.name.trim().toLowerCase() === item.brand.trim().toLowerCase()
      );
      const description = plainText(item.description);
      setValue((current) => ({
        ...current,
        brandId: brand?.id ?? current.brandId,
        coreProductId: product?.id ?? 0,
        description,
        manufacturer: item.brand || current.manufacturer,
        seoDescription: description.slice(0, 160),
        seoTitle: item.itemName.slice(0, 70),
        shortDescription: description.slice(0, 500),
        slug: slugify(item.itemCode),
        storefrontTitle: item.itemName,
        subtitle: item.itemGroup
      }));
      setFrappeMessage(
        product
          ? `Filled from Frappe item ${item.itemCode}. Review the content before saving.`
          : `Filled from Frappe, but no matching local product exists. Pull Items from Frappe in Data Source settings before saving.`
      );
    } catch (caught) {
      setSelectedFrappeItem(null);
      setFrappeMessage(
        caught instanceof Error ? caught.message : "Could not load the Frappe item."
      );
    }
  };
  return (
    <WorkspaceUpsertPage
      title={record ? "Edit item" : "New item"}
      onBack={onCancel}
      action={
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onOpenAi(
              buildPikoItemDraft({ brands, coreProducts, frappeItem: selectedFrappeItem, value })
            )
          }
        >
          <Sparkles className="size-4" />
          Ask Piko AI
        </Button>
      }
    >
      <WorkspaceFormPanel title="Item content">
        {frappeMessage ? (
          <WorkspaceFormBanner
            title={value.coreProductId ? "Frappe item loaded" : "Local product link required"}
            tone={value.coreProductId ? "info" : "warning"}
          >
            {frappeMessage}
          </WorkspaceFormBanner>
        ) : null}
        <div className="mb-5 rounded-md border border-primary/20 bg-primary/5 p-4">
          <Field label="Frappe Item lookup">
            <WorkspaceLookup
              allowTextValue={false}
              loading={frappeItems.isLoading}
              options={frappeOptions}
              placeholder="Search item code or item name"
              showAllOptionsOnFocus
              value={frappeItemCode}
              onTextChange={setFrappeSearch}
              onValueChange={(itemCode) => void selectFrappeItem(itemCode)}
            />
          </Field>
        </div>
        <WorkspaceAnimatedTabs
          contentPadding
          keepMounted
          value={activeTab}
          onValueChange={setActiveTab}
          tabs={[
            {
              value: "details",
              label: "Details",
              content: (
                <DetailsTab
                  brands={brands}
                  coreProducts={coreProducts}
                  errors={errors}
                  frappeItem={selectedFrappeItem}
                  value={value}
                  update={update}
                />
              )
            },
            {
              value: "fulfilment",
              label: "Fulfilment",
              content: (
                <FulfilmentTab
                  brands={brands}
                  errors={errors}
                  frappeItem={selectedFrappeItem}
                  value={value}
                  update={update}
                  number={number}
                />
              )
            },
            {
              value: "content",
              label: "Content & SEO",
              content: (
                <ContentTab
                  brands={brands}
                  errors={errors}
                  frappeItem={selectedFrappeItem}
                  value={value}
                  update={update}
                />
              )
            }
          ]}
        />
        {errors.form ? <p className="mt-3 text-sm text-destructive">{errors.form}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={loading} onClick={submit}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </WorkspaceFormPanel>
    </WorkspaceUpsertPage>
  );
}

type UpdateProductInformation = <K extends keyof ProductInformationPayload>(
  key: K,
  value: ProductInformationPayload[K]
) => void;

function DetailsTab({
  brands,
  coreProducts,
  errors,
  frappeItem,
  update,
  value
}: {
  brands: CoreBrandOption[];
  coreProducts: CoreProductOption[];
  errors: Record<string, string>;
  frappeItem: FrappeItemOption | null;
  update: UpdateProductInformation;
  value: ProductInformationPayload;
}) {
  return (
    <div className="space-y-10">
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <Field error={errors.coreProductId} label="Core product">
          <Select
            value={value.coreProductId}
            onChange={(raw) => update("coreProductId", Number(raw))}
          >
            <option value={0}>Select a product</option>
            {coreProducts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Brand">
          <Select
            value={value.brandId ?? ""}
            onChange={(raw) => update("brandId", raw ? Number(raw) : null)}
          >
            <option value="">No brand</option>
            {brands.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Publication">
          <Select
            value={value.publicationStatus}
            onChange={(raw) => update("publicationStatus", raw as PublicationStatus)}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>
        <TextField
          error={errors.storefrontTitle}
          label="Storefront title"
          value={value.storefrontTitle}
          onChange={(raw) => update("storefrontTitle", raw)}
        />
        <TextField
          label="Subtitle"
          value={value.subtitle}
          onChange={(raw) => update("subtitle", raw)}
        />
        <TextField
          error={errors.slug}
          label="Slug"
          value={value.slug}
          onChange={(raw) => update("slug", raw)}
        />
        <TextField
          label="Manufacturer"
          value={value.manufacturer}
          onChange={(raw) => update("manufacturer", raw)}
        />
        <TextField
          label="Material"
          value={value.material}
          onChange={(raw) => update("material", raw)}
        />
        <TextField
          label="Country of origin"
          value={value.countryOfOrigin}
          onChange={(raw) => update("countryOfOrigin", raw)}
        />
        <Field error={errors.shortDescription} label="Short description">
          <Textarea
            className="min-h-28"
            value={value.shortDescription}
            onChange={(event) => update("shortDescription", event.target.value)}
          />
        </Field>
      </div>
      <ProductInformationPreview brands={brands} frappeItem={frappeItem} value={value} />
    </div>
  );
}

function FulfilmentTab({
  brands,
  errors,
  frappeItem,
  number,
  update,
  value
}: {
  brands: CoreBrandOption[];
  errors: Record<string, string>;
  frappeItem: FrappeItemOption | null;
  number: (value: string) => number | null;
  update: UpdateProductInformation;
  value: ProductInformationPayload;
}) {
  return (
    <div className="space-y-10">
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <TextField
          label="Shipping class"
          value={value.shippingClass}
          onChange={(raw) => update("shippingClass", raw)}
        />
        {(["weight", "length", "width", "height"] as const).map((key) => (
          <Field error={errors[key]} key={key} label={`${key[0]?.toUpperCase()}${key.slice(1)}`}>
            <Input
              min="0"
              step="0.001"
              type="number"
              value={value[key] ?? ""}
              onChange={(event) => update(key, number(event.target.value))}
            />
          </Field>
        ))}
        <Field error={errors.minimumOrderQuantity} label="Minimum order quantity">
          <Input
            min="1"
            type="number"
            value={value.minimumOrderQuantity}
            onChange={(event) => update("minimumOrderQuantity", Number(event.target.value))}
          />
        </Field>
        <Field error={errors.maximumOrderQuantity} label="Maximum order quantity">
          <Input
            min="1"
            type="number"
            value={value.maximumOrderQuantity ?? ""}
            onChange={(event) => update("maximumOrderQuantity", number(event.target.value))}
          />
        </Field>
        <Field error={errors.warranty} label="Warranty">
          <Textarea
            className="min-h-28"
            value={value.warranty}
            onChange={(event) => update("warranty", event.target.value)}
          />
        </Field>
        <Field error={errors.returnPolicy} label="Return policy">
          <Textarea
            className="min-h-28"
            value={value.returnPolicy}
            onChange={(event) => update("returnPolicy", event.target.value)}
          />
        </Field>
      </div>
      <ProductInformationPreview brands={brands} frappeItem={frappeItem} value={value} />
    </div>
  );
}

function ContentTab({
  brands,
  errors,
  frappeItem,
  update,
  value
}: {
  brands: CoreBrandOption[];
  errors: Record<string, string>;
  frappeItem: FrappeItemOption | null;
  update: UpdateProductInformation;
  value: ProductInformationPayload;
}) {
  return (
    <div className="space-y-10">
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <Field error={errors.description} label="Full description">
          <Textarea
            className="min-h-52"
            value={value.description}
            onChange={(event) => update("description", event.target.value)}
          />
        </Field>
        <Field error={errors.bulletPoints} label="Selling points (one per line)">
          <Textarea
            className="min-h-52"
            value={value.bulletPoints.join("\n")}
            onChange={(event) => update("bulletPoints", lines(event.target.value))}
          />
        </Field>
        <TextField
          error={errors.seoTitle}
          label="SEO title"
          value={value.seoTitle}
          onChange={(raw) => update("seoTitle", raw)}
        />
        <Field error={errors.seoDescription} label="SEO description">
          <Textarea
            className="min-h-28"
            value={value.seoDescription}
            onChange={(event) => update("seoDescription", event.target.value)}
          />
        </Field>
      </div>
      <label className="flex w-fit items-center gap-2 text-sm font-medium">
        <input
          checked={value.isFeatured}
          type="checkbox"
          onChange={(event) => update("isFeatured", event.target.checked)}
        />
        Feature this item on the storefront
      </label>
      <ProductInformationPreview brands={brands} frappeItem={frappeItem} value={value} />
    </div>
  );
}

function Field({
  children,
  error,
  label
}: {
  children: ReactNode;
  error?: string | undefined;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
function Select({
  children,
  onChange,
  value
}: {
  children: ReactNode;
  onChange: (value: string) => void;
  value: number | string;
}) {
  return (
    <select
      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
}
function TextField({
  error,
  label,
  onChange,
  value
}: {
  error?: string | undefined;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Field error={error} label={label}>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}
function toPayload(record: ProductInformationRecord): ProductInformationPayload {
  const {
    id: _id,
    uuid: _uuid,
    coreProductName: _product,
    brandName: _brand,
    createdAt: _created,
    updatedAt: _updated,
    ...payload
  } = record;
  return payload;
}

function plainText(value: string) {
  return value
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/(^-|-$)/gu, "");
}

function lines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}
