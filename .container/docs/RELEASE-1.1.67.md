# Release 1.1.67: app integration and worktree reset

Date: 2026-10-25. Baseline: `2e935eb3` (1.1.66).

## Integrated Source

Marketing and CXMobile branches both started at `55e8035b` and contained uncommitted changes.
Their scoped tracked patches and new files were integrated into main. Their old branch tips alone did not contain this work.
Private recovery snapshots preserve every old worktree's HEAD, tracked patch, untracked files, and checksum inventory.
The recovery directory is outside the repository. Existing stashes remain unchanged.

- Marketing: integrate Content, Email Campaign, Conversation, social webhook handling, frontend workspaces, and Platform navigation.
- CXMobile: integrate native session and HTTP transport changes, lazy owner workspaces, secure Android transfer handling, and fixture source.
- Repair integration blockers: Marketing form/show component contracts, native request optional fields and status codes, and fixture payload types.
- Remove the incomplete Project Manager DevKit, host adapter, app catalog entry, Super Admin pages, migration/seed composition, dev server, build dependencies, docs, and dedicated tooling.
- Keep old database tables and migration records. Source removal does not authorize data deletion or a live database operation.
- Preserve unintegrated Project Manager drafts and an unrelated Sys Work draft outside the active repository.
- Move old Android caches and build directories outside source. Fresh source checkouts do not include generated output.
- Record the shared app-worktree and version-candidate workflow. Ask which app to use when the user has not identified one.
- Archive 27 old CODEXSUN chats. Keep the coordinating chat and chats for other projects.
- Add missing source-contract references for integrated Marketing modules and three existing Ecommerce modules.
- Synchronize registered workspace manifests, internal ranges, lockfile metadata, Windows manifests, and deployment sample to 1.1.67.

## Database Impact

Database update: Yes. Integrated Marketing modules contain new migrations.
Project Manager lifecycle hooks are removed. No migration, seed, reset, restore, or database deletion is run in this task.
Staging migration review and the exact production compatibility approval remain required before any future deployment.

## Verification

Use the captured logs under root `dist/integration-1.1.67` for the final checks.
The check set includes all five affected TypeScript projects, CXMobile unit contracts, Marketing navigation,
development startup contracts, module boundaries, dependency layout, version alignment, and Docs source coverage.
- Five affected TypeScript projects passed: Marketing API/Web, CXMobile, and Platform API/Web.
- CXMobile unit contracts: 118 passed.
- Marketing navigation contracts: two passed.
- Application retirement contracts: two passed, including legacy-row compatibility and rejection of new retired-app writes.
- Development startup contracts: 11 passed.
- Affected module boundaries, dependency layout, version alignment, and Docs source coverage passed.
- No npm dependency installation is performed.
Provider, device, positive Docker fixture, and production browser acceptance remain separate work.
The integrated development baseline does not declare all Marketing or CXMobile delivery gates complete.

## Fresh Checkout Plan

After the reviewed main commit is pushed, retire all superseded linked worktrees and their old local branches.
Keep only main on GitHub. Create new local branches and code-only checkouts at:

- `D:\workspace\codexsun-worktrees\cxmobile`: `codex/cxmobile`.
- `D:\workspace\codexsun-worktrees\marketing`: `codex/marketing`.
- `D:\workspace\codexsun-worktrees\crm`: `codex/crm`.
- `D:\workspace\codexsun-worktrees\billing`: `codex/billing`.

Create one fresh task chat per app. Verify each task's directory and branch before work.
Do not install npm dependencies, copy secrets, start servers, modify Docker services, or deploy.
Release folders `1-1-67`, `1-1-69`, and `1-1-73` remain empty reservations.
