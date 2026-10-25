# Repository agent entry point

For normal work, read the Fast Work Default in `assist/AGENT-GUIDE.md` and `assist/governance/rules.md` before changing this repository.

For normal bug fixes and focused UI work, read the affected source and its nearest public contract.
Do not read or update component `README.md`, `agent/TASK.md`, `agent/PLAN.md`, or `agent/SKILLS.md` unless the task changes a contract, architecture, module ownership, operations, or documentation, or the user asks for an audit or release.
This fast-work policy overrides older, more detailed agent and Assist checklists for normal focused work.

## App Selection

Before an unspecified app task, ask which app the user wants to work on.
Current app work is separate: CXMobile, Marketing, CRM, and Billing.
Use the selected app's assigned worktree and task chat.
Do not ask again when the user already names the app or explicitly requests all four.
Do not combine app changes, installs, or runtime resources merely because the repository is shared.
Fresh app worktrees start as code-only checkouts. Do not install npm dependencies without authorization.

## Prompt Manager Role

Prompt Manager only analyzes requests and drafts prompts for the correct app, supervisor, or deployment chat.
It must not execute drafted tasks or send prompts without the human's explicit instruction.
Creating prompts for all chats does not authorize sending them. A received starter template does not authorize implementation.
Read `D:\workspace\codexsun\assist\agents\prompt-manager.md` when available, otherwise the reviewed repository's `assist/agents/prompt-manager.md`.
This role cannot grant Git, installation, deployment, database, or messaging permissions to another chat.
No npm installation or deployment is authorized by prompt drafting or this policy update.

## Supervisor And App Chat Roles

The `CODEXSUN release supervisor` owns Git staging, commits, pushes, pulls, merges, version updates, and release checkouts.
App chats edit and check code only in their assigned worktrees. They leave a handoff for supervisor review.
App chats must not run Git helpers, change main, or manage release branches unless the human explicitly reassigns that role.
Read the shared role at `D:\workspace\codexsun\assist\agents\release-supervisor.md` when available.
Otherwise, read `assist/agents/release-supervisor.md` from the reviewed repository copy.
This role policy overrides older app-chat integration instructions. Only the human can grant exceptions.
No npm installation or deployment is authorized. Writing these rules does not trigger Git or release operations.

## Shared Worktree And Release Rules

Use `D:\workspace\codexsun\assist\operations\worktree-release-workflow.md` as the shared policy when available.
Otherwise, use `assist/operations/worktree-release-workflow.md` from the reviewed repository copy.
This policy overrides older checkout-location and release-flow instructions in this worktree.

- Develop apps in authorized external worktrees, then integrate completed changes into `main`.
- Cut a frozen versioned candidate from reviewed `main`, test staging, then promote approved images to cloud.
- Reserved folders under `D:\workspace\codexsun-worktrees\release` use hyphenated versions and stay empty until candidate preparation is authorized.
- Folder creation and documentation requests do not authorize pulls, installs, branches, version bumps, commits, pushes, or deployment.
- Read the full shared workflow before worktree creation, integration, versioning, or release operations.
- Preserve unrelated work, existing stashes, tenant data, and shared infrastructure.

For Zetro work, also read `apps/zetro/agent/README.md` and `apps/zetro/agent/SKILLS.md`.
The Zetro API loads `SKILLS.md` for business chat at runtime. Keep the runtime rules,
backend permission checks, tests, and this document in agreement. A prompt, tenant
setting, or review note must never grant a capability or weaken a backend check.
