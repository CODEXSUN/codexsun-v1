# Repository agent entry point

For normal work, read the Fast Work Default in `assist/AGENT-GUIDE.md` and `assist/governance/rules.md` before changing this repository.

For normal bug fixes and focused UI work, read the affected source and its nearest public contract.
Do not read or update component `README.md`, `agent/TASK.md`, `agent/PLAN.md`, or `agent/SKILLS.md` unless the task changes a contract, architecture, module ownership, operations, or documentation, or the user asks for an audit or release.
This fast-work policy overrides older, more detailed agent and Assist checklists for normal focused work.

For Zetro work, also read `apps/zetro/agent/README.md` and `apps/zetro/agent/SKILLS.md`.
The Zetro API loads `SKILLS.md` for business chat at runtime. Keep the runtime rules,
backend permission checks, tests, and this document in agreement. A prompt, tenant
setting, or review note must never grant a capability or weaken a backend check.
