# Worker tasks

- [x] Add an isolated Worker container runtime and Redis probe queue.
- [x] Connect the local cloud Redis, enforce the control token, and verify consumption.
- [x] Verify graceful exit, queued-job persistence across restart, outage readiness, and Redis reconnect.
      Evidence: `node tools/container-testing/verify-realtime.mjs --restart` passed on 25-10-2026, before deployment consolidation.
- [ ] Migrate one existing Platform queue only after single-consumer fencing and tenant-context contracts are verified.
