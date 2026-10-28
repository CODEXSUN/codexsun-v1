import { getTenantDbName, getTenantId, getToken } from "../../../shared/api/tenant-context";
import { requiredClientEnv } from "../../../shared/env/client-env";
import type {
  CompanyCityLookup,
  CompanyCountryLookup,
  CompanyDistrictLookup,
  CompanyIndustryLookup,
  CompanyLookups,
  CompanyNamedLookup,
  CompanyPincodeLookup,
  CompanyRecord,
  CompanySavePayload,
  CompanyStateLookup
} from "./company.types";

const base = requiredClientEnv("VITE_PLATFORM_API_URL");
const platformBase = requiredClientEnv("VITE_PLATFORM_API_URL");
const companyPath = "/core/organisation/companies";
type Envelope<T> = { data: T; success: true } | { error: { message: string }; success: false };

const companyBrandingExtensions = [
  "avif",
  "bmp",
  "gif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp"
];
const companyBrandingMimeTypes = new Set([
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/vnd.microsoft.icon",
  "image/webp",
  "image/x-icon"
]);

export const companyBrandingImageAccept =
  ".svg,.png,.jpg,.jpeg,.webp,.avif,.gif,.ico,.bmp,image/svg+xml,image/png,image/jpeg,image/webp,image/avif,image/gif,image/x-icon,image/bmp";

export const companyBrandingImageDescription = "SVG, PNG, JPEG, WebP, AVIF, GIF, ICO, or BMP";
export const companyBrandingMaxBytes = 5 * 1024 * 1024;

export function isCompanyBrandingImage(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return companyBrandingExtensions.includes(extension) || companyBrandingMimeTypes.has(file.type);
}

async function request<T>(path: string, options: RequestInit = {}) {
  const token = getToken("tenant");
  const database = getTenantDbName();
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(database ? { "x-tenant-db": database } : {}),

      ...(getTenantId() ? { "x-tenant-id": getTenantId()! } : {}),
      ...options.headers
    }
  });
  const body = (await response.json()) as Envelope<T>;
  if (!response.ok || !body.success)
    throw new Error(body.success ? "Core API request failed." : body.error.message);
  return body.data;
}

async function platformRequest<T>(path: string) {
  const token = getToken("tenant");
  const response = await fetch(`${platformBase}${path}`, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const body = (await response.json()) as Envelope<T>;
  if (!response.ok || !body.success)
    throw new Error(body.success ? "Platform API request failed." : body.error.message);
  return body.data;
}

export const listCompanies = (search = "", signal?: AbortSignal) =>
  request<CompanyRecord[]>(
    `${companyPath}?search=${encodeURIComponent(search)}`,
    signal ? { signal } : {}
  );
export const getCompany = (id: number) => request<CompanyRecord>(`${companyPath}/${id}`);
export const createCompany = (payload: CompanySavePayload) =>
  request<CompanyRecord>(companyPath, { body: JSON.stringify(payload), method: "POST" });
export const updateCompany = (id: number, payload: CompanySavePayload) =>
  request<CompanyRecord>(`${companyPath}/${id}`, {
    body: JSON.stringify(payload),
    method: "PUT"
  });
export const activateCompany = (id: number) =>
  request<CompanyRecord>(`${companyPath}/${id}/activate`, { method: "POST" });
export const deactivateCompany = (id: number) =>
  request<CompanyRecord>(`${companyPath}/${id}/deactivate`, { method: "POST" });
export const forceDeleteCompany = (id: number) =>
  request<CompanyRecord>(`${companyPath}/${id}/force`, { method: "DELETE" });

export async function uploadCompanyLogo(
  file: File,
  companyId: number,
  variant: "favicon" | "logo" | "logo-dark"
) {
  if (!isCompanyBrandingImage(file)) {
    throw new Error(`Select a ${companyBrandingImageDescription} file.`);
  }
  if (file.size > companyBrandingMaxBytes) {
    throw new Error("Company branding images must be 5 MB or smaller.");
  }
  const token = getToken("tenant");
  const response = await fetch(`${platformBase}/tenant/media/company-logo`, {
    body: JSON.stringify({ companyId, contentBase64: await fileToBase64(file), variant }),
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    method: "POST"
  });
  const body = (await response.json()) as Envelope<{
    path: string;
    variant: "favicon" | "logo" | "logo-dark";
  }>;
  if (!response.ok || !body.success)
    throw new Error(body.success ? "Company logo upload failed." : body.error.message);
  return body.data;
}

export async function readCompanyLogo(
  companyId: number,
  variant: "favicon" | "logo" | "logo-dark"
) {
  const token = getToken("tenant");
  const response = await fetch(
    `${platformBase}/tenant/media/companies/${companyId}/company-logo/${variant}`,
    {
      credentials: "include",
      headers: {
        Accept: "image/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    }
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Unable to load the stored company logo.");
  return response.blob();
}

export async function listCompanyLookups(): Promise<CompanyLookups> {
  const [industries, addressTypes, bankNames, countries, states, districts, cities, pincodes] =
    await Promise.all([
      platformRequest<CompanyIndustryLookup[]>("/tenant/industries"),
      request<CompanyNamedLookup[]>("/core/common/contacts/address-types"),
      request<CompanyNamedLookup[]>("/core/common/contacts/bank-names"),
      request<CompanyCountryLookup[]>("/core/common/location/countries"),
      request<CompanyStateLookup[]>("/core/common/location/states"),
      request<CompanyDistrictLookup[]>("/core/common/location/districts"),
      request<CompanyCityLookup[]>("/core/common/location/cities"),
      request<CompanyPincodeLookup[]>("/core/common/location/pincodes")
    ]);
  return { industries, addressTypes, bankNames, countries, states, districts, cities, pincodes };
}

export const createAddressTypeLookup = (name: string) =>
  createNamedLookup("/core/common/contacts/address-types", name);
export const createBankNameLookup = (name: string) =>
  createNamedLookup("/core/common/contacts/bank-names", name);
export const createCountryLookup = (name: string) =>
  request<CompanyCountryLookup>("/core/common/location/countries", {
    body: JSON.stringify({ code: lookupCode(name), name, sortOrder: 1000, status: "active" }),
    method: "POST"
  });
export const createStateLookup = (name: string, countryId: number) =>
  request<CompanyStateLookup>("/core/common/location/states", {
    body: JSON.stringify({
      code: lookupCode(name),
      countryId,
      name,
      sortOrder: 1000,
      status: "active"
    }),
    method: "POST"
  });
export const createDistrictLookup = (name: string, stateId: number) =>
  request<CompanyDistrictLookup>("/core/common/location/districts", {
    body: JSON.stringify({ name, sortOrder: 1000, stateId, status: "active" }),
    method: "POST"
  });
export const createCityLookup = (name: string, districtId: number) =>
  request<CompanyCityLookup>("/core/common/location/cities", {
    body: JSON.stringify({ districtId, name, sortOrder: 1000, status: "active" }),
    method: "POST"
  });
export const createPincodeLookup = (postalCode: string, area: string, cityId: number) =>
  request<CompanyPincodeLookup>("/core/common/location/pincodes", {
    body: JSON.stringify({ area, cityId, name: postalCode, sortOrder: 1000, status: "active" }),
    method: "POST"
  });

function createNamedLookup(path: string, name: string) {
  return request<CompanyNamedLookup>(path, {
    body: JSON.stringify({ isActive: true, name, sortOrder: 1000 }),
    method: "POST"
  });
}
function lookupCode(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read the logo file."));
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? (value.split(",").pop() ?? "") : value);
    };
    reader.readAsDataURL(file);
  });
}
