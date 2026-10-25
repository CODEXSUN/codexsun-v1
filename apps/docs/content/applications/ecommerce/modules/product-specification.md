# Product Specification

Ecommerce owns the product-specification module and its public contracts.

## Source Contracts

- `apps/ecommerce/api/src/modules/product-specification`.
- `apps/ecommerce/web/src/modules/product-specification`.

Read the module types and validation before changing fields or request payloads.
Keep persistence, route validation, service behavior, and workspace state within the owner module.
Platform supplies authenticated request context and composes the public application contracts.
Do not import sibling module internals or use browser input as trusted tenant context.

## Verification

Use focused module checks for changes. Source integration does not prove provider access or production acceptance.
