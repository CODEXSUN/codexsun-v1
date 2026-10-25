# Worktree And Version Release Workflow

## Scope And Authority

Use this shared workflow for app development, integration, release candidates, and cloud promotion.
This workflow overrides older checkout-location and release-flow instructions.
It does not change business ownership, permissions, tenancy, or database safety rules.

On this workstation, the shared policy lives in `D:\workspace\codexsun\assist\operations\worktree-release-workflow.md`.
Existing worktrees read that policy when their branch contains older rules.
On another workstation, use the reviewed repository copy.
A policy document does not change instructions already cached by a running chat.
Read the current policy before the next worktree, integration, or release operation.

## Folder Layout

Keep app and release worktrees outside the main repository.

| Folder                                           | Purpose                          | Branch example         |
| ------------------------------------------------ | -------------------------------- | ---------------------- |
| `D:\workspace\codexsun`                          | Main integration checkout        | `main`                 |
| `D:\workspace\codexsun-worktrees\cxmobile`       | CXMobile feature worktree        | `codex/cxmobile`       |
| `D:\workspace\codexsun-worktrees\marketing`      | Marketing feature worktree       | `codex/marketing`      |
| `D:\workspace\codexsun-worktrees\crm`            | CRM feature worktree             | `codex/crm-<task>`     |
| `D:\workspace\codexsun-worktrees\billing`        | Billing feature worktree         | `codex/billing-<task>` |
| `D:\workspace\codexsun-worktrees\release\1-1-67` | Candidate reservation for 1.1.67 | `codex/release/1.1.67` |

Use hyphens in version folder names. Keep numeric package versions and release branch versions dotted.
The listed release folders are empty reservations. App folders become worktrees only after checkout authorization.
Only `1-1-67` remains reserved. The human removed the empty `1-1-69` and `1-1-73` reservations.
Do not populate folders, create branches, pull code, or install dependencies merely because a reservation exists.
Do not reserve or bump intervening versions automatically.
Retire superseded app worktrees only after integration and verified recovery snapshots. Preserve unfinished work before removal.

## App Selection

Ask which app to use when the task does not identify one.
Current separate app worktrees are CXMobile, Marketing, CRM, and Billing.
Honor an explicit request to prepare all four without asking again.
New app chats must verify their assigned directory and branch before any work.
Start fresh checkouts without npm installation unless installation is explicitly authorized.

## Supervisor And App Chat Ownership

Follow the shared [Release Supervisor Role](../agents/release-supervisor.md).
App chats implement and check code only in their assigned worktrees.
They provide an app handoff with changed files, actual checks, remaining work, and migration or shared-contract impact.
The supervisor owns staging, commits, pushes, pulls, merges, version updates, and release checkouts in app branches and main.
App chats do not perform those operations unless the human explicitly reassigns the role.
Only the supervisor updates an app branch from main after preserving its unfinished work.
Coordinate a pause in affected app edits before Git mutations. Other app work can continue independently.
No npm installation or deployment is currently authorized. This policy update does not trigger any Git or release operation.

## App Development To Main

1. Use an authorized app worktree and a task-specific branch from a reviewed main baseline.
2. Reuse a suitable worktree before creating another copy.
3. Keep each app's implementation within its ownership boundary.
4. Run focused checks during daily coding.
5. The app chat provides its handoff. The supervisor reviews the complete change before integration.
6. The supervisor commits the reviewed batch and merges it into `main` through the required review and check gates.
7. The supervisor leaves unfinished work on its app branch.

Protect `main` with review and relevant status checks when repository administration is authorized.
Do not claim those protections exist without checking them.
Never force-push `main`, overwrite another chat's work, or merge unrelated dirty files.
Preserve conflicting untracked files with a verified backup before an authorized pull.
Leave existing stashes untouched unless their restoration is part of the task.

Each worktree is a repository root for its own root dependencies and root build output.
Do not share writable `node_modules` or `dist` directories between worktrees.
Never create dependency or build directories inside app or package folders.
Dependency installation and runtime setup require task authorization.
Separate concurrent test ports, databases, Redis queues, storage, and credentials.

## Main To Release Candidate

1. The supervisor obtains authorization for the target version and candidate preparation.
2. Select an exact reviewed `main` commit after integration checks pass.
3. Populate the reserved version folder as a clean Git worktree only for that candidate.
4. Create its `codex/release/<version>` branch from the selected commit.
5. Use the existing versioning procedure for an authorized lockstep version and changelog update.
6. Record the source commit, checks, migration review, and included app changes.
7. Freeze feature scope while development continues on `main`.

A folder or branch name does not change package versions or prove deployment.
Keep the shared package version unchanged during routine app work unless a version update is explicitly requested.
Fix candidate defects on the candidate branch and return each fix to `main` before closing the release.
Do not merge all newer main work into a frozen candidate.
Candidate fixes require a new build and relevant verification.

## Candidate To Cloud

The target flow is:

**App worktree -> reviewed main -> frozen release candidate -> staging -> approval -> production**

Build the exact candidate once in a controlled build environment.
Record immutable image digests for API, Web, Shop, Worker, and Chatb when included.
Record any excluded service and its compatibility with the release.
Use candidate labels such as `1.1.67-rc.1` without changing lockstep package versions for every test.
Test those images on staging with separate data, queues, storage, secrets, and integration settings.
Use approved snapshots or test fixtures. Prevent staging from consuming production jobs or sending real customer messages.
Verify tenant isolation, authentication, browser flows, restart behavior, migrations, and realtime connections where affected.

Production promotion requires explicit deployment authorization after candidate evidence is ready.
Verify a current backup and exact migration compatibility before production replacement.
Promote the same approved image digests with production configuration. Do not rebuild during promotion.
Verify production health and affected browser flows after promotion.
Keep previous images and release records for application rollback.
Application rollback does not reverse database migrations. Use compatible migrations and a separate reviewed data-recovery procedure.
Preserve MariaDB, Redis, Media, Frappe, Cloudflare, and unrelated services unless their change is explicitly authorized.

Record the version, source commit, image digests, environment reference, backup reference, approval, and verification results.
Keep secrets and private release records outside Git.
With release authorization, retain a durable `v-<version>` tag and release record before deleting the temporary candidate branch.
Do not move published release tags. Tag creation can trigger existing release automation and requires explicit authorization.

## Current Tooling Boundary

This document defines the target workflow. It does not implement deployment automation.
The current VPS `update.sh` pulls source and builds images on the VPS.
It cannot serve as the unchanged-image promotion step without a separately authorized implementation change.
Do not run it as a substitute for candidate promotion.
Keep `.container/codexsun-v1` as the deployment contract. Do not duplicate its scripts for every application version.
Use future `codexsun-v2` only for an approved deployment-contract change.

## Authorization And Verification

Permission to write rules or create empty folders does not authorize code pulls, installations, version bumps, commits, pushes, or deployment.
Honor explicit task authorization without asking for repeated confirmation.
Documentation-only changes need link, consistency, and whitespace checks. Do not run app builds, lint suites, or deployment scripts for them.
Never describe static checks, local tests, staging results, and production acceptance as interchangeable evidence.
