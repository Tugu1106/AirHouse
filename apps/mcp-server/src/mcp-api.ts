// The protected API handler. OAuthProvider validates the access token BEFORE
// calling this, so there's no manual auth check here — we just serve MCP.

import { configureCore } from '@airlink/core';
import { handleRpc } from './mcp';
import type { Env } from './env';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const apiHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return json({ error: 'Use POST for /mcp.' }, 405);

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.ADMIN_ACTOR_ID) {
      return json(
        { jsonrpc: '2.0', id: null, error: { code: -32002, message: 'Server not configured.' } },
        500,
      );
    }
    configureCore({ url: env.SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
    }

    const response = await handleRpc(body, { actorId: env.ADMIN_ACTOR_ID });
    if (response === null) return new Response(null, { status: 202 });
    return json(response);
  },
};
