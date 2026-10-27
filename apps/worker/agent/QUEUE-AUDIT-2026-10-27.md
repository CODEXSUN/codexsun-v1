# Platform queue follow-up audit: 2026-10-27

## Source and scope

Worktree: `D:\workspace\codexsun-worktrees\platform`, branch `codex/platform`.
Main commit: `f4b6525ddff2a5324a00c36a49b3cf64cf493d77`, version 1.1.76.
Published baseline: `61584fc0003d7a517d4211ad31fe2f3d49765010`.
Fetching and merging main reported that this branch was already up to date.
This audit changes neither main nor shared Docker services.

The scope covers SQL job ownership, Redis delivery, producer behavior, retries, cancellation,
holds, retention, tenant restoration, owner handlers, Chat notifications, shutdown, and host cutover.
An audit can cover a failure matrix. It cannot prove every possible failure or provider behavior.

## Findings repaired in source

| Finding | Previous behavior | Change |
| --- | --- | --- |
| Redis outage after SQL persistence | Producer commands could wait indefinitely or return an error after a job was saved. | Bound producer commands and connection retries. Return the durable pending job if publication fails. Reconciliation still reports transport failure. |
| Retrying a cancelled job | Its existing terminal Redis delivery could suppress publication of the same attempt generation. | Remove a terminal transport entry before republishing a pending SQL job. Preserve live entries. |
| Releasing delayed work | An existing delayed Redis entry could retain its old wait after SQL made the job available. | Promote the existing delayed entry when authoritative SQL availability has elapsed. |
| Redis errors | Business consumers lacked an error listener. Producer failures could retain an unusable cached connection. | Handle transport errors without logging credentials. Evict failed producers so reconciliation can establish a new connection. |
| Transport retention | Redis completed and failed deliveries were retained indefinitely. | Apply configured completion and failure retention ages. BullMQ removes expired entries lazily when jobs finish. |
| Redis URL interpretation | Business queues discarded the `rediss://` transport and IPv6 brackets were passed as part of the host. | Preserve TLS, decode credentials, normalize IPv6 hosts, and reject unsupported protocols or invalid database numbers. |
| Late owner writes | Completion and failure updates could overwrite an expired operation or a newer attempt. | Guard terminal writes, progress, refunded holds, and automatic retry by status and the claimed attempt count. Do not emit a completion activity for a rejected completion. |
| Disabled tenant Mail | A saved Mail job could execute after Mail was removed from the tenant's enabled modules. | Require current registry activation and the active tenant Mail module before invoking the owner worker. System Mail retains its separate signed-payload contract. |
| Activity-log failure | An administrative operation could return an error after its queue change was saved. | Keep activity recording best effort for retry, cancellation, backend changes, and execution results. |
| Empty-backlog readiness | A dispatcher pass with no pending records did not verify Redis connectivity. | Probe Redis before reconciliation so an empty backlog cannot mask a transport outage. |

## Evidence matrix

