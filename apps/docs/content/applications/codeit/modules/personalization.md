# Codeit Personalization Module

Developer prompt instructions, workspace style rules, and agent persona configurations.

## Workflow and ownership

The `personalization` module stores custom developer instructions, repo-specific rules, and user preferences.
These instructions are loaded during run context preparation and injected into agent prompts to align assistant responses with repository coding standards and operator guidelines.

## Sources

- `devkits/codeit/src/modules/personalization/`
- `devkits/codeit/api/src/modules/personalization/`
- `devkits/codeit/agent/ARCHITECTURE.md`

## Verification

Verified via `devkits/codeit/api/test/personalization.test.mjs` and UI preference test suites.
