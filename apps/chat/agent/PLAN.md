# Chat plan

## Marketing integration planning — 2026-10-23

Status: design only. No runtime capability or provider access is added.
See [Marketing Phase 0](../../marketing/agent/PLAN.md#phase-0-decisions-and-contract-review), gap G06, delivery phase 5.

Chat retains internal messages, current Telegram account-session credentials, dialogs, polling, and their permissions.
The reviewed Telegram integration uses phone/code/password sessions. It is not a ready Bot API connector.
Chat must own a separately reviewed bot adapter, credentials, destinations, webhook, send/status contract, and provider receipts.
Marketing owns publishing intent and campaign-linked inbox projections. Do not duplicate Chat message storage or raw account dialogs.
Do not expose existing personal account sessions to Marketing automation or create a second bot webhook consumer.

## Scope

Tenant channels, direct and group messaging, attachments, realtime delivery, and the optional Telegram integration.

## Ownership contract

Check channel membership and live permissions before record access or delivery. Keep Telegram credentials server-side and preserve tenant-scoped audit and message ownership.

The root Agent Guide and governance rules remain authoritative.
Keep one root dependency installation, lockfile, and generated output tree.
Keep business roles inside their owner and compose other components through public contracts.

## Current source surfaces

- `api/src/modules`: `chat`.
- `web/src/modules`: `chat`.

Source presence is not release evidence. Confirm executable behavior before describing a capability as complete.

## Delivery sequence

1. Read [TASK.md](TASK.md), [SKILLS.md](SKILLS.md), and the affected public entry points.
2. Inventory the current Chat implementation and its consumers.
3. Define the requested change and acceptance criteria within the scope above.
4. Resolve stored-data and public-contract compatibility before changing behavior.
5. Implement the change in its owner and update legitimate composition points.
6. Verify the owner, denied-access paths where relevant, and dependent applications.
7. Record evidence and remaining work in [TASK.md](TASK.md).

## Verification gates

For a small change, use at most one focused check when useful. Inspection can suffice for a trivial edit.
The commands below are options for full verification. Add checks when the actual risk requires them.

- `node tools/check-module-boundaries.mjs chat`
- `npm run typecheck -w @codexsun/chat-api`
- `npm run lint -w @codexsun/chat-api`
- `npm run build -w @codexsun/chat-api`
- `npm run typecheck -w @codexsun/chat-web`
- `npm run lint -w @codexsun/chat-web`
- `npm run build -w @codexsun/chat-web`

Use component and root checks when the change or full verification requires them.
Run database, browser, native, and deployment checks when the changed behavior needs them.
Do not mark an untested phase or planned feature complete.

## Realtime isolation phase - 2026-10-26

Preserve Chatb proxying and Chat ownership. Scope realtime fan-out by tenant, database, and company.
Recheck live permissions and channel membership before delivery. Reject typing from removed members.
Keep message persistence and existing HTTP polling inside Chat.
Do not introduce Redis fan-out until multi-process delivery and a tested public authorization handoff require it.

The event callback contract now carries authenticated context and returns a promise.
All publishers must upgrade together. No stored-data migration is required.
Focused tests cover colliding channel identities, revoked access, denied typing, and unsubscribe races.
These tests use injected membership checks. Real database, authenticated browser, and deployment proof remain separate gates.

## External Telegram execution composition

The API can disable Telegram execution while retaining its settings and producer routes.
The Worker host starts the exported module-owned executor and scheduler.
Persisted-message notifications return through the injected external subscription contract.
The host owns transport validation, tenant resolution, persisted-message reload, and subscription shutdown.
Keep only one execution host enabled during the cutover. Drain old processors before starting the new host.
