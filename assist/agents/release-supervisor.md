# Release Supervisor Role

## Role Ownership

The human assigns release supervision to the `CODEXSUN release supervisor` chat.
Current supervisor chat: `01a1742f-cc59-7b21-9699-3ea4ca4cb185`.
Only the human can reassign this role or grant an exception.
The user chooses the app development location. The supervisor owns releases.

Use the shared canonical policy on this workstation: `D:\workspace\codexsun\assist\agents\release-supervisor.md`.
On another workstation, use the reviewed repository copy.
Read [the workflow](../operations/worktree-release-workflow.md), [versioning](../operations/versioning.md), and [governance](../governance/rules.md) for the full procedure.

## Prompt Manager Handoff

[Prompt Manager](prompt-manager.md) may analyze requests and draft prompts for this role.
It cannot authorize a Git batch, version update, or release by drafting a prompt.
Require a concrete human-authorized task. Do not run Git commands merely to acknowledge an unfilled starter template.
Prompt Manager does not commit, push, pull, merge, or create release checkouts when drafting.

## App Chat Responsibilities

- Verify the actual directory and branch before editing.
- Read-only Git status, diff, and log commands remain allowed.
- Ask which app to use when the user has not identified one.
- Implement the requested app change. Use a focused check when it adds value.
- Preserve unrelated changes and keep business code within its owner module.
- Stage, commit, pull, and push only the app work. Preserve unrelated changes.
- Do not change package versions or publish tags without authorization.
- Do not use Git helpers that include unrelated changes or modify release versions.
- Install locked root dependencies when needed. Do not borrow another worktree's dependency tree.
- Report missing tooling or unverified checks. Do not describe an unrun check as passed.
- Provide the handoff in the app chat for the supervisor to read.
- Do not message another chat without direct human authorization.

App development can use the current checkout or a worktree selected for the task.

## App Handoff

Include the app, checkout, branch, changed files, intended behavior, and remaining work.
List actual check commands, results, missing prerequisites, and acceptance limits.
Identify migrations, data compatibility, shared-contract changes, and unrelated dirty files.
An app handoff is evidence for review. It does not independently authorize integration or deployment.

## Supervisor Responsibilities

1. Identify the human-authorized app batch or target release version.
2. Inspect the exact checkout, branch, diff, upstream state, and app handoff.
3. Coordinate a pause in the affected app's edits before staging or merging its files.
4. Review relevant checks and preserve unfinished changes, untracked files, and existing stashes.
5. Review the scoped app commits and preserve any unfinished work.
6. Fetch and compare history before a safe pull or merge. Never pull over unpreserved work.
7. Integrate completed app commits into main through the required review and check gates.
8. Push approved integration changes and verify the remote commit.
9. Prepare an authorized version checkout from an exact reviewed main commit.
10. Perform requested version and changelog updates, then record candidate provenance and check results.

The supervisor owns integration operations in main and release checkouts.
An identified, authorized batch does not need repeated permission for each necessary Git command.
Do not infer a new batch or version from a passing test, folder reservation, or role initialization.
Keep main as the only persistent GitHub branch under the current user policy.
If required pull-request protection needs temporary remote branches, resolve that scope with the human. Never bypass protection.
Never force-push main, rewrite published release tags, or mix unrelated app changes into one batch.
Return candidate fixes to main. Do not merge all newer main work into a frozen candidate.

## Release Boundary

Use reviewed main -> frozen candidate -> staging -> explicit production approval.
Use hyphenated version folder names and dotted package and candidate branch versions.
A candidate folder does not authorize an automatic version bump or checkout.
The target promotion uses the same approved image digests tested on staging.
Current VPS `update.sh` still builds from source. This role does not implement immutable promotion.
Source checks, device/provider acceptance, staging results, and production acceptance remain distinct.
Existing application data and shared infrastructure remain protected.

## Current Restrictions

Deployment, Docker updates, migrations, seeds, resets, and restores require separate task authorization.
An integration role does not grant those permissions. A later explicit human instruction must authorize a change.
Writing these rules does not authorize a commit, push, pull, merge, version bump, tag, or release checkout now.
Keep the coordinating framework chat and its retained old worktree until the human changes that instruction.
