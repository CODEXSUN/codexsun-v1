# Testing Strategy

## Testing Goals

Testing should protect tenant isolation, business correctness, module boundaries, offline sync, accounting integrity, and compliance flows.

For a small change, run at most one focused check when it adds value. Inspection can suffice for a trivial edit.
Choose further checks based on the affected behavior and risk. Do not run the full suite after each prompt.
Run full verification for a requested audit or release. Report checks that were not run when they matter.

## Test Levels

### Unit Tests

Use for:

- Domain rules.
- Calculations.
- Value objects.
- Utility behavior.
- Permission helpers.

Unit tests should use Vitest.

### Integration Tests

Use for:

- API flows.
- Database behavior.
- Module contracts.
- Queue jobs.
- Event handlers.
- External integration adapters with mocks.

API tests should use Vitest with Fastify inject where possible.

### Component Tests

Use for:

- Shared UI components.
- Important forms.
- Important tables.
- Interactive states.
- Loading, empty, error, and permission states.

Frontend component tests should use Vitest with Testing Library.

### End-To-End Tests

Use for:

- Critical user workflows.
- Billing.
- POS.
- Accounting entries.
- Offline sync.
- Tenant activation.
- Subscription changes.

E2E tests should use Playwright.

### Regression Tests

Use when fixing bugs in:

- Tenant isolation.
- Permissions.
- Financial calculations.
- Sync conflicts.
- Compliance document generation.
- Module activation.

## Required Test Concerns

High-risk work should test:

- Correct tenant data access.
- Permission denied behavior.
- Happy path behavior.
- Failure and retry behavior.
- Audit trail creation.
- Event publication.
- Queue job behavior.
- Offline conflict behavior where relevant.

## Accounting Tests

Accounting-related changes should verify:

- Balanced vouchers.
- Correct ledger posting.
- Correct financial year behavior.
- GST treatment.
- Reversal and cancellation handling.
- Report output consistency.

## AI Tests

AI-related changes should verify:

- Tool permission boundaries.
- Tenant isolation.
- Prompt safety for business data.
- Confirmation before actions.
- Audit logging.
