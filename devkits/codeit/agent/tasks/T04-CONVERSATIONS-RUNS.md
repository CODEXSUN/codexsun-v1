# T04: Conversations and run lifecycle

Status: done. Verified by independent reviewer (a864163f-6503-45cc-885e-8b304baa4323). Prerequisites: T02, T03. Owner: run worker.

## Scope

Implement persistent conversations, messages, run state, versioned plans, event streams, budgets, and steering.
Connect the provider through its public contract.
Implement the single-supervisor/single-worker state path before parallel scheduling.
Keep UI services and hooks concrete to their owning leaf.

## Allowed paths

Lease API conversation/run leaves and conversation/run frontend services, hooks, schemas, and types.
T01 owns conversation UI until its handoff is accepted.
Use explicit file leases to avoid overlap. The integrator wires frontend exports and host registration.

## Acceptance

- Valid run transitions are enforced transactionally. Invalid transitions return structured errors.
- Requests, messages, and events deduplicate using stable request keys.
- Browser reconnect replays from a cursor without repeated side effects.
- Reload and runtime restart preserve finalized messages, plans, and interrupted-run state.
- Pause, cancel, retry, and resume retain correct provenance and budget rules.

## Verification and handoff

Run state-machine unit tests, storage/stream integration, and real UI read-only chat checks after integration.
Cover E04/E06/E07/E15/E16 and relevant E20/E22 cases.
Return state/event contracts, storage evidence after restart, failure handling, and templates/HANDOFF.md.
Do not mark success from provider text or a worker summary.
