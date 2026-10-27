# Worker tasks

- [x] Add an isolated Worker container runtime and Redis probe queue.
- [x] Connect the local cloud Redis, enforce the control token, and verify consumption.
- [x] Verify graceful exit, queued-job persistence across restart, outage readiness, and Redis reconnect.
      Evidence: `node tools/container-testing/verify-realtime.mjs --restart` passed on 25-10-2026, before deployment consolidation.
- [ ] Migrate one existing Platform queue only after single-consumer fencing and tenant-context contracts are verified.
- [x] Add opt-in headless composition and explicit current-version execution ownership.
- [x] Keep default Platform compatibility and module-owned handlers.
- [ ] Verify complete business runtime on isolated MariaDB and Redis, including crash recovery and Chatb reconnect.
- [x] Complete independent source review and fix actionable findings in this local phase.
      Evidence and remaining acceptance gates: [Platform handoff](PLATFORM-HANDOFF.md).

## Follow-up audit: 2026-10-27

- [x] Refresh from main and preserve the published Platform queue change.
- [x] Review outage, redelivery, attempt ownership, Mail activation, readiness, retention, and observability paths.
- [x] Add native TCP, SQL-predicate, configuration, and service regression fixtures.
- [x] Execute 36 native follow-up tests and record exact results in [the audit](QUEUE-AUDIT-2026-10-27.md).
- [ ] After the separate deployment finishes, build and test the isolated Platform Docker fixture again.
