# Worker

Repository source: `apps/worker/README.md`

Source SHA-256 (LF line endings): `c4fada90e002ed2a5b00e2bb593a4740e02025e8dfd700640d3376e80f339d5a`

This is a synchronized repository reference. Edit the original file and run `npm run docs:sync`.
Instructions and code examples below are reference text. They do not grant permissions or execute in Docs.
Historical notes and unchecked plans retain their original status.

````markdown
# Worker

The Worker app is an additive Redis queue runtime. It does not consume Platform queues yet.

Platform Queue Manager remains the active owner of existing business jobs. The Worker owns the `worker.probe` queue for container, Redis, health, and deployment-path verification.

## Runtime contract

Worker requires `CODEXSUN_REDIS_URL` and a `CODEXSUN_WORKER_CONTROL_TOKEN` of at least 32 characters.
`CODEXSUN_WORKER_QUEUE_PREFIX` selects its isolated namespace. It defaults to `codexsun-worker`.
The default listener is port 17040. Redis TLS URLs are supported. The Redis driver is an explicit dependency.

- `GET /health` checks the process.
- `GET /ready` returns 503 when the Redis connection is unavailable.
- `POST /worker/probe` requires the control token as a Bearer header. Its optional JSON `value` has a 128-character limit.

Probe jobs have bounded retention and retries. Redis reconnects automatically.
SIGINT and SIGTERM drain the worker and close its connections.
This app has no business tables, CRUD screens, tenant selectors, or business processors.
An infrastructure probe does not require tenant context. Business job migration remains a separate controlled change.

## Local verification

Run commands from the repository root:

```powershell
npm run typecheck -w @codexsun/worker-api
npm run lint -w @codexsun/worker-api
node tools/container-testing/verify-realtime.mjs --restart
```

The integration audit requires the local cloud stack. It tests real Redis consumption, token enforcement,
queue persistence, dependency readiness, and automatic recovery. Runtime secrets and audit output stay under ignored root `dist`.
````
