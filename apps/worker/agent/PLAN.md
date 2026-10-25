# Worker plan

Worker owns runtime execution infrastructure, not CRM, Chat, or Platform business rules. Existing queues remain in Platform until a controlled migration.

The local cloud profile runs Worker against its isolated Redis and stable diagnostic namespace.
Control-token probes, health, reconnect, graceful stop, and queue persistence are verified.
Business consumers still require a public job contract and single-consumer migration gate.
