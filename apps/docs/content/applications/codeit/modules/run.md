# Codeit Run Module

Execution run lifecycle, coding loop orchestration, step progression, and cancellation fencing.

## Workflow and ownership

The `run` module manages the state machine of an execution session (pending, running, cancelling, cancelled, succeeded, failed).
It fences run generations so that late events or worker results from previous generations cannot affect the active state, and controls iterative coding loops.

## Sources

- `devkits/codeit/api/src/modules/run/`
- `devkits/codeit/agent/DEVELOPMENT-LOOP.md`

## Verification

Verified via `devkits/codeit/api/test/run.test.mjs` and run lifecycle regression suites.
