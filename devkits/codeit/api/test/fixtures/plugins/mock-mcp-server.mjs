#!/usr/bin/env node

/**
 * Mock MCP 2024-11-05 Server for Codeit Plugin Tests
 *
 * Communicates via JSON-RPC 2.0 newline-delimited messages over stdio.
 */

let buffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newlineIdx = buffer.indexOf("\n");
  while (newlineIdx !== -1) {
    const line = buffer.slice(0, newlineIdx).trim();
    buffer = buffer.slice(newlineIdx + 1);
    if (line.length > 0) {
      handleMessage(line);
    }
    newlineIdx = buffer.indexOf("\n");
  }
});

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function handleMessage(line) {
  try {
    const req = JSON.parse(line);
    const { id, method, params } = req;

    if (method === "initialize") {
      send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "mock-mcp-server",
            version: "1.0.0"
          }
        }
      });
      return;
    }

    if (method === "notifications/initialized") {
      // MCP client notification, no response required
      return;
    }

    if (method === "tools/list") {
      send({
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "echo",
              description: "Echoes input argument message",
              inputSchema: {
                type: "object",
                properties: { message: { type: "string" } },
                required: ["message"]
              }
            },
            {
              name: "env_check",
              description: "Inspects visible environment variables",
              inputSchema: { type: "object" }
            },
            {
              name: "large_payload",
              description: "Generates output exceeding 500KB payload quota",
              inputSchema: { type: "object" }
            },
            {
              name: "hang",
              description: "Hangs indefinitely to test timeout and cancellation",
              inputSchema: { type: "object" }
            }
          ]
        }
      });
      return;
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const args = params?.arguments ?? {};

      if (toolName === "echo") {
        send({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: `Echo: ${args.message ?? ""}`
              }
            ],
            isError: false
          }
        });
        return;
      }

      if (toolName === "env_check") {
        // Return JSON string of all environment keys
        const envKeys = Object.keys(process.env);
        send({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(envKeys)
              }
            ],
            isError: false
          }
        });
        return;
      }

      if (toolName === "large_payload") {
        // Generate 600KB payload (exceeding 500KB quota)
        const filler = "X".repeat(600 * 1024);
        send({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: filler
              }
            ],
            isError: false
          }
        });
        return;
      }

      if (toolName === "hang") {
        // Do not respond; wait indefinitely until killed
        return;
      }

      send({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Tool '${toolName}' not found`
        }
      });
      return;
    }

    if (id !== undefined) {
      send({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Method '${method}' not found`
        }
      });
    }
  } catch (err) {
    send({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: `Parse error: ${err.message}`
      }
    });
  }
}
