import { AppError } from "@codexsun/framework/errors";
import { ContactRepository } from "./contact.repository.js";
import type {
  ContactAddress,
  ContactAddressUpdateInput,
  ContactListFilters,
  ContactSaveInput
} from "./contact.types.js";

export class ContactService {
  constructor(private readonly repository = new ContactRepository()) {}

  list(filters: ContactListFilters = {}) {
    return this.repository.list(filters.search ?? "");
  }

  find(id: string) {
    return this.repository.find(id);
  }

  async nextCode() {
    return { code: await this.repository.nextCode() };
  }

  async create(input: ContactSaveInput) {
    const normalized = await this.validateAndEnrich(input);
    await this.ensureUniqueCode(normalized.code ?? "");
    return this.save(() => this.repository.create(normalized));
  }

  async resolveOrCreateCustomer(name: string | null, mobile: string | null) {
    const phone = mobile?.trim() ?? "";
    const customerName = name?.trim() || phone;
    if (!customerName) throw AppError.validation("Customer name or mobile number is required.");
    if (phone && !/^\d{7,15}$/u.test(phone.replace(/\D/g, ""))) {
      throw AppError.validation("Enter a valid mobile number.");
    }
    if (phone) {
      const matches = await this.repository.findByMobile(phone);
      if (matches.length > 1) {
        throw AppError.conflict(
          "More than one Core contact uses this mobile number. Select a customer.",
          { reason: "ambiguous-mobile-match" }
        );
      }
      const match = matches[0];
      if (match) {
        if (match.status !== "active") {
          throw AppError.conflict("This mobile number belongs to an inactive Core contact.");
        }
        return { id: match.id, name: match.name };
      }
    }
    const customerType = await this.repository.findContactTypeByName("Customer");
    if (!customerType) throw AppError.validation("Active Customer contact type is required.");
    const created = await this.create({
      name: customerName,
      typeId: customerType.id,
      ...(phone ? { phones: [{ phone, phoneType: "Mobile", isPrimary: true }] } : {})
    });
    return { id: created.id, name: created.name };
  }

  async resolveExternalContact(
    externalKey: string,
    externalCode: string,
    name: string,
    mobile: string,
    contactType: "Customer" | "Supplier" = "Customer",
    existingContactId?: number
  ) {
    const code = externalCode.trim();
    if (
      !/^[a-f0-9]{64}$/iu.test(externalKey) ||
      !code ||
      code.length > 80 ||
      !name.trim() ||
      !/^\d{10}$/u.test(mobile)
    )
      throw AppError.validation(
        "Frappe customer ID, source identity, name, and a 10-digit mobile are required."
      );
    const legacyCode = `EXT-${externalKey.toUpperCase()}`;
    const existing = existingContactId
      ? await this.repository.lockExternalCustomerById(existingContactId)
      : ((await this.repository.lockExternalCustomer(code)) ??
        (await this.repository.lockExternalCustomer(legacyCode)));
    if (existing) {
      if (existing.status !== "active" || existing.deleted_at)
        throw AppError.conflict(
          "The linked Core customer is inactive or deleted. Restore it before importing."
        );
      if (existing.type_name?.trim().toLowerCase() !== contactType.toLowerCase())
        throw AppError.conflict(
          `The Frappe ${contactType.toLowerCase()} ID is already used by a different contact type.`
        );
      if (existing.code !== code) {
        if (existingContactId && existing.code === normalizeCode(code, name)) {
          await this.repository.attachExternalCustomerPhone(existing.id, mobile);
          return { id: existing.id, uuid: existing.uuid, code: existing.code };
        }
        if (existing.code !== legacyCode)
          throw AppError.conflict(
            "The linked Core contact code does not match this Frappe customer. Resolve the mismatch before importing."
          );
        await this.ensureUniqueCode(code, existing.id);
        await this.repository.updateExternalCustomerCode(existing.id, existing.code, code);
      }
      await this.repository.attachExternalCustomerPhone(existing.id, mobile);
      return { id: existing.id, uuid: existing.uuid, code };
    }
    const type = await this.repository.findContactTypeByName(contactType);
    if (!type) throw AppError.validation(`Active ${contactType} contact type is required.`);
    const created = await this.create({
      code,
      name: name.trim(),
      typeId: type.id,
      phones: [{ phone: mobile, phoneType: "Mobile", isPrimary: true }]
    });
    return { id: created.id, uuid: created.uuid, code: created.code };
  }

