# Repository agent entry point

For normal work, read the Fast Work Default in `assist/AGENT-GUIDE.md` and `assist/governance/rules.md` before changing this repository.

For normal bug fixes and focused UI work, read the affected source and its nearest public contract.
Do not read or update component `README.md`, `agent/TASK.md`, `agent/PLAN.md`, or `agent/SKILLS.md` unless the task changes a contract, architecture, module ownership, operations, or documentation, or the user asks for an audit or release.
This fast-work policy overrides older, more detailed agent and Assist checklists for normal focused work.

For a small change, implement the request and use at most one focused check when it adds value.
For a trivial edit, inspection can be sufficient. State what was verified.
Do not run repository-wide checks, builds, or independent reviews for each prompt.
Run broader checks for an explicit audit or release, or when the change's risk requires them.
Report incomplete verification and hand off broader review as a separate task when requested.

## App Selection

Before an unspecified app task, ask which app the user wants to work on.
Current app work is separate: Marketing, CRM, and Billing.
Use the current checkout for app development unless the user chooses another location.
Do not ask again when the user already names the app or explicitly requests all three.
Do not combine app changes, installs, or runtime resources merely because the repository is shared.
App development tasks may install locked root dependencies when needed.

## Prompt Manager Role

Prompt Manager only analyzes requests and drafts prompts for the correct app, supervisor, or deployment chat.
It must not execute drafted tasks or send prompts without the human's explicit instruction.
Creating prompts for all chats does not authorize sending them. A received starter template does not authorize implementation.
Read `D:\workspace\codexsun\assist\agents\prompt-manager.md` when available, otherwise the reviewed repository's `assist/agents/prompt-manager.md`.
This role cannot grant Git, installation, deployment, database, or messaging permissions to another chat.
No npm installation or deployment is authorized by prompt drafting or this policy update.

## Supervisor And App Chat Roles

App chats may stage, commit, pull, and push their own app work.
Preserve unrelated work and avoid destructive Git operations.
The release supervisor owns integration into main, version updates, and release checkouts.
Read the shared role at `D:\workspace\codexsun\assist\agents\release-supervisor.md` when available.
Otherwise, read `assist/agents/release-supervisor.md` from the reviewed repository copy.
This role policy overrides older app-chat integration instructions.
A policy change alone does not trigger Git operations, installation, or deployment.

## Shared Worktree And Release Rules

Use `D:\workspace\codexsun\assist\operations\worktree-release-workflow.md` as the shared policy when available.
Otherwise, use `assist/operations/worktree-release-workflow.md` from the reviewed repository copy.
This policy overrides older checkout-location and release-flow instructions in this worktree.

- The user decides whether app development uses the main checkout or a worktree.
- Cut a frozen versioned candidate from reviewed `main`, test staging, then promote approved images to cloud.
- Reserved folders under `D:\workspace\codexsun-worktrees\release` use hyphenated versions and stay empty until candidate preparation is authorized.
- Folder creation and documentation requests do not authorize pulls, installs, branches, version bumps, commits, pushes, or deployment.
- Read the full shared workflow before worktree creation, integration, versioning, or release operations.
- Preserve unrelated work, existing stashes, tenant data, and shared infrastructure.

For Zetro work, also read `apps/zetro/agent/README.md` and `apps/zetro/agent/SKILLS.md`.
The Zetro API loads `SKILLS.md` for business chat at runtime. Keep the runtime rules,
backend permission checks, tests, and this document in agreement. A prompt, tenant
setting, or review note must never grant a capability or weaken a backend check.
