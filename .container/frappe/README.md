# Manual Frappe and ERPNext v16 installer

Install the latest stable ERPNext v16 with one persistent `codexsun-frappe` container.
The installer reuses existing MariaDB, Redis, and Docker networks.
It does not provision or replace shared infrastructure.

Python and Docker perform the installation. An AI agent, npm, Node.js, Git, and the CODEXSUN application are not required.
The optional automated browser check requires Node.js 22 or later and installed Chrome or Chromium.

## 1. Prepare the other machine

Install Python 3.11 or later and Docker with Linux-container support.
Use Docker Compose 2.20 or later. Confirm Docker works under your operator account.

Prepare existing MariaDB 11.8 or later and Redis 6 or later containers.
These match the current [Frappe v16 prerequisites](https://docs.frappe.io/framework/user/en/installation).
Both services need persistent data mounts and an existing shared Docker network.
Redis must use `noeviction` and support two reserved, unused logical databases.
Reserve the indexes explicitly. An empty database can still belong to another application.

MariaDB root access must work from the shared network.
The installer needs permission to create one new database and its site user.
Standard container environment credentials can be discovered automatically.
For Docker secrets or custom credentials, the wizard asks for passwords privately.

Allow enough disk space for the official image, its extension, and online backups.
The backup check requires at least 2 GiB and three times the reported database size.
Dump expansion and Docker's separate storage can require more space.
Finish other maintenance before installation. Keep shared services running throughout the installation.

## 2. Copy the portable package

Copy `frappe-installer.zip` and its `.sha256` file to the other machine.
Verify its SHA-256 checksum, then extract it.
Open a terminal inside the extracted `frappe-installer` directory.

Windows:

```powershell
Get-FileHash .\frappe-installer.zip -Algorithm SHA256
Get-Content .\frappe-installer.zip.sha256
Expand-Archive .\frappe-installer.zip -DestinationPath .\frappe-install
Set-Location .\frappe-install\frappe-installer
py -3 package.py --verify .
```

Linux:

```bash
sha256sum -c frappe-installer.zip.sha256
unzip frappe-installer.zip -d frappe-install
cd frappe-install/frappe-installer
python3 package.py --verify .
```

The source allowlist excludes local credentials, deployment records, backups, logs, screenshots, and browser profiles.
Do not copy `frappe.env` or private deployment records from the installed machine.
Create new settings and a new Administrator password on the destination.

When working directly from the repository, the same files live under `.container/frappe`.

## 3. Run guided setup

Windows:

```powershell
py -3 setup.py
```

You can also run `.\setup.ps1` when your PowerShell execution policy permits local scripts.

Linux:

```bash
bash setup.sh
```

The wizard asks you to select the running MariaDB container, Redis container, and shared network.
An internal shared network also requires an existing non-internal entry network for host access.
The wizard lists existing choices. It creates no network.

Enter the site hostname, free loopback port, new database name, and reserved Redis indexes.
Accept a generated Administrator password or enter a password with at least 16 characters.
The wizard creates a private `frappe.env` and refuses to overwrite existing credentials.

The installer retrieves stable v16 releases from GitHub and shows the resolved version.
Confirm its deployment prompt to continue.
The patch version is discovered at installation time. v15 and other major versions are excluded.
The selected upstream image digest is recorded for that installation.

The default hostname is `erp.codexsun.localhost`. The default port is `8088`.
All Frappe services run inside the single container: nginx, Gunicorn, websocket, two workers, and scheduler.

DocType creation can take 30 minutes or longer on slow storage.
Watch its percentage output and timestamped log. Do not interrupt a progressing installation.

## 4. Log in and complete company setup

After installation:

```powershell
py -3 install.py --show-login
```

On Linux, use `python3 install.py --show-login`.
This explicit command displays only the saved Administrator login.
Password display is excluded from installation logs.

Open [the local ERPNext login](http://localhost:8088/login) on the installation machine.
Use your configured port if different.
Sign in as `Administrator` and complete ERPNext's company and accounting setup.

The port binds to loopback. For a remote server, an SSH tunnel provides manual access:

```bash
ssh -L 18088:127.0.0.1:8088 user@your-server
```

Then open `http://localhost:18088` on your computer.
Configure a reviewed HTTPS proxy or tunnel separately for public access.

## Install LogicX Biz

Run this command after the base Frappe and ERPNext installation passes verification:

```powershell
py -3 setup-app.py
```

On Linux, use `python3 setup-app.py` or `bash setup-app.sh`.
The host also needs Git and access to GitHub, PyPI, and the npm registry.
This command installs `logicx_biz` from its CODEXSUN repository.
It uses `main` by default and records the resolved commit.
To select reviewed commits, use:

```bash
python3 setup-app.py --logicx-biz-ref BIZ_COMMIT
```

The script builds a persistent app image before it closes the site for maintenance.
It then stops background workers, backs up the database and files, and copies backups to the host.
It replaces only the Frappe container and retains its site and log volumes.
It installs LogicX Biz, runs migration, and verifies login, workers, sidebars, and the ERPNext API.
MariaDB, Redis, and networks remain in place.

The image applies a compatibility patch when Frappe uses the current module Sidebar API.
It converts LogicX Biz's three curated sidebars.
It also skips obsolete legacy-sidebar cache repairs on that API.
Older supported Frappe builds retain the original hooks and fixtures.
The patch changes app files inside the image. It does not change framework code or upstream repositories.

LogicX Biz workspaces appear in Desk according to user permissions.
For a browser login check, run `node verify-browser.mjs`.

The deployment record contains the app revisions, previous image, and backup path.
Copy the portable source package to another server, install base ERPNext, then run `setup-app.py` there.
Create new private settings on that server. Do not copy existing credentials or deployment records.

A repeated run verifies an installation that already contains LogicX Biz. It does not update app code.
An installation failure preserves data and can leave the site closed for maintenance.
Do not delete volumes or rerun the fresh installer to repair it.
The script supplies no automatic schema rollback or app upgrade procedure.

## Install the optional Frappe suite

After base ERPNext installation, run:

```bash
python3 setup-app.py --with-suite
```

On Windows, use `py -3 setup-app.py --with-suite`.
This installs LogicX first when needed, then adds the following reviewed upstream releases:

| App | Release | Local route |
| --- | --- | --- |
| Frappe HR | 16.52.0 | `/hrms` |
| Raven | 3.0.0 | `/raven` |
| Frappe CRM | 1.89.1 | `/crm` |
| Helpdesk | 1.31.0 | `/helpdesk` |
| Insights | 3.15.1 | `/insights` |
| Telephony | Recorded dependency commit | No separate frontend |

Helpdesk requires Telephony. The installer installs that dependency first.
Use the existing Administrator login for all routes on the configured Frappe port.
Employee records, email accounts, phone providers, and AI integrations need their own business configuration.
Installing the apps does not configure those services.

The suite image retains ERPNext and LogicX Biz.
The script builds and checks Python dependencies before it closes the live site.
It then backs up the database and files, checks backup integrity, installs the apps, and runs migration.
It preserves shared MariaDB, Redis, networks, and persistent site volumes.
It verifies app registration, authenticated pages, frontend assets, and DocType metadata.
Run `node verify-browser.mjs --suite` for browser login and screenshots of all app frontends.

The deployment record stores the suite image, commit revisions, previous apps, backup path, and verification results.
A repeated run verifies a complete installation without upgrading it.
A partial installation stops for review and preserves its backup and volumes.
Do not rerun the fresh installer or delete data to repair a partial installation.

The default refs are in `suite_catalog.py`.
Review compatibility before overriding a ref with `--hrms-ref`, `--raven-ref`, `--crm-ref`, `--helpdesk-ref`, or `--insights-ref`.
Use `--telephony-ref` only when reviewing its dependency update.
The optional `--suite-source` accepts clean local checkouts at those exact refs.

## Commands for operators

Run these inside the installer directory.
Replace `python3` with `py -3` on Windows.

| Command | Purpose |
| --- | --- |
| `python3 setup.py --configure-only` | Write settings without installing |
| `python3 install.py --latest` | Show the currently discovered stable v16 release |
| `python3 install.py --check` | Validate settings and Compose without starting containers |
| `python3 install.py --preflight` | Check a fresh installation without changing services |
| `python3 install.py` | Install after the release confirmation |
| `python3 install.py --yes` | Accept the resolved release without the prompt |
| `python3 install.py --status` | Show Frappe, initializer, MariaDB, and Redis state |
| `python3 install.py --verify` | Check ownership, installed apps, processes, jobs, websocket, login, and Desk |
| `python3 install.py --logs` | Show the last 100 Frappe container log lines |
| `python3 install.py --verify-backup PATH` | Verify an existing snapshot without restoring it |

For fixed, noninteractive infrastructure selection:

```bash
python3 install.py --configure-from-docker \
  --db-container YOUR_MARIADB_CONTAINER \
  --redis-container YOUR_REDIS_CONTAINER \
  --network YOUR_SHARED_NETWORK
python3 install.py --check
python3 install.py
```

Optional configuration flags include `--entry-network`, `--site`, `--port`, `--db-name`, `--cache-db`, and `--queue-db`.
Use the wizard when passwords cannot be discovered from standard container variables.
For a custom Redis ACL user, edit the Redis URLs in `frappe.env` before installation.

Manual settings can start from `frappe.env.sample`.
Use literal single-quoted values or JSON double-quoted strings.
Python reads these values directly and supplies them to Compose without shell or dotenv expansion.
Dollar signs and escaped quotes remain literal. Never source this file in a shell.
Use filesystem permissions or Windows ACLs to restrict the installer directory to trusted operators.

## Logs, backups, and failure handling

`logs/install-*.log` contains timestamped command progress and redacted output.
The deployment record contains its phase, resolved image digest, shared service IDs, backup path, and verification result.
`backups/frappe-preinstall-*/manifest.json` appears only after a completed snapshot.
A directory without a manifest is incomplete.

Snapshots include all MariaDB databases and Redis data.
They are separate online snapshots, not a synchronized transaction across both services.
Checksums, gzip data, and the RDB header are verified. A restore drill remains separate work.
Protect snapshots as production data.

The installer refuses existing Frappe containers, volumes, database names, and occupied Redis indexes.
It never drops a site or removes an existing volume.
It rechecks infrastructure after image building and before creating the site.
A failed operation records `needs-review` when image metadata exists.
The temporary initializer uses a named container and disables its web health check during schema creation.

| Failure point | Manual action |
| --- | --- |
| Docker, version, network, password, or port preflight | Correct the prerequisite or private setting, then repeat preflight |
| GitHub lookup, pull, or build before initialization | Correct connectivity or Docker storage, inspect status, then retry if no Frappe resources exist |
| Initializer is still running after an interrupted terminal | Inspect `docker logs codexsun-frappe-init` and let it finish |
| Initializer exited with partial data | Preserve volumes, database, transcript, and snapshots. Have the database operator review the partial installation |
| Installed container exists but is stopped | Run `docker start codexsun-frappe`, wait for healthy state, then run verification |
| Verification fails after installation | Correct the reported service or saved login setting, then run `--verify`. Do not rerun fresh installation |
| A lock remains after a crash | Check recorded processes, initializer status, and concurrent maintenance before manually removing only the stale lock |

A partial-site repair or restore requires an operator decision. This installer supplies no automatic deletion command.
For a graceful manual restart, use `docker restart --timeout 150 codexsun-frappe`.
An unhealthy container is not proof of lost data.

## Optional automated browser check

Install Node.js 22 or later and Chrome or Chromium.
No npm packages are needed.

```bash
node verify-browser.mjs
```

Set `CODEXSUN_FRAPPE_BROWSER` to another browser executable when needed.
Reports and private browser profiles remain under `reports/`.
The check accepts both the initial setup wizard and the completed Desk launcher.

## Verification and scope

```bash
python3 -B -m unittest discover -s . -p 'test_*.py'
```

Read [AUDIT.md](AUDIT.md) for findings, fixes, evidence, and untested boundaries.
The package tests run outside the repository and simulate failures without touching shared services.

This is a fresh-install workflow. It does not upgrade, adopt, remove, or restore an existing installation.
TLS, email delivery, custom apps, infrastructure provisioning, backup scheduling, and restore procedures remain separate operations.
The Compose shutdown grace period and log rotation apply to future deployments.
The audit did not recreate the already-running container.

To rebuild the portable ZIP from repository source:

```bash
python3 .container/frappe/package.py
```
