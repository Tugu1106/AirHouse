// Server-only Supabase client used by all core business logic.
//
// Uses the SERVICE ROLE key, which bypasses Row Level Security. This is correct
// for v1 (single trusted admin) and is why core must only ever run on the
// server — never import this into browser code.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

const CLIENT_OPTS = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/**
 * Explicitly configure the core with Supabase credentials. Use this in runtimes
 * that don't expose process.env (e.g. Cloudflare Workers, Deno) — the web app
 * doesn't need it, since getServiceClient() falls back to process.env there.
 */
export function configureCore(config: { url: string; serviceRoleKey: string }): void {
  cached = createClient(config.url, config.serviceRoleKey, CLIENT_OPTS);
}

export function getServiceClient(): SupabaseClient {
  if (cached) return cached;

  // Node fallback (Next.js web app). Accessed via globalThis so this file also
  // type-checks and runs in Workers/Deno, where configureCore() is used instead.
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const url = proc?.env?.SUPABASE_URL;
  const key = proc?.env?.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Core is not configured. Either set SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ' +
        '(Node), or call configureCore({ url, serviceRoleKey }) (Workers/Deno).',
    );
  }

  cached = createClient(url, key, CLIENT_OPTS);
  return cached;
}