| Area | Existing executed evidence | Follow-up acceptance |
| --- | --- | --- |
| Build and contracts | Baseline GitHub Actions passed full checks and build. Platform, Worker, and Chat typechecks passed. | Run focused typechecks and tests for these follow-up changes. |
| Selected executor | Database and BullMQ producer-only checks passed. Wrong executors cannot claim jobs. | Retain default Platform compatibility. Test both host selections in fresh containers. |
| Duplicate jobs | Real Redis delivery and 40 concurrent keyed enqueue requests passed in the isolated fixture. | Repeat after transport changes. Include SQL-equivalent keys. |
| Scheduling and holds | Future availability, stale delivery, preflight holds, refunded attempts, and graceful restarts passed. | Test cancelled delivery retry and release of a delayed entry. |
| Redis outage | Earlier Docker audit recovered 251 unpublished records across pages after Redis restart. | Test the actual enqueue service during an outage, then verify one eventual owner operation. |
| Unresponsive transport | New native TCP fixture accepts connections but never answers Redis commands. | Verify bounded publication failure without Docker. Repeat with container network disruption later. |
| SQL ownership | New SQL fixture executes generated updates against an in-memory engine. It tests older attempts and expired status. | Repeat predicates on fixture MariaDB. The fixture does not certify MariaDB locking or transactions. |
| Tenant safety | Actual tenant artifact ownership and wrong Mail database binding were tested. | Repeat inactive tenant, disabled owner module, wrong database, and tenant deletion cases by owner. |
| Chat | Actual Chatb sockets tested colliding tenant channel UUIDs, Redis publication, HTTP history, and logout revocation. | Repeat after replacing only the isolated application containers. Test membership and permission changes with real tenant records. |
| Owner operations | Extracted handlers remain in their owner packages. | Exercise approved provider sandboxes separately. No live customer or provider calls belong in this audit. |
| Shutdown | Focused tests cover active dispatch and relay drain. | Repeat with an active handler during Worker shutdown and Redis outage. |
| Retention | SQL retention and Redis retention settings were inspected. | Verify Redis expiry and SQL cleanup independently. Retain records that still require owner reconciliation. |

The earlier 22-check Docker result belongs to snapshot
`a66adefc02b511cf750f73c8f9a525d104157b6aea300b3ba01565e0ecbcc95c`.
The earlier 29 real-Redis queue tests, 43 focused tests, and CRM enqueue test cover the published baseline.
Those results do not certify the follow-up source changes.

Follow-up execution passed 33 native tests without skips. The SQL ownership and mocked Redis-readiness fixtures passed three more tests.
The unresponsive TCP peer test rejected publication after approximately 6.4 seconds.
Redis URL configuration, pending-job acceptance, activity failures, redelivery decisions, Mail registry activation, shutdown, scheduling, and holds passed.
No Docker container or external provider was used for these follow-up checks.
The SQL fixture required a local `GREATEST` function. Its first run failed before that fixture adjustment.
An initial outage assertion included synchronous module-loading time. The corrected asynchronous deadline test passed.
Earlier interrupted or superseded runner attempts do not count as passing evidence.
Final Platform and Worker typechecks and lint passed. Docs synchronization, Docs validation, the Platform module boundary check, and whitespace checks passed.

Mail provider and tenant provisioning imports now load when a Mail job needs them. Queue-only tests do not load those owner graphs at startup.

## Remaining behavior limits

- The host selector is a current-process configuration check. It does not fence an older or misconfigured executor.
- Attempt guards protect against older attempts. They do not provide a durable lease token for every refunded-attempt or cross-version overlap.
- A generic job left `running` after a hard crash requires owner reconciliation. Automatic replay could repeat external effects.
- SQL completion can fail after an owner operation succeeds. Each owner needs idempotency or reconciliation before replay.
- A successful enqueue means SQL accepted the job. It does not mean an external operation completed.
- Redis Chat notifications are transient. Persisted HTTP history provides reconnect recovery.
- Backend changes do not constitute an automatic migration of active operations between executors.
- No exactly-once, rolling-overlap, browser/mobile, queued Telegram, or live-provider acceptance is claimed.

These are specific runtime limits, not a requirement to obtain another Git handoff or repeat approval for authorized source work.

## Docker sequence after the other deployment finishes

1. Confirm the other deployment has finished and its local replacement or rollback operation has exited.
2. Capture the current service inventory. Do not treat a changed external staging container as an unchanged baseline.
3. Use the existing isolated Platform fixture, unique image tags, private configuration, databases, storage, and Redis namespace.
4. Build an immutable snapshot of the reviewed Platform branch. Record source and image identities.
5. Back up only the fixture databases before replacing its application containers.
6. Run the follow-up acceptance cases above. Preserve failure receipts as well as passing receipts.
7. Verify final service health, image identity, and unrelated service preservation.

Do not run the shared-stack restart harness for this isolated fixture. Do not restart shared Redis or MariaDB.
