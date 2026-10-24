import { ArrowUpRight, ImageIcon, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import type {
  CoreBrandOption,
  FrappeItemOption,
  ProductInformationPayload
} from "./product-information.types";
import "./product-information.preview.css";

type PreviewProps = {
  brand: string;
  category: string;
  description: string;
  featured: boolean;
  image: string;
  price: string;
  title: string;
};

export function ProductInformationPreview({
  brands,
  frappeItem,
  value
}: {
  brands: CoreBrandOption[];
  frappeItem: FrappeItemOption | null;
  value: ProductInformationPayload;
}) {
  const preview: PreviewProps = {
    brand: brands.find((candidate) => candidate.id === value.brandId)?.name || value.manufacturer,
    category: value.subtitle,
    description: value.shortDescription,
    featured: value.isFeatured,
    image: usableImage(frappeItem?.image),
    price:
      !frappeItem?.standardRate || frappeItem.standardRate <= 0
        ? ""
        : `₹${frappeItem.standardRate.toLocaleString("en-IN")}`,
    title: value.storefrontTitle
  };

  return (
    <section
      className="space-y-4 border-t border-border pt-8"
      style={{ marginTop: "48px" }}
      aria-label="Storefront previews"
    >
      <h3 className="text-sm font-medium text-foreground">Storefront previews</h3>
      <div className="grid items-start gap-8 md:grid-cols-2 xl:grid-cols-3">
        <PreviewFrame label="Featured product">
          <FeaturedPreview {...preview} />
        </PreviewFrame>
        <PreviewFrame label="Current promotion">
          <PromotionPreview {...preview} />
        </PreviewFrame>
        <PreviewFrame label="Complete collection">
          <CollectionPreview {...preview} />
        </PreviewFrame>
      </div>
    </section>
  );
}

function PreviewFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="min-w-0 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function FeaturedPreview(props: PreviewProps) {
  return (
    <article
      className="cx-item-preview-card cx-item-preview-card--featured overflow-hidden bg-slate-950 text-white"
      tabIndex={0}
    >
      <ProductImage {...props} className="aspect-square bg-slate-100" />
      <div className="space-y-3 p-5">
        <p className="text-xs font-medium text-white/70">
          {[props.brand, "Featured system"].filter(Boolean).join(" · ")}
        </p>
        {props.title ? (
          <h4 className="text-xl font-semibold leading-tight">{props.title}</h4>
        ) : null}
        {props.description ? (
          <p className="line-clamp-2 text-sm leading-6 text-white/75">{props.description}</p>
        ) : null}
        <span className="flex items-center gap-2 pt-1 text-sm font-medium">
          Explore this product <ArrowUpRight className="size-4" />
        </span>
      </div>
    </article>
  );
}

function PromotionPreview(props: PreviewProps) {
  return (
    <article
      className="cx-item-preview-card cx-item-preview-card--promotion overflow-hidden border border-border bg-card"
      tabIndex={0}
    >
      <ProductImage {...props} className="aspect-square bg-muted/45" />
      <div className="space-y-3 p-4">
        {[props.brand, props.category].filter(Boolean).length ? (
          <p className="text-xs text-muted-foreground">
            {[props.brand, props.category].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {props.title ? (
          <h4 className="text-base font-semibold leading-snug">{props.title}</h4>
        ) : null}
        {props.price ? <strong className="block text-base">{props.price}</strong> : null}
        <span className="flex items-center gap-2 border-t border-border pt-3 text-sm font-medium">
          {props.price ? "View offer" : "Enquire"} <ArrowUpRight className="size-4" />
        </span>
      </div>
    </article>
  );
}

function CollectionPreview(props: PreviewProps) {
  return (
    <article className="cx-item-preview-card cx-item-preview-card--collection bg-card" tabIndex={0}>
      <ProductImage {...props} className="aspect-square bg-muted/45" showFeatured />
      <div className="space-y-2 p-4">
        {[props.brand, props.category].filter(Boolean).length ? (
          <p className="text-sm text-muted-foreground">
            {[props.brand, props.category].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {props.title ? <h4 className="text-base font-medium leading-snug">{props.title}</h4> : null}
        {props.description ? (
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
            {props.description}
          </p>
        ) : null}
        {props.price ? <strong className="block pb-2 text-base">{props.price}</strong> : null}
        <span className="flex items-center gap-2 border-t border-border py-3 text-sm text-foreground/80">
          <MessageCircle className="size-4" /> Enquire
        </span>
      </div>
    </article>
  );
}

function ProductImage({
  className,
  featured,
  image,
  showFeatured,
  title
}: PreviewProps & { className: string; showFeatured?: boolean }) {
  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      {image ? (
        <img
          className="cx-item-preview-card__image size-full object-cover"
          src={image}
          alt={title}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <ImageIcon className="size-10" strokeWidth={1.4} />
          <span className="text-sm">Product image preview</span>
        </div>
      )}
      {showFeatured && featured ? (
        <span className="absolute left-3 top-3 bg-slate-950 px-2 py-1.5 text-xs font-medium text-white">
          Featured
        </span>
      ) : null}
    </div>
  );
}

function usableImage(value: string | undefined) {
  return value && /^(data:|https?:\/\/)/u.test(value) ? value : "";
}
