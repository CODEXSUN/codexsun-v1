import { AppError } from "@codexsun/framework/errors";
import { requestFrappe, type FrappeSettings } from "../connection/index.js";

type MobileContact = { name: string; mobile_number: string };
type CustomerAssociation = { name: string; mobile_contact: string; customer: string };

export async function resolveEnquiryMobile(
  settings: FrappeSettings,
  number: string,
  customer: string | null,
  options: { mobileOnly?: boolean } = {}
) {
  const mobile = number.trim().replace(/[\s()-]/gu, "");
  if (!/^\d{10}$/u.test(mobile))
    throw AppError.validation("Add a valid 10-digit mobile before exporting this enquiry.");
  let contact = await findMobile(settings, mobile);
  if (!contact) {
    try {
      await requestFrappe(
        "/api/resource/Mobile%20Contact",
        "POST",
        settings,
        { mobile_number: mobile },
        { allowExport: true }
      );
    } catch (error) {
      // Creation may have committed before a timeout or a competing request completed.
      contact = await findMobile(settings, mobile);
      if (!contact) throw error;
    }
    contact ??= await findMobile(settings, mobile);
    if (!contact) throw AppError.conflict("The new Frappe Mobile Contact could not be confirmed.");
  }
  if (options.mobileOnly) return { mobile: contact.name };
  const filters: string[][] = [["mobile_contact", "=", contact.name]];
  if (customer) filters.push(["customer", "=", customer]);
  const query = new URLSearchParams({
    fields: JSON.stringify(["name", "mobile_contact", "customer"]),
    filters: JSON.stringify(filters),
    limit_page_length: "2"
  });
  const response = await requestFrappe<{ data?: CustomerAssociation[] }>(
    `/api/resource/Mobile%20Contact%20Customer?${query}`,
    "GET",
    settings
  );
  const matches = response.data;
  if (!Array.isArray(matches))
    throw AppError.validation("Frappe returned an invalid Mobile Contact Customer list.");
  if (
    matches.length !== 1 ||
    !matches[0]?.name ||
    !matches[0].customer ||
    matches[0].mobile_contact !== contact.name ||
    (customer && matches[0].customer !== customer)
  )
    throw AppError.conflict(
      "The Mobile Contact exists, but its Customer association is missing or ambiguous. Link the correct Customer in Frappe before retrying this enquiry."
    );
  return {
    mobile: contact.name,
    mobile_customer: matches[0].name,
    customer: matches[0].customer
  };
}

async function findMobile(settings: FrappeSettings, mobile: string) {
  const query = new URLSearchParams({
    fields: JSON.stringify(["name", "mobile_number"]),
    filters: JSON.stringify([["mobile_number", "=", mobile]]),
    limit_page_length: "2"
  });
  const response = await requestFrappe<{ data?: MobileContact[] }>(
    `/api/resource/Mobile%20Contact?${query}`,
    "GET",
    settings
  );
  if (!Array.isArray(response.data))
    throw AppError.validation("Frappe returned an invalid Mobile Contact list.");
  if (
    response.data.length > 1 ||
    response.data.some((item) => !item.name || item.mobile_number !== mobile)
  )
    throw AppError.conflict(
      "Frappe Mobile Contact identity is ambiguous or does not match the number."
    );
  return response.data[0] ?? null;
}
