// Cloudflare Worker entry point.
//
// OAuthProvider wraps the whole Worker: it serves the OAuth discovery docs,
// /token and /register, validates access tokens on /mcp, and routes everything
// else to the default handler (the /authorize consent screen + /health).
//
//   Claude ──OAuth──► /authorize (admin password) ──► token ──► /mcp ──► core ──► Supabase

import OAuthProvider from '@cloudflare/workers-oauth-provider';
import { apiHandler } from './mcp-api';
import { defaultHandler } from './auth-handler';

export default new OAuthProvider({
  apiRoute: '/mcp',
  apiHandler,
  defaultHandler,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/token',
  clientRegistrationEndpoint: '/register',
});
