# Chatb tasks

- [x] Add a separate WebSocket gateway container with health checks.
- [x] Connect the local Platform API and route existing browser WebSocket paths through Chatb.
- [x] Verify browser and native authentication, two-client message delivery, MariaDB persistence, and cross-tenant denial.
- [x] Verify rejection of anonymous, cross-origin, and revoked sessions, plus restart recovery.
      Evidence: three transport tests and the connected local realtime audit passed on 25-10-2026.
- [ ] Move realtime fan-out to Redis only after the existing Chat authorization contract has a tested public handoff.
