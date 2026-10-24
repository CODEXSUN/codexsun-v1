# Codeit Plugin Module

Model Context Protocol (MCP) server broker, plugin lifecycle management, and external tool integration.

## Workflow and ownership

The `plugin` module provides an MCP broker to register, discover, and invoke third-party tools and resources.
Plugins run under strict security sandboxing, requiring operator authorization before tools or side-effect capabilities are granted to an active session.

## Sources

- `devkits/codeit/src/modules/plugin/`
- `devkits/codeit/api/src/modules/plugin/`
- `devkits/codeit/agent/TOOLS-AND-PLUGINS.md`

## Verification

Verified via `devkits/codeit/api/test/plugin.test.mjs` and MCP connection tests.
