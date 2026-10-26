# Data Bridge: Legacy CXApp preparation

This owner prepares legacy records for review. It does not authorize or execute business imports.
The explicit service runs Core before Masters, then Billing.
The local harness retains read-only source/target transactions and verifies their fingerprints.

The repository delegates stage-table DDL to `legacy-cxapp.migration.ts` and immutable context binding to `legacy-cxapp.seed.ts`.
The synchronization contract reloads saved mappings and rows without duplicating memory snapshots.
It rejects records whose execution authorization is nonzero.
The explicit local worker commits preparation on success and rolls back on failure.
Its completion event contains counts and phase identity, without customer records.
It is not registered as a business-import queue job.

`GET /api/data-bridge/legacy-preparation/capabilities` requires host authorization.
It returns preparation phases and the local-only, execution-denied contract.
It exposes no customer records and supplies no HTTP operation to run preparation or imports.

The lifecycle tests verify phase-order denial, hydration, rollback, access denial, and the absence of an import endpoint.
They use in-memory connection boundaries and do not establish database or live-client acceptance.
See `devkits/data-bridge/api/src/modules/legacy-cxapp/SKILLS.md` for operational constraints.
