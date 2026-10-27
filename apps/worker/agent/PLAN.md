# Worker plan

Worker owns runtime execution infrastructure, not CRM, Chat, or Platform business rules.
The opt-in public Platform background composition registers owner handlers without routes or database bootstrap.
The default execution host remains Platform until the documented cutover gates pass.

The local cloud profile runs Worker against its isolated Redis and stable diagnostic namespace.
Control-token probes, health, reconnect, graceful stop, and queue persistence are verified.
Business consumers require matching host configuration and a coordinated stop/start gate.
Durable cross-version fencing and generic running-job recovery remain rollout prerequisites.
Concurrent application enqueue uses a per-master advisory lock that preserves SQL key equality.
Direct SQL writes remain outside this protection.
See the current [architecture and cutover plan](../README.md).
