# Codeit Provider Module

AI model providers, multi-adapter inference routing, token budgets, and connection diagnostics.

## Workflow and ownership

The `provider` module manages adapter configurations for AI model providers (including Anthropic, OpenAI, Gemini, Ollama, and test mocks).
It exposes latency, token usage, context budget, and live connection health diagnostics to the workspace.

## Sources

- `devkits/codeit/src/modules/provider/`
- `devkits/codeit/api/src/modules/provider/`
- `devkits/codeit/agent/ARCHITECTURE.md`

## Verification

Verified via `devkits/codeit/api/test/provider.test.mjs` and provider connection tests.
