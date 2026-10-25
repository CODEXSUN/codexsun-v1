# Manual installer audit: 25-10-2026

The reviewed installation runs Frappe 16.53.0 and ERPNext 16.52.1.
The user completed the company setup after installation.
This audit refines the manual installer and reviews current logs without replacing the running container.

## Findings and resolutions

| ID | Finding | Resolution |
| --- | --- | --- |
| F01 High | Database utilities used container environment credentials instead of manually configured credentials | SQL, dump, and Redis commands now receive the private configured credentials through stdin |
| F02 High | Private value parsing could corrupt quotes or expand values differently through Compose | Strict literal/JSON parsing and a nonsecret Compose environment file preserve dollars, quotes, and backslashes |
| F03 High | An internal network allowed container health while leaving the host port unpublished | Guided entry-network selection and published-port verification now run before Administrator authentication |
| F04 High | Verification printed installed apps without asserting ERPNext was present | JSON app-list validation requires both Frappe and ERPNext for the selected site |
| F05 Medium | Manual installation depended on repository browser helpers and lacked a guided entry point | Standalone Python, Bash, and PowerShell entry points plus a local browser helper remove repository dependencies |
| F06 Medium | No persistent installation transcript or explicit failure phase existed | Timestamped redacted logs and atomic deployment phases retain progress and distinguish verified state from needs-review |
| F07 Medium | Database dump stderr could fill its pipe and block backup | Temporary output files, bounded commands, and manifest verification replace the pipe arrangement |
| F08 Medium | Shutdown and log defaults were unsuitable for supervised workers | Future deployments use a 150-second grace period and three rotating 10 MiB log files |
| F09 Medium | A late concurrent operation could reserve storage after preflight | Infrastructure and resource guards repeat before initialization. The host lock also interoperates with the repository's local deployment lock |
| F10 Medium | Default prerequisites and Redis allocations were not fully checked | Python, Linux Docker, Compose, MariaDB, Redis, mounts, ports, database indexes, and noeviction checks now fail early |
| F11 Medium | Browser checks assumed an old login button and only an unfinished setup page | Readiness checks and current Desk landmarks cover both the setup wizard and completed launcher |
| F12 Medium | Copying the source folder could also copy local secrets and data | An exact source allowlist builds a ZIP with file checksums and excludes all generated private material |

Fixed means source and focused checks passed.
The running installation was preserved.
The shutdown and log changes take effect on a future reviewed deployment, not on the current container.

## Installation and log review

The first deployment required an existing non-internal entry network in addition to the internal database network.
The source and guided setup now handle that configuration.
No new MariaDB, Redis, or Docker network is required.

The captured log sample contained four Redis DNS error markers and four websocket exit warnings.
These occurred during earlier shared Redis interruptions.
A later worker SIGTERM message corresponded to the recorded restart test.
The processes recovered, and subsequent process, queue, websocket, and login checks passed.

The sample included successful HTTP 200 responses and websocket 101 upgrades.
Isolated 400 responses came from the Socket.IO endpoint.
Client-closed 499 responses appeared during browser checks.
The current valid Socket.IO handshake passes. These individual responses do not establish a persistent service failure.

No HTTP 5xx response appeared in that captured sample.
A separate recent ten-minute check found no DNS, connection-refused, traceback, ERROR, or unexpected-exit markers.
This describes the captured windows, not future uptime.

Customer records and credentials are excluded from this report.
Raw runtime logs, private configuration, browser profiles, and backups remain on the operator's machine.

## Verification evidence

- 37 focused tests cover release selection, configuration, credential transport, isolation guards, locks, backup integrity, and log redaction.
- The simulated fresh workflow checks backup, image build, initialization, health gates, and final verification order.
- Failure simulations cover backup, build, initialization, startup, authentication, cancellation, occupied ports, and late database reservation.
- A source-only ZIP extracts outside the repository. Python entry-point help and the standalone browser helper load there.
- PowerShell and Bash setup wrapper help commands passed on the current Windows host.
- The stable release lookup returned ERPNext v16.52.1 during this audit.
- Read-only Compose validation passed, including the existing entry network and initialization override.
- Fresh-install preflight rejected the current installed resources as expected.
- The refined verifier passed against the running installation: six processes, installed apps, short and long jobs, Socket.IO, cookie login, Company API, and Desk.
- The portable browser script logged in as Administrator and showed the completed ERPNext launcher.
- A new online MariaDB and Redis snapshot completed. SHA-256, gzip content, and the RDB header passed verification.
- Shared MariaDB and Redis container identities and mounts were retained.
- Package contents are checked against an exact allowlist and scanned for the current private credential values.

Private installation logs are under `logs/`.
The current browser proof is `reports/browser-login.png`.
The audit backup pointer is `reports/audit-backup.private.json`.
The portable artifact is generated under the repository's `dist/` directory.

## Manual acceptance on the destination

1. Verify the archive checksum and extract it.
2. Run `setup.py`, `setup.sh`, or `setup.ps1`.
3. Select the existing infrastructure and confirm the resolved v16 release.
4. Wait for the verification success message.
5. Read the Administrator login through `install.py --show-login`.
6. Complete company setup in the local browser.
7. Run `install.py --verify` again.
8. Preserve private settings, deployment metadata, logs, and backups.

The core workflow requires Python and Docker only.
Browser automation is optional and requires Node.js and a browser.
An AI service is not part of either path.

## Boundaries and remaining validation

A fresh installation on a second physical machine was not performed during this audit.
The isolated package and simulated installation checks are not Linux-host or second-machine deployment proof.
The current installation was not rebuilt, replaced, or restarted during this audit.

Online backup verification does not prove a successful restore.
MariaDB and Redis snapshots are taken separately.
A restore drill, future upgrades, TLS, email delivery, scheduled backups, and custom applications need separate procedures.

The source intentionally refuses automatic adoption, destructive cleanup, and partial-site recreation.
An operator must review a partially initialized site before repair or restoration.
This is documented recovery behavior rather than an automatic reset mechanism.

The latest-v16 resolver follows official release pages and excludes other major versions, drafts, and prereleases.
Release lookup and image pulls need internet access.
The resolved image digest is recorded. Future installations can resolve a different stable v16 patch.

## Primary references

The runtime extension uses the official [Frappe production image](https://github.com/frappe/frappe_docker/blob/main/images/production/Containerfile).
The retained-server checks follow the [Frappe v16 prerequisites](https://docs.frappe.io/framework/user/en/installation).
Release discovery uses the official [GitHub releases API](https://docs.github.com/en/rest/releases/releases#list-releases).
The new shutdown and log declarations use the [Docker Compose service contract](https://docs.docker.com/reference/compose-file/services/).
