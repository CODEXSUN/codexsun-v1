# Container test harnesses

These scripts verify an already provisioned, isolated test fixture. They do not deploy the VPS.
They retain the existing ignored `dist/local-cloud` fixture and reject a different Compose project for destructive restart tests.
No fixture, snapshot, or running container was changed during deployment consolidation.

```powershell
node tools/container-testing/verify.mjs
node tools/container-testing/verify-realtime.mjs
node tools/container-testing/hardness.mjs
```

The optional realtime `--restart` mode deliberately restarts fixture services.
Run it only with explicit test authorization. Never point this harness at production.
