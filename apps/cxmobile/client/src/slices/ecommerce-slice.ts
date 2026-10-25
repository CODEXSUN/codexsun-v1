import type { NativeHttpTransport } from "../native/http.js";
import type { EcommerceDraftInput, M2StepResult } from "./types.js";

export interface EcommerceSliceResult {
  draftId: number;
  imageUrl: string;
  publicationStatus: string;
  storefrontTitle: string;
}

export async function executeStep5EcommerceDraft(
  transport: NativeHttpTransport,
  input: EcommerceDraftInput = {
    coreProductId: 1,
    image: {
      contentBase64:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      fileName: "draft-sample.png"
    },
    storefrontTitle: "Solar Inverter 5kW Hybrid"
  }
): Promise<M2StepResult<EcommerceSliceResult>> {
  const startTime = Date.now();

  // 1. Upload Product Image Draft
  const imageUploadPayload = {
    contentBase64:
      input.image?.contentBase64 ??
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    fileName: input.image?.fileName ?? "product-draft-photo.png"
  };

  const uploadRes = await transport.post<{ imageUrl: string; sizeBytes?: number }>(
    "/api/platform/ecommerce/catalog/images/upload",
    imageUploadPayload
  );

  const imageUrl = uploadRes.imageUrl ?? "/media/ecommerce/draft-sample.png";

  // 2. Save Item Draft with publicationStatus = "draft"
  const draftPayload = {
    brandId: null,
    bulletPoints: ["Hybrid Grid Support", "High Efficiency MPPT", "WiFi Monitoring"],
    coreProductId: input.coreProductId ?? 1,
    countryOfOrigin: "IN",
    description: "Mobile draft entry for solar inverter catalogue item.",
    isFeatured: false,
    manufacturer: "Codexsun Renewables",
    material: "Aluminum Enclosure",
    maximumOrderQuantity: 50,
    minimumOrderQuantity: 1,
    publicationStatus: "draft", // Strictly unpublished state
    returnPolicy: "14 days replacement",
    seoDescription: "High efficiency 5kW hybrid solar inverter.",
    seoTitle: `${input.storefrontTitle} - Specifications`,
    shippingClass: "heavy",
    shortDescription: "5kW Hybrid Solar Inverter with MPPT",
    slug: `draft-${Date.now().toString().slice(-6)}-inverter`,
    storefrontTitle: input.storefrontTitle,
    subtitle: "5kW Hybrid Solar Inverter",
    warranty: "5 Years Manufacturer Warranty",
    weight: 18.5
  };

  const createdDraft = await transport.post<{
    id: number;
    publicationStatus: string;
    storefrontTitle: string;
  }>("/api/platform/ecommerce/catalog/product-information", draftPayload);

  const draftId = createdDraft.id;
  if (!draftId) {
    throw new Error("Step 5 failed: Created product draft missing ID.");
  }

  // 3. Reload Item Draft & Assert Unpublished Status
  const reloaded = await transport.get<{
    id: number;
    publicationStatus: string;
    storefrontTitle?: string;
  }>(`/api/platform/ecommerce/catalog/product-information/${draftId}`);

  if (reloaded.publicationStatus !== "draft") {
    throw new Error(
      `Step 5 failed: Expected reloaded product status to be 'draft', got '${reloaded.publicationStatus}'.`
    );
  }

  const durationMs = Date.now() - startTime;
  return {
    data: {
      draftId,
      imageUrl,
      publicationStatus: reloaded.publicationStatus,
      storefrontTitle: reloaded.storefrontTitle ?? input.storefrontTitle
    },
    durationMs,
    message: `Ecommerce draft #${draftId} ('${input.storefrontTitle}') saved with image, reloaded in 'draft' (unpublished) state.`,
    step: 5,
    stepName: "Ecommerce Draft & Image Lifecycle",
    success: true
  };
}
