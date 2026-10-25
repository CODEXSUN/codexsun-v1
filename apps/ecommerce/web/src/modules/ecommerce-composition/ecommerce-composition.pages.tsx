import { toast } from "sonner";
import { StorefrontOrganisationWorkspace } from "../storefront-organisation";
import { CatalogOverviewWorkspace } from "../catalog-overview";
import { CatalogDataSourceWorkspace } from "../catalog-data-source";
import { ProductInformationWorkspace } from "../product-information";
import { ProductAttributeWorkspace } from "../product-attribute";
import { ProductSpecificationWorkspace } from "../product-specification";
import { ProductCollectionWorkspace } from "../product-collection";
import { ProductVariantWorkspace } from "../product-variant";
import { ProductImageWorkspace } from "../product-image";
import { StorefrontProfileWorkspace } from "../storefront-profile";
import { StorefrontSliderWorkspace } from "../storefront-slider";
import { PromotionCardWorkspace } from "../promotion-card";
import { FeaturedCardWorkspace } from "../featured-card";
import { SeasonStripWorkspace } from "../season-strip";

export type EcommerceModulePage =
  | "ecommerce.campaign-events"
  | "ecommerce.organisation"
  | "ecommerce.catalog"
  | "ecommerce.product-information"
  | "ecommerce.product-attributes"
  | "ecommerce.product-specifications"
  | "ecommerce.product-collections"
  | "ecommerce.product-variants"
  | "ecommerce.product-images"
  | "ecommerce.catalog-data-source"
  | "ecommerce.storefront"
  | "ecommerce.storefront-sliders"
  | "ecommerce.promotions"
  | "ecommerce.featured-cards"
  | "ecommerce.season-strips"
  | "ecommerce.service-banner"
  | "ecommerce.trusted-strip";

export const ecommerceModulePages: readonly EcommerceModulePage[] = [
  "ecommerce.campaign-events",
  "ecommerce.organisation",
  "ecommerce.catalog",
  "ecommerce.product-information",
  "ecommerce.product-attributes",
  "ecommerce.product-specifications",
  "ecommerce.product-collections",
  "ecommerce.product-variants",
  "ecommerce.product-images",
  "ecommerce.catalog-data-source",
  "ecommerce.storefront",
  "ecommerce.storefront-sliders",
  "ecommerce.promotions",
  "ecommerce.featured-cards",
  "ecommerce.season-strips",
  "ecommerce.service-banner",
  "ecommerce.trusted-strip"
];

export function EcommerceModuleWorkspace({
  onOpenStore,
  page
}: {
  onOpenStore: () => void;
  page: EcommerceModulePage;
}) {
  switch (page) {
    case "ecommerce.campaign-events":
      return <PromotionCardWorkspace mode="campaigns" />;
    case "ecommerce.organisation":
      return <StorefrontOrganisationWorkspace />;
    case "ecommerce.catalog":
      return <CatalogOverviewWorkspace onOpenStore={onOpenStore} />;
    case "ecommerce.product-information":
      return <ProductInformationWorkspace onOpenAi={copyAiDraft} />;
    case "ecommerce.product-attributes":
      return <ProductAttributeWorkspace />;
    case "ecommerce.product-specifications":
      return <ProductSpecificationWorkspace />;
    case "ecommerce.product-collections":
      return <ProductCollectionWorkspace />;
    case "ecommerce.product-variants":
      return <ProductVariantWorkspace />;
    case "ecommerce.product-images":
      return <ProductImageWorkspace />;
    case "ecommerce.catalog-data-source":
      return <CatalogDataSourceWorkspace />;
    case "ecommerce.storefront":
      return <StorefrontProfileWorkspace />;
    case "ecommerce.storefront-sliders":
      return <StorefrontSliderWorkspace />;
    case "ecommerce.promotions":
      return <PromotionCardWorkspace />;
    case "ecommerce.featured-cards":
      return <FeaturedCardWorkspace />;
    case "ecommerce.season-strips":
      return <SeasonStripWorkspace />;
    case "ecommerce.service-banner":
      return <StorefrontProfileWorkspace mode="service-banner" />;
    case "ecommerce.trusted-strip":
      return <StorefrontProfileWorkspace mode="trusted-strip" />;
  }
}

async function copyAiDraft(draft: string) {
  await navigator.clipboard.writeText(draft);
  toast.success("AI draft copied. Paste it into your assistant.");
}
