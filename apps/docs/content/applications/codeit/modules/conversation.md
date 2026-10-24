# Codeit Conversation Module

Interactive chat interface, conversation history, real-time SSE event streaming, and approval workflows.

## Workflow and ownership

The `conversation` module owns user message inputs, assistant response timelines, streaming cursor rendering, tool cards, and operator approval controls.
It interacts with the backend conversation API, tracks active runs, receives Server-Sent Events with cursor replay, and handles operator interventions.
Controlled doubles are restricted exclusively to isolated unit tests.

## Sources

- `devkits/codeit/src/modules/conversation/`
- `devkits/codeit/api/src/modules/conversation/`
- `devkits/codeit/agent/UI-WORKFLOWS.md`

## Verification

Verified via `devkits/codeit/src/modules/conversation/conversation.spec.ts` and automated browser E2E workflows.
