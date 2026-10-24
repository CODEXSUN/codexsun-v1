import { AsyncLocalStorage } from "node:async_hooks";
import { AppError } from "@codexsun/framework/errors";
import type { Kysely } from "kysely";

// Ecommerce queries run against the tenant database selected by Platform.
export type EcommerceDatabase = Record<string, never>;

type EcommerceRequestScope = {
  database: Kysely<EcommerceDatabase>;
  databaseName: string | undefined;
  frappeEnabled: boolean;
  tenantKey: string;
  publicStorageRoot?: string;
};

const requestScope = new AsyncLocalStorage<EcommerceRequestScope>();

export function runWithEcommerceRequestScope<T>(
  database: Kysely<EcommerceDatabase>,
  tenantKey: string,
  task: () => T,
  databaseName?: string,
  frappeEnabled = false,
  publicStorageRoot?: string
): T {
  if (!/^[a-zA-Z0-9_-]+$/u.test(tenantKey)) {
    throw AppError.validation("Invalid ecommerce tenant scope.");
  }
  return requestScope.run(
    {
      database,
      databaseName,
      frappeEnabled,
      tenantKey,
      ...(publicStorageRoot ? { publicStorageRoot } : {})
    },
    task
  );
}

export function enterEcommerceRequestScope(database: Kysely<EcommerceDatabase>, tenantKey: string) {
  if (!/^[a-zA-Z0-9_-]+$/u.test(tenantKey)) {
    throw AppError.validation("Invalid ecommerce tenant scope.");
  }
  requestScope.enterWith({ database, databaseName: undefined, frappeEnabled: false, tenantKey });
}

export function getEcommerceDatabase(): Kysely<EcommerceDatabase> {
  const scope = requestScope.getStore();
  if (!scope) throw AppError.forbidden("Ecommerce tenant context is required.");
  return scope.database;
}

export function getEcommercePublicStorageRoot() {
  const root = requestScope.getStore()?.publicStorageRoot;
  if (!root) throw AppError.forbidden("Ecommerce tenant storage context is required.");
  return root;
}

export function findEcommercePublicStorageRoot() {
  return requestScope.getStore()?.publicStorageRoot;
}

export function getEcommerceTenantKey(): string {
  const scope = requestScope.getStore();
  if (!scope) throw AppError.forbidden("Ecommerce tenant context is required.");
  return scope.tenantKey;
}

export function getEcommerceFrappeEnabled(): boolean {
  const scope = requestScope.getStore();
  if (!scope) throw AppError.forbidden("Ecommerce tenant context is required.");
  return scope.frappeEnabled;
}

export function getEcommerceTenantDatabaseName(): string {
  const databaseName = requestScope.getStore()?.databaseName;
  if (!databaseName) throw AppError.forbidden("Ecommerce tenant database name is required.");
  return databaseName;
}
