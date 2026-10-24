# Codeit Tool Module

Tool policy evaluation, least-privilege capability grants, and operator approval gates.

## Workflow and ownership

The `tool` module enforces capability matrices based on actor role, project trust status, run mode, and tool risk tier.
High-impact actions (file writes, shell execution, external network requests) require explicit, one-time operator approval tokens before execution.

## Sources

- `devkits/codeit/api/src/modules/tool/`
- `devkits/codeit/agent/CONTRACTS.md`
- `devkits/codeit/agent/TOOLS-AND-PLUGINS.md`

## Verification

Verified via `devkits/codeit/api/test/tool.test.mjs` and security regression suites.