  async update(id: string, input: ContactSaveInput) {
    const contact = await this.mutable(id);
    if (
      (/^EXT-[a-f0-9]{64}$/iu.test(contact.code) || isFrappeDocumentCode(contact.code)) &&
      input.code !== undefined &&
      input.code.trim().toUpperCase() !== contact.code.toUpperCase()
    )
      throw AppError.conflict("An externally linked contact code cannot change.");
    const normalized = await this.validateAndEnrich(input);
    await this.ensureUniqueCode(normalized.code ?? "", contact.id);
    return this.save(async () => {
      const updated = await this.repository.update(contact.id, normalized);
      if (!updated) throw AppError.notFound("Contact was not found.");
      return updated;
    });
  }

  async updateAddress(id: string, addressId: string, input: ContactAddressUpdateInput) {
    const contact = await this.mutable(id);
    const current = contact.addresses.find((address) => address.id === Number(addressId));
    if (!current) throw AppError.notFound("Contact address was not found.");
    const definedInput = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined)
    ) as Partial<Omit<ContactAddress, "id" | "sortOrder">>;
    const resolved = await this.resolveAddress({ ...current, ...definedInput, id: current.id });
    const updated = await this.repository.updateAddress(contact.id, {
      ...current,
      ...resolved,
      id: current.id,
      sortOrder: current.sortOrder
    });
    if (!updated) throw AppError.notFound("Contact address was not found.");
    return updated;
  }

  async createAddress(id: string, input: ContactAddressUpdateInput) {
    const contact = await this.mutable(id);
    const definedInput = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined)
    ) as Partial<Omit<ContactAddress, "id" | "sortOrder">>;
    const address = await this.resolveAddress({
      id: 0,
      addressTypeId: null,
      addressTypeName: null,
      addressLine1: "",
      addressLine2: null,
      countryId: null,
      countryName: null,
      stateId: null,
      stateName: null,
      districtId: null,
      districtName: null,
      cityId: null,
      cityName: null,
      pincodeId: null,
      pincodeName: null,
      isDefault: contact.addresses.length === 0,
      sortOrder: Math.max(0, ...contact.addresses.map((item) => item.sortOrder)) + 1,
      ...definedInput
    });
    const created = await this.repository.createAddress(contact.id, address as ContactAddress);
    if (!created) throw AppError.notFound("Contact was not found.");
    return created;
  }

  async setActive(id: string, active: boolean) {
    const contact = await this.mutable(id);
    const updated = await this.repository.setActive(contact.id, active);
    if (!updated) throw AppError.notFound("Contact was not found.");
    return updated;
  }

  async forceDelete(id: string) {
    const contact = await this.mutable(id);
    const deleted = await this.repository.forceDelete(contact.id);
    if (!deleted) throw AppError.notFound("Contact was not found.");
    return deleted;
  }

  private async mutable(id: string) {
    const contact = await this.repository.find(id);
    if (!contact) throw AppError.notFound("Contact was not found.");
    if (contact.name.trim() === "-") {
      throw AppError.forbidden("The default contact is protected and cannot be modified.");
    }
    return contact;
  }

  private async validateAndEnrich(input: ContactSaveInput): Promise<ContactSaveInput> {
    const name = input.name.trim();
    if (!name) throw AppError.validation("Contact name is required.", { field: "name" });
    const type = await this.repository.findContactType(Number(input.typeId));
    if (!type) {
      throw AppError.validation("Select an active contact type.", { field: "typeId" });
    }
    const group = input.groupId
      ? await this.repository.findContactGroup(Number(input.groupId))
      : null;
    if (input.groupId && !group) {
      throw AppError.validation("Selected contact group was not found or is inactive.", {
        field: "groupId"
      });
    }

    const requestedAddresses = input.addresses?.length
      ? input.addresses
      : [await this.repository.defaultAddress()];
    const addresses = await Promise.all(
      requestedAddresses.map((address) => this.resolveAddress(address))
    );
    const bankAccounts = await Promise.all(
      (input.bankAccounts ?? []).map((account) => this.resolveBankAccount(account))
    );

    return {
      ...input,
      code: input.code?.trim() ? normalizeCode(input.code, name) : await this.repository.nextCode(),
      name,
      typeId: type.id,
      typeName: type.name,
      groupId: group?.id ?? null,
      groupName: group?.name ?? null,
      addresses,
      bankAccounts
    };
  }

  private async resolveAddress(
    address: NonNullable<ContactSaveInput["addresses"]>[number]
  ): Promise<NonNullable<ContactSaveInput["addresses"]>[number]> {
    const addressType = address.addressTypeId
      ? await this.repository.findAddressType(Number(address.addressTypeId))
      : null;
    if (address.addressTypeId && !addressType) {
      throw AppError.validation("Selected address type was not found or is inactive.", {
        field: "addresses.addressTypeId"
      });
    }

    const pincode = address.pincodeId
      ? await this.repository.findPincode(Number(address.pincodeId))
      : null;
    if (address.pincodeId && !pincode) {
      throw AppError.validation("Selected pincode was not found or is inactive.", {
        field: "addresses.pincodeId"
      });
    }
    const cityId = address.cityId ?? pincode?.parentId ?? null;
    const city = cityId ? await this.repository.findCity(Number(cityId)) : null;
    if (cityId && !city) {
      throw AppError.validation("Selected city was not found or is inactive.", {
        field: "addresses.cityId"
      });
    }
    assertParent("Pincode", pincode?.parentId, city?.id);

    const districtId = address.districtId ?? city?.parentId ?? null;
    const district = districtId ? await this.repository.findDistrict(Number(districtId)) : null;
    if (districtId && !district) {
      throw AppError.validation("Selected district was not found or is inactive.", {
        field: "addresses.districtId"
      });
    }
    assertParent("City", city?.parentId, district?.id);

    const stateId = address.stateId ?? district?.parentId ?? null;
    const state = stateId ? await this.repository.findState(Number(stateId)) : null;
    if (stateId && !state) {
      throw AppError.validation("Selected state was not found or is inactive.", {
        field: "addresses.stateId"
      });
    }
    assertParent("District", district?.parentId, state?.id);

    const countryId = address.countryId ?? state?.parentId ?? null;
    const country = countryId ? await this.repository.findCountry(Number(countryId)) : null;
    if (countryId && !country) {
      throw AppError.validation("Selected country was not found or is inactive.", {
        field: "addresses.countryId"
      });
    }
    assertParent("State", state?.parentId, country?.id);

    return {
      ...address,
      addressLine1: address.addressLine1.trim(),
      addressTypeId: addressType?.id ?? null,
      addressTypeName: addressType?.name ?? null,
      countryId: country?.id ?? null,
      countryName: country?.name ?? null,
      stateId: state?.id ?? null,
      stateName: state?.name ?? null,
      districtId: district?.id ?? null,
      districtName: district?.name ?? null,
      cityId: city?.id ?? null,
      cityName: city?.name ?? null,
      pincodeId: pincode?.id ?? null,
      pincodeName: pincode?.name ?? null
    };
  }

  private async resolveBankAccount(
    account: NonNullable<ContactSaveInput["bankAccounts"]>[number]
  ): Promise<NonNullable<ContactSaveInput["bankAccounts"]>[number]> {
    const bank = account.bankNameId
      ? await this.repository.findBankName(Number(account.bankNameId))
      : null;
    if (account.bankNameId && !bank) {
      throw AppError.validation("Selected bank name was not found or is inactive.", {
        field: "bankAccounts.bankNameId"
      });
    }
    return {
      ...account,
      bankNameId: bank?.id ?? null,
      bankName: bank?.name ?? null
    };
  }

  private async ensureUniqueCode(code: string, excludingId?: number) {
    if (await this.repository.findByCode(code, excludingId)) {
      throw AppError.conflict("Contact code already exists.", { field: "code" });
    }
  }

  private async save<T>(work: () => Promise<T>) {
    try {
      return await work();
    } catch (error) {
      if (isDuplicate(error)) throw AppError.conflict("Contact code already exists.");
      if (isReferenced(error)) {
        throw AppError.conflict(
          "This contact address is used by an existing billing record and cannot be removed."
        );
      }
      throw error;
    }
  }
}

function assertParent(
  label: string,
  actualParentId: number | null | undefined,
  selectedId?: number
) {
  if (actualParentId && selectedId && actualParentId !== selectedId) {
    throw AppError.validation(`${label} does not belong to the selected parent location.`);
  }
}

function normalizeCode(code: string | undefined, name: string) {
  const value = (code ?? name)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!value) throw AppError.validation("Contact code is required.", { field: "code" });
  return value;
}

function isFrappeDocumentCode(code: string) {
  return /^(?:C\d{2,}|SUPP[-_]?[A-Z0-9]+)$/iu.test(code.trim());
}

function isDuplicate(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ER_DUP_ENTRY"
  );
}

function isReferenced(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ER_ROW_IS_REFERENCED_2"
  );
}
