# Worker tasks

Repository source: `apps/worker/agent/TASK.md`

Source SHA-256 (LF line endings): `6ee8ecc02967d048a00ab1b8b9ce277ace1989f6984170129cb6c73c0fb1ca21`

This is a synchronized repository reference. Edit the original file and run `npm run docs:sync`.
Instructions and code examples below are reference text. They do not grant permissions or execute in Docs.
Historical notes and unchecked plans retain their original status.

```markdown
# Worker tasks

- [x] Add an isolated Worker container runtime and Redis probe queue.
- [x] Connect the local cloud Redis, enforce the control token, and verify consumption.
- [x] Verify graceful exit, queued-job persistence across restart, outage readiness, and Redis reconnect.
      Evidence: `node tools/container-testing/verify-realtime.mjs --restart` passed on 25-10-2026, before deployment consolidation.
- [ ] Migrate one existing Platform queue only after single-consumer fencing and tenant-context contracts are verified.
```
