# Worker

Worker provides the diagnostic Redis queue and an opt-in business execution host.

`CODEXSUN_QUEUE_EXECUTION_HOST=platform` preserves the existing execution host by default.
Set `worker` in both services only after the cutover gates below pass.
Worker consumes the existing Queue Manager records through the public
`@codexsun/platform-api/background` composition contract. That contract registers module-owned handlers.
It does not register API routes, migrate databases, or seed tenants.
Platform retains identity, tenant routing, queue administration, producers, and observability.

## Runtime contract

Worker requires `CODEXSUN_REDIS_URL` and a `CODEXSUN_WORKER_CONTROL_TOKEN` of at least 32 characters.
`CODEXSUN_WORKER_QUEUE_PREFIX` selects its isolated namespace. It defaults to `codexsun-worker`.
The default listener is port 17040. Redis TLS URLs are supported. The Redis driver is an explicit dependency.

- `GET /health` checks the process.
- `GET /ready` returns 503 when the Redis connection is unavailable.
- `POST /worker/probe` requires the control token as a Bearer header. Its optional JSON `value` has a 128-character limit.

Probe jobs have bounded retention and retries. Redis reconnects automatically.
SIGINT and SIGTERM drain the worker and close its connections.
Worker owns process execution and scheduling. Business handlers remain in their owner packages.
Business mode requires the Platform database, tenant secret references, authentication secret,
storage configuration, and Redis connectivity. The image includes the public composition dependency closure.
Both services must use the same master identity and business queue configuration.
The diagnostic prefix applies only to `worker.probe`. Business delivery prefixes derive from the master database identity.

## Confirmed architecture and delivery plan

Queue Manager persists jobs and runtime backend selection in the Platform master database.
The `database` backend polls persisted records and conditionally claims each runnable record.
The `bullmq-redis` backend delivers the persisted record ID and UUID through Redis.
Redis delivery is a wake-up mechanism. Persisted job state and identity remain authoritative.

| Producer or owner            | Execution contract                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| CRM and Frappe               | Contact, enquiry and duty outboxes, imports, exports, availability holds and live-sync schedules |
| Mail and credential recovery | Tenant send/sync and system-mail handlers                                                        |
| Billing                      | Sales and export compliance outbox relays and owner handlers                                     |
| Marketing                    | Submission handoff relay and tenant/company authorization                                        |
| Data Bridge                  | Common, mapped and business import handlers                                                      |
| Sites                        | Publication delivery and owner reconciliation                                                    |
| Chat                         | Telegram synchronization and account scheduling                                                  |
| Platform                     | Database maintenance, client-artifact preparation and queue probes                               |

The queues remain `chat`, `crm`, `maintenance`, `mail`, `marketing`, `reports`, and `system`.
No new broker or job schema is introduced. Pending Redis reconciliation scans all pages in ascending ID order.
Manual runs and `dispatchImmediately` cannot execute in the producer-only Platform process.
The execution loop owns immediate hints and drains its active dispatch during shutdown.
Schedulers and owner relays stop before database pools close.

Frappe readiness holds defer delivery without spending an execution attempt.
Database retries use exponential delays. BullMQ retains its existing retry and lock behavior.
Cancellation affects pending or failed records. It does not interrupt an active external side effect.
Billing, Marketing and Sites retain owner-specific interrupted-operation reconciliation.
Generic running jobs do not yet have a safe, durable recovery lease.
Keyed enqueue operations use a pinned connection and a per-master advisory lock.
Their lookup and insert transaction commits before releasing that lock.
This preserves the database's existing idempotency-key collation semantics across concurrent application producers.
It serializes short keyed enqueue transactions. Direct SQL writes do not receive this protection.
No database uniqueness constraint was added. General crash recovery and exactly-once effects remain unproven.

Redis delivery IDs use the persisted job UUID and attempt generation.
Only pending records can publish. A prior live generation blocks another publication during retry or hold recovery.
Existing active, waiting, prioritized, or delayed deliveries remain authoritative until terminal.
The guard performs Redis lookups proportional to the persisted attempt count.
It does not replace durable cross-process fencing. Drain old publishers and consumers before adopting these IDs.
Activity-log failures cannot change a completed business operation into retryable work.
Claims also enforce the persisted availability time, including stale Redis deliveries.

Chatb remains an authenticated WebSocket proxy to the Chat owner in Platform.
Chat owns durable messages, membership and recipient authorization.
Worker sends signed identity-only Redis notifications for persisted Telegram messages.
Platform reloads those records and checks current recipient scope, grants and membership.
Redis notifications are transient. Existing HTTP history remains the reconnect fallback.
Timestamp replay and periodic browser refresh remain compatibility behavior.

1. Verify the isolated master, two tenant fixtures, Redis namespace and disabled outbound providers.
2. Verify owner handlers, database and Redis delivery, holds, retries, cancellation and drain behavior.
3. Drain and stop every legacy executor and relay before selecting Worker in both services.
4. Start the prepared Worker artifact and verify business readiness, then start producer-only Platform.
5. Verify authenticated Chatb reconnection and persisted history after a process or Redis restart.

The host selector prevents current-version Platform execution when Worker is selected.
It does not fence an older process or a process with mismatched configuration.
Rolling overlap is unsupported. Do not change hosts during an active job or permit mixed executors.
No existing database migration, candidate, deployment, or production cutover is authorized by this document.

## Local verification

Run commands from the repository root:

```powershell
npm run typecheck -w @codexsun/worker-api
npm run lint -w @codexsun/worker-api
node tools/container-testing/verify-realtime.mjs --restart
```

The integration audit requires the local cloud stack. It tests real Redis consumption, token enforcement,
queue persistence, dependency readiness, and automatic recovery. Runtime secrets and audit output stay under ignored root `dist`.
