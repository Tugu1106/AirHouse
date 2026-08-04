// Local stdio MCP server for Claude Desktop. Reads newline-delimited JSON-RPC
// from stdin, dispatches via the shared tool handler, writes responses to
// stdout. All diagnostics go to stderr — stdout must carry ONLY protocol JSON.
//
// Config: DATABASE_URL (Postgres). Acts as the admin user (resolved from the DB,
// or ADMIN_ACTOR_ID if provided). Build: pnpm --filter @airlink/mcp-server build.

import { createInterface } from 'node:readline';
import { configureCore, getAdminActorId } from '@airlink/core';
import { handleRpc } from './mcp';
import type { ToolContext } from './tools';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[airhouse-mcp] DATABASE_URL is not set.');
    process.exit(1);
  }
  configureCore({ connectionString: url });

  const actorId = process.env.ADMIN_ACTOR_ID || (await getAdminActorId());
  if (!actorId) {
    console.error('[airhouse-mcp] No admin user found. Seed an admin before using the MCP.');
    process.exit(1);
  }
  const ctx: ToolContext = { actorId };

  const send = (obj: unknown) => process.stdout.write(JSON.stringify(obj) + '\n');
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

  console.error('[airhouse-mcp] ready (stdio)');

  for await (const line of rl) {
    const text = line.trim();
    if (!text) continue;

    let msg: unknown;
    try {
      msg = JSON.parse(text);
    } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      continue;
    }

    try {
      const res = await handleRpc(msg, ctx);
      if (res == null) continue; // notification-only → no reply
      if (Array.isArray(res)) res.forEach(send);
      else send(res);
    } catch (e) {
      const id = (msg as { id?: string | number | null }).id ?? null;
      send({
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: e instanceof Error ? e.message : 'Internal error' },
      });
    }
  }
}

main().catch((e) => {
  console.error('[airhouse-mcp] fatal:', e);
  process.exit(1);
});
