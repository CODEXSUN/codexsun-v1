# Hostinger connection status

This tool checks the pinned SSH host identity, Docker, Compose, and `/home/codexsun` checkout presence.
Run `npm run hostinger:status` only when a read-only VPS check is requested.
It does not clone, synchronize, or deploy source. Root `setup.sh` and `update.sh` own deployment through `.container/codexsun-v1`.

Create a local SSH alias named `codexsun-hostinger` before using this package:

```sshconfig
Host codexsun-hostinger
    HostName 69.62.81.166
    User root
    Port 22
    IdentityFile <private-key-path>
    IdentitiesOnly yes
    StrictHostKeyChecking yes
    UserKnownHostsFile <known-hosts-path>
```

The current workstation already has this alias. Its private key and known-hosts
file remain under the protected DevKit storage directory. To use another alias,
set `CODEXSUN_DEPLOY_SSH_ALIAS` to its name. The alias must still resolve to the
pinned VPS.

## Component documentation

Read-only pinned-host SSH, Docker, Compose, and deployment-checkout status.

Keep private credentials outside source. Verify the pinned host. This tool has no source mutation or deployment operation. Do not contact a host merely to update documentation.

- [TASK.md](agent/TASK.md): work items and acceptance evidence.
- [PLAN.md](agent/PLAN.md): scope, ownership, delivery order, and verification gates.
- [SKILLS.md](agent/SKILLS.md): component working rules and safety constraints.

### Source inventory

- `src/`.

This inventory records source presence. It does not certify a deployed feature.

### Workspace verification

Run these commands from the repository root. Use the root installation and `dist` output tree.

- `node --check tools/hostinger-deploy/src/cli.mjs`
- `npm run check:versions`

Run `npm run check:component-docs` to verify the required documentation files.
Run the relevant app tests and root release gates when implementation changes.
Report database, browser, native, and deployment checks separately.

### Workspace packages

- `.`: `@codexsun/hostinger-deploy`.

### Declared internal dependencies

This owner declares no internal workspace dependency in its package manifests.

### Public package entry points

- CLI `codexsun-hostinger`: `./src/cli.mjs` in `@codexsun/hostinger-deploy`.
