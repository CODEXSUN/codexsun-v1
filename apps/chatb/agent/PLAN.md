# Chatb plan

Chat owns messages and authorization. Chatb owns only external WebSocket connection proxying. Platform remains the session authority.

The local Web proxy now sends existing realtime routes through Chatb. A protocol warm-up
confirms that the asynchronous Chat owner is ready before client frames are released.
Cookie and native Authorization-header authentication retain Platform's live session checks.
Redis fan-out and migration of business processing remain separate future changes.
