import { DefaultCompanyRepository } from "./default-company.repository.js";

export async function seedDefaultCompanyModule() {
  const repository = new DefaultCompanyRepository();
  if (await repository.get()) return;
  const company = await repository.firstActiveCompany();
  const financialYear = await repository.currentActiveFinancialYear();
  if (company && financialYear) {
    await repository.save(
      {
        companyId: company.id,
        financialYearId: financialYear.id,
        landingApp: "application",
        status: "active"
      },
      true
    );
  }
}
