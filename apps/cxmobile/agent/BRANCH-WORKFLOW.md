# Cxmobile Worktree Workflow

## Active Checkout

- Worktree: `D:\workspace\codexsun-worktrees\cxmobile`.
- Local branch: `codex/cxmobile`.
- Integration target: reviewed `main`.
- Starting baseline: the published 1.1.67 integration commit.

This path replaces the previous worktree under `C:\Users\sunda\.codex\worktrees`.
Previous worker IDs and workspace leases are historical. Do not resume them automatically.
Read the shared `assist/operations/worktree-release-workflow.md` before worktree or release operations.
Verify the actual working directory and branch before editing.
Keep business changes in the owner app and compose public contracts through Platform.

## Current Authorization

The fresh checkout is code-only. Do not run npm installation, build, servers, Docker, migrations, or deployment during bootstrap.
Do not copy secrets, dependency trees, build output, databases, or browser profiles from another checkout.
Wait for a specific development task after reporting the checkout and branch.
A later explicit request may authorize focused development or dependency setup.

## Integration And Release

Review completed app changes and relevant checks before integration into main.
Freeze a versioned candidate from reviewed main. Test staging before approved cloud promotion.
Keep app source checks, device/provider acceptance, staging results, and production acceptance distinct.
Do not commit, push, tag, or deploy merely because a feature check passes.
