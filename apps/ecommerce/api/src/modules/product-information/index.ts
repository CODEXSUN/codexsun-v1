export { productInformationModule } from "./product-information.module.js";
export {
  productInformationDetailsMigration,
  productInformationMigration,
  productInformationRevisionMigration,
  migrateProductInformationModule,
  upgradeProductInformationDetails,
  upgradeProductInformationRevision
} from "./product-information.migration.js";
export { seedProductInformationModule } from "./product-information.seed.js";
export type {
  CoreBrandOption,
  CoreProductOption,
  ProductInformationFilters,
  ProductInformationPage,
  ProductInformationRecord,
  ProductInformationSaveInput,
  ProductInformationUpdateInput,
  PublicationStatus
} from "./product-information.types.js";
