import { CompanyRepository } from "./company.repository.js";
export async function seedCompanyModule() {
  const repository = new CompanyRepository();
  if ((await repository.list()).length) return;
  await repository.create({ name: "codexsun" }, true);
}
