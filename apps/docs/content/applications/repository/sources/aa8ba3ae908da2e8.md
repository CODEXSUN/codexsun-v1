# Core plan

Repository source: `apps/core/agent/PLAN.md`

Source SHA-256 (LF line endings): `c8535fbfa52402f30943a1170b4930c7f3083eb69c71411b9c1eb38366623287`

This is a synchronized repository reference. Edit the original file and run `npm run docs:sync`.
Instructions and code examples below are reference text. They do not grant permissions or execute in Docs.
Historical notes and unchecked plans retain their original status.

```markdown
# Core plan

## Marketing integration planning — 2026-10-23

Status: design only. No runtime capability or provider access is added.
See [Marketing Phase 0](../../marketing/agent/PLAN.md#phase-0-decisions-and-contract-review), gap G02, delivery phase 1.

Core remains the owner of contact, company, and product identity. Marketing Brand is a communication identity, not a duplicate Core product Brand.
Existing public resolvers do not establish a complete Marketing identity contract.
Add a fixed UUID-based, purpose-scoped lookup and deliberate match/resolve contract with minimal fields and duplicate review.
Preserve shared-phone rules and Frappe external identity. Do not infer consent from identity or reuse a Frappe key for a Marketing submission.

## Scope

Shared tenant masters, contact and product identity, organization records, and geographic relationships.

## Ownership contract

A concrete leaf owns its schema, repository, validation, routes, seeds, and UI. Other apps use public lookup contracts rather than private Core implementations.

The root Agent Guide and governance rules remain authoritative.
Keep one root dependency installation, lockfile, and generated output tree.
Keep business roles inside their owner and compose other components through public contracts.

## Current source surfaces

- `api/src/modules`: `common`, `common/accounts/ledger-groups`, `common/accounts/ledgers`, `common/contacts/address-types`, `common/contacts/bank-names`, `common/contacts/contact-groups`, `common/contacts/contact-types`, `common/location`, `common/location/city`, `common/location/country`, `common/location/district`, `common/location/pincode`, `common/location/state`, `common/others/currencies`, `common/others/months`, `common/others/payment-terms`, `common/others/priorities`, `common/others/sales-types`, `common/products/brands`, `common/products/colours`, `common/products/hsn-codes`, `common/products/product-categories`, `common/products/product-groups`, `common/products/product-types`, `common/products/sizes`, `common/products/styles`, `common/products/taxes`, `common/products/units`, `common/workorder/destinations`, `common/workorder/stock-rejection-types`, `common/workorder/transports`, `common/workorder/warehouses`, `common/workorder/work-order-types`, `master`, `master/contact`, `master/product`, `master/work-order`, `organisation`, `organisation/company`, `organisation/default-company`, `organisation/financial-year`.
- `web/src/modules`: `common/accounts/ledger-groups`, `common/accounts/ledgers`, `common/contacts/address-types`, `common/contacts/bank-names`, `common/contacts/contact-groups`, `common/contacts/contact-types`, `common/location/city`, `common/location/country`, `common/location/district`, `common/location/pincode`, `common/location/state`, `common/others/currencies`, `common/others/months`, `common/others/payment-terms`, `common/others/priorities`, `common/others/sales-types`, `common/products/brands`, `common/products/colours`, `common/products/hsn-codes`, `common/products/product-categories`, `common/products/product-groups`, `common/products/product-types`, `common/products/sizes`, `common/products/styles`, `common/products/taxes`, `common/products/units`, `common/workorder/destinations`, `common/workorder/stock-rejection-types`, `common/workorder/transports`, `common/workorder/warehouses`, `common/workorder/work-order-types`, `master/contact`, `master/product`, `master/work-order`, `organisation/company`, `organisation/default-company`, `organisation/financial-year`.

Source presence is not release evidence. Confirm executable behavior before describing a capability as complete.

## Delivery sequence

1. Read [TASK.md](TASK.md), [SKILLS.md](SKILLS.md), and the affected public entry points.
2. Inventory the current Core implementation and its consumers.
3. Define the requested change and acceptance criteria within the scope above.
4. Resolve stored-data and public-contract compatibility before changing behavior.
5. Implement the change in its owner and update legitimate composition points.
6. Verify the owner, denied-access paths where relevant, and dependent applications.
7. Record evidence and remaining work in [TASK.md](TASK.md).

## Verification gates

For a small change, use at most one focused check when useful. Inspection can suffice for a trivial edit.
The commands below are options for full verification. Add checks when the actual risk requires them.

- `node tools/check-module-boundaries.mjs core`
- `npm run typecheck -w @codexsun/core-api`
- `npm run lint -w @codexsun/core-api`
- `npm run build -w @codexsun/core-api`
- `npm run typecheck -w @codexsun/core-web`
- `npm run lint -w @codexsun/core-web`
- `npm run build -w @codexsun/core-web`

Use component and root checks when the change or full verification requires them.
Run database, browser, native, and deployment checks when the changed behavior needs them.
Do not mark an untested phase or planned feature complete.

## Local email policy continuation, 23-10-2026

The public `contactIdsForEmailPolicy` lookup returns every matching recipient identity ID, including inactive/deleted identities.
It reads only Core-owned email fields. CRM consumes these IDs to check restrictions without merging contacts.
Platform selects the trusted tenant database before calling the contract. No new public HTTP search or write permission is added.

See Marketing TASK for the current scope and local verification. No campaign delivery or deployment is enabled.
```
