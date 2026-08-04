import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider';

export interface Env {
  /** Postgres connection string (MCP re-homed off Cloudflare during migration). */
  DATABASE_URL: string;
  /** users.id written to created_by / audit_log.actor for MCP actions. */
  ADMIN_ACTOR_ID: string;
  /** Password the admin types on the consent screen to authorize a Claude connection. */
  OAUTH_PASSWORD: string;
  /** KV namespace the OAuth provider uses to store clients / grants / tokens. */
  OAUTH_KV: KVNamespace;
  /** Injected by OAuthProvider — helpers used by the authorize flow. */
  OAUTH_PROVIDER: OAuthHelpers;
}
