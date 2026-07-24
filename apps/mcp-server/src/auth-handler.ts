// Default handler: everything that isn't the protected /mcp API. Most
// importantly it implements the /authorize consent screen — a single password
// gate so only the admin can authorize a Claude connection. The OAuthProvider
// implements /token and /register (and the .well-known discovery docs) itself.

import type { AuthRequest } from '@cloudflare/workers-oauth-provider';
import type { Env } from './env';

function consentPage(encodedRequest: string, error: string): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Authorize Claude · Airlink Asset Tracker</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f1f5f9; display: grid; place-items: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; padding: 2rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.1); width: 100%; max-width: 360px; }
    h1 { font-size: 1.1rem; margin: 0 0 .25rem; color: #0f172a; }
    p { color: #64748b; font-size: .9rem; margin: 0 0 1.25rem; }
    label { display: block; font-size: .85rem; font-weight: 600; color: #334155; margin-bottom: .35rem; }
    input { width: 100%; box-sizing: border-box; padding: .6rem .75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: .95rem; }
    button { margin-top: 1rem; width: 100%; padding: .65rem; background: #1d4ed8; color: #fff; border: 0; border-radius: 8px; font-size: .95rem; font-weight: 600; cursor: pointer; }
    button:hover { background: #1e3a8a; }
    .err { color: #dc2626; font-size: .85rem; margin-top: .75rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Connect Claude to Airlink Asset Tracker</h1>
    <p>Enter the admin password to allow Claude to manage your assets.</p>
    <form method="POST" action="/authorize">
      <input type="hidden" name="oauth" value="${encodedRequest}" />
      <label for="password">Admin password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" autofocus required />
      ${error ? `<div class="err">${error}</div>` : ''}
      <button type="submit">Authorize</button>
    </form>
  </div>
</body>
</html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export const defaultHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, server: 'airlink-assets-mcp' }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.pathname === '/authorize') {
      if (request.method === 'GET') {
        const oauthReq = await env.OAUTH_PROVIDER.parseAuthRequest(request);
        return consentPage(btoa(JSON.stringify(oauthReq)), '');
      }
      if (request.method === 'POST') {
        const form = await request.formData();
        const password = String(form.get('password') ?? '');
        const encoded = String(form.get('oauth') ?? '');

        let oauthReq: AuthRequest;
        try {
          oauthReq = JSON.parse(atob(encoded)) as AuthRequest;
        } catch {
          return new Response('Bad authorization request.', { status: 400 });
        }

        if (!env.OAUTH_PASSWORD || password !== env.OAUTH_PASSWORD) {
          return consentPage(encoded, 'Incorrect password. Please try again.');
        }

        const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
          request: oauthReq,
          userId: 'admin',
          metadata: {},
          scope: oauthReq.scope,
          props: { userId: 'admin' },
        });
        return Response.redirect(redirectTo, 302);
      }
    }

    return new Response('Not found', { status: 404 });
  },
};
