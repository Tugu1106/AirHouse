// Minimal, stateless MCP server over JSON-RPC 2.0 (Streamable HTTP transport).
// Supports the subset a tools-only remote server needs: initialize, tools/list,
// tools/call, ping, and the initialized notification. No sessions, no SSE — each
// POST is handled independently, which is all Claude's connector requires here.

import { TOOLS, TOOLS_BY_NAME, type ToolContext } from './tools';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'airlink-assets', version: '0.1.0' };

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

function result(id: JsonRpcRequest['id'], value: unknown) {
  return { jsonrpc: '2.0' as const, id, result: value };
}

function error(id: JsonRpcRequest['id'], code: number, message: string) {
  return { jsonrpc: '2.0' as const, id, error: { code, message } };
}

async function handleMessage(msg: JsonRpcRequest, ctx: ToolContext): Promise<object | null> {
  switch (msg.method) {
    case 'initialize':
      return result(msg.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });

    // Notifications (no id) — acknowledge with no response body.
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;

    case 'ping':
      return result(msg.id, {});

    case 'tools/list':
      return result(msg.id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });

    case 'tools/call': {
      const name = String(msg.params?.name ?? '');
      const tool = TOOLS_BY_NAME.get(name);
      if (!tool) return error(msg.id, -32602, `Unknown tool: ${name}`);
      const args = (msg.params?.arguments as Record<string, unknown>) ?? {};
      try {
        const text = await tool.handler(args, ctx);
        return result(msg.id, { content: [{ type: 'text', text }], isError: false });
      } catch (e) {
        // Tool-level errors are returned as isError content so the model can
        // read and react to them, rather than as a transport error.
        const message = e instanceof Error ? e.message : 'Tool execution failed';
        return result(msg.id, { content: [{ type: 'text', text: `Error: ${message}` }], isError: true });
      }
    }

    default:
      return error(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

/** Handle a parsed JSON-RPC body (single message or batch). Returns the JSON to
 *  send back, or null if the body was only notifications (→ HTTP 202). */
export async function handleRpc(body: unknown, ctx: ToolContext): Promise<object[] | object | null> {
  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map((m) => handleMessage(m as JsonRpcRequest, ctx)))).filter(
      (r): r is object => r !== null,
    );
    return responses.length > 0 ? responses : null;
  }
  return handleMessage(body as JsonRpcRequest, ctx);
}
