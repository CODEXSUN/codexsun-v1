# Deployment agent entry point

Read [the internal operator guide](../docs/DEPLOYMENT.md), then the affected v1 source and deployment tests.
This owner controls versioned VPS deployment infrastructure, not application business logic.
Root setup and update commands delegate only to `codexsun-v1`.

Read [SKILLS.md](SKILLS.md) before operations. Track implementation and verification separately in [TASK.md](TASK.md).
Use [PLAN.md](PLAN.md) for the deployment boundary and future version changes.

Local Docker Desktop uses the separate root `deploy-local.sh` and `update-local.sh` commands.
Read [LOCAL-DEPLOYMENT.md](../docs/LOCAL-DEPLOYMENT.md) for their retained-infrastructure contract.
