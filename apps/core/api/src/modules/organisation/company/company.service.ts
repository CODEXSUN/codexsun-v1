import { AppError } from "@codexsun/framework/errors";
import { runWithCoreDatabase } from "../../../database/core-database.js";
import { CompanyRepository } from "./company.repository.js";
import type {
  CompanyAddress,
  CompanyBankAccount,
  CompanyIndustryNameResolver,
  CompanySaveInput
} from "./company.types.js";

export class CompanyService {
  constructor(
    private readonly repository = new CompanyRepository(),
    private readonly industryNameResolver?: CompanyIndustryNameResolver
  ) {}
  list(search = "") {
    return this.repository.list(search);
  }
  find(id: string) {
    return this.repository.find(id);
  }
  async create(input: CompanySaveInput) {
    return this.repository.create(await this.resolveReferences(input));
  }
  async update(id: string, input: CompanySaveInput) {
    return this.repository.update(id, await this.resolveReferences(input));
  }
  setActive(id: string, active: boolean) {
    return this.repository.setActive(id, active);
  }
  async forceDelete(id: string) {
    if (await this.repository.isDefaultCompany(id))
      throw AppError.conflict("This company is selected as the Default Company.");
    return this.repository.forceDelete(id);
  }
  private async resolveReferences(input: CompanySaveInput): Promise<CompanySaveInput> {
    const industryName = await this.resolveIndustryName(input.industryId);
    const addresses = input.addresses
      ? await Promise.all(input.addresses.map((address) => this.resolveAddress(address)))
      : undefined;
    const bankAccounts = input.bankAccounts
      ? await Promise.all(input.bankAccounts.map((account) => this.resolveBankAccount(account)))
      : undefined;
    return {
      ...input,
      ...(industryName !== undefined ? { industryName } : {}),
      ...(addresses ? { addresses } : {}),
      ...(bankAccounts ? { bankAccounts } : {})
    };
  }
  private async resolveIndustryName(industryId: number | null | undefined) {
    if (industryId === undefined) return undefined;
    if (industryId === null) return null;
    if (!this.industryNameResolver)
      throw AppError.internal("Platform Industry lookup is not configured for Core.");
    const name = await this.industryNameResolver(industryId);
    if (!name) throw AppError.validation("Selected industry was not found or is inactive.");
    return name;
  }
  private async resolveAddress(address: CompanyAddress): Promise<CompanyAddress> {
    const addressType = address.addressTypeId
      ? await this.repository.findAddressType(address.addressTypeId)
      : null;
    if (address.addressTypeId && !addressType)
      throw AppError.validation("Selected address type was not found or is inactive.");
    const pincode = address.pincodeId ? await this.repository.findPincode(address.pincodeId) : null;
    if (address.pincodeId && !pincode)
      throw AppError.validation("Selected postal code was not found or is inactive.");
    const cityId = address.cityId ?? pincode?.parentId ?? null;
    const city = cityId ? await this.repository.findCity(cityId) : null;
    if (cityId && !city) throw AppError.validation("Selected city was not found or is inactive.");
    assertParent("Postal code", pincode?.parentId, city?.id);
    const districtId = address.districtId ?? city?.parentId ?? null;
    const district = districtId ? await this.repository.findDistrict(districtId) : null;
    if (districtId && !district)
      throw AppError.validation("Selected district was not found or is inactive.");
    assertParent("City", city?.parentId, district?.id);
    const stateId = address.stateId ?? district?.parentId ?? null;
    const state = stateId ? await this.repository.findState(stateId) : null;
    if (stateId && !state)
      throw AppError.validation("Selected state was not found or is inactive.");
    assertParent("District", district?.parentId, state?.id);
    const countryId = address.countryId ?? state?.parentId ?? null;
    const country = countryId ? await this.repository.findCountry(countryId) : null;
    if (countryId && !country)
      throw AppError.validation("Selected country was not found or is inactive.");
    assertParent("State", state?.parentId, country?.id);
    return {
      ...address,
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
  private async resolveBankAccount(account: CompanyBankAccount): Promise<CompanyBankAccount> {
    const bank = account.bankNameId ? await this.repository.findBankName(account.bankNameId) : null;
    if (account.bankNameId && !bank)
      throw AppError.validation("Selected bank name was not found or is inactive.");
    return { ...account, bankNameId: bank?.id ?? null, bankName: bank?.name ?? null };
  }
}

export function getCompanyForDatabase(databaseName: string, companyId: number) {
  return runWithCoreDatabase(databaseName, () => new CompanyService().find(String(companyId)));
}
export function updateCompanyBrandingForDatabase(
  databaseName: string,
  companyId: number,
  paths: { logoPath?: string; logoDarkPath?: string; faviconPath?: string }
) {
  return runWithCoreDatabase(databaseName, async () => {
    const service = new CompanyService();
    const company = await service.find(String(companyId));
    if (!company) throw AppError.notFound("Target company was not found for branding transfer.");
    return service.update(String(companyId), { name: company.name, ...paths });
  });
}
function assertParent(
  label: string,
  actualParentId: number | null | undefined,
  selectedId?: number
) {
  if (actualParentId && selectedId && actualParentId !== selectedId)
    throw AppError.validation(`${label} does not belong to the selected parent location.`);
}
