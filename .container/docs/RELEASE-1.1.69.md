# Release 1.1.69: Prompt Manager boundaries

Date: 2026-10-25, Asia/Calcutta. Baseline: `90cadfca3b2c07cca852ee0f0f2bde206b554a96` (1.1.68).

## Reviewed Policy Batch

- Add `assist/agents/prompt-manager.md` for request analysis, owner selection, scoped drafting, explicit dispatch, and handoff limits.
- Prompt Manager drafts prompts. Drafting does not authorize execution or messages to other chats.
- Sending requires a direct human instruction for the selected prompt and destination.
- Recipients acknowledge starter templates without implementation, checks, or operational actions.
- Concrete dispatched tasks remain subject to the human's stated scope and the receiving chat's owner boundaries.
- Preserve supervisor ownership of Git integration, commits, publication, version updates, and worktree synchronization.
- Add role links in `AGENTS.md`, the Agent Guide, governance, versioning, release workflow, supervisor role, and deployment rules.
- Consolidate identical app and deploy `AGENTS.md` edits in main. No app business changes were pending.
- Update 67 registered package manifests, internal dependency ranges, lockfile metadata, Windows manifests, and deployment sample to 1.1.69.

## Database Impact

Database update: No. This batch changes policy documents, generated Docs references, and version metadata.
No database, tenant-data, infrastructure, provider, or runtime operation ran.
Earlier Marketing migrations still require their staging and deployment compatibility review.

## Preservation And Synchronization

Review main, four app branches, deploy, and the retained Platform checkout before mutation.
The five app/deploy entry-point edits match main byte for byte before formatting.
Save 13 pending files across main and five branch worktrees to private recovery storage.
Verify SHA-256 copies and retain original HEADs, status, patches, stash object identities, and a verified baseline Git bundle.
The recovery location is `D:\workspace\codexsun-worktrees\recovery\prompt-manager-1.1.69`.

Platform initially had detached HEAD `2e935eb319fa2512f8eec55d00c91a6155383e44` and seven pending policy files.
Its six tracked-file diffs were read. They contain existing canonical rules or newer replacements, not unique implementation.
The checkout disappeared externally before its new snapshot could complete and is no longer registered with Git.
This supervisor did not remove, archive, prune, or recreate that checkout.
The verified 1.1.68 recovery snapshot retains its earlier policy files and original HEAD.
The latest Platform `AGENTS.md` addition duplicates the reviewed Prompt Manager section on main.
Report Platform as unavailable and unsynchronized. Do not claim that all initially inventoried checkouts were updated.

After publication, verify each remaining worktree still matches its snapshot before clearing a duplicate policy edit.
Fast-forward `codex/cxmobile`, `codex/marketing`, `codex/crm`, `codex/billing`, and `codex/deploy` to the published main commit.
Keep existing stashes untouched. Preserve the empty 1.1.67 release reservation.
Write final branch HEADs, versions, clean states, snapshot hashes, and remote SHA to the private completion receipt.

## Verification

Baseline `npm run check:versions` passed for 1.1.68.
Final checks passed:

- `npm run check:versions`: 1.1.69 aligned.
- Metadata audit: 67 registered manifests and 380 permitted version-field changes. No other version JSON values changed.
- Lockfile workspace versions and internal dependency ranges aligned without installation.
- Policy link check: 20 local targets exist.
- New changelog entry formatting passed. Historical changelog entries remain unchanged.
- `npm run docs:sync` and `npm run docs:check`: 380 originals and 766 pages across 29 app groups.
- Source formatting and `git diff --check` passed.
- Snapshot verification: 13 current pending files and seven previous Platform files, with the original detached HEAD reference.

Use policy-link, source-formatting, whitespace, version, metadata, and generated Docs checks with existing tools.
Preserve historical changelog entries. Keep generated reference chunks in the exact Docs-generator format.
No broad app build, test, runtime, Docker, or deployment suite is appropriate for this policy-only batch.

## Limits

Main has no branch protection or effective branch rules at review. No protection was configured or bypassed.
Keep main as the only persistent remote branch. No release tag or GitHub release is published.
No installation, dependency copying, server startup, migration, seed, reset, restore, candidate checkout, or deployment occurred.
Browser, device, provider, staging, and production acceptance remain separate work.
The VPS source-building updater still does not implement unchanged-image promotion.
