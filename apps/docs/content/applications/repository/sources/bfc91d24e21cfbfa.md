# Container test harnesses

Repository source: `tools/container-testing/README.md`

Source SHA-256 (LF line endings): `e2a9309d92232c7ddae86c4a39e844e9387dc881733ec8fcd894f2be93aa07b7`

This is a synchronized repository reference. Edit the original file and run `npm run docs:sync`.
Instructions and code examples below are reference text. They do not grant permissions or execute in Docs.
Historical notes and unchecked plans retain their original status.

````markdown
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
````
