# Airlink Assets — MCP Server (Phase 2)

A Cloudflare Worker that exposes the asset tracker to Claude as MCP tools. It's a
thin wrapper over `@airlink/core` — the *same* logic the web app uses — so an
action taken through Claude produces identical database state and audit entries
as the same action in the web form.

**Tools.** Claude gets everyday, reversible actions. Permanent deletions
(branch/employee) are intentionally NOT exposed — those stay human-only in the
web app, behind a confirmation.
- Read: `list_branches`, `list_employees`, `list_item_types`, `list_items`
- Items: `add_item`, `update_item`, `transfer_item`, `soft_delete_item` (reversible), `restore_item`
- Employees: `add_employee`, `update_employee`
- Branches: `add_branch`, `rename_branch`, `set_central_branch`

**Auth:** OAuth 2.1 (via `@cloudflare/workers-oauth-provider`), so it works as a
claude.ai **custom connector** in the browser. Connecting is gated by a single
admin password you set — when Claude connects, you get a consent screen and type
that password once.

---

## How it fits together

```
You (chatting with Claude)
        │  "Add PC-014 to John at Khan Tower"
        ▼
Claude ──OAuth──► /authorize (you enter admin password, once)
        │                    └─► token
        ▼
Claude ──MCP (token)──► this Worker (Cloudflare, 24/7)
                              │ calls @airlink/core
                              ▼
                        Supabase  ──►  web dashboard reflects it instantly
```

---

## Deploy (one time)

### 1. Values you'll need
- Your Supabase **Project URL** and **service_role key** (Project Settings → API).
- **`ADMIN_ACTOR_ID`** — your Supabase auth user's UUID (Authentication → Users →
  click your admin user → **User UID**). MCP actions are attributed to this id.
- **`OAUTH_PASSWORD`** — a password you invent. You'll type it on the consent
  screen when connecting Claude. Pick something strong.

### 2. Log in to Cloudflare
```bash
cd apps/mcp-server
pnpm exec wrangler login
```

### 3. Create the KV namespace (stores OAuth tokens) and wire its id
```bash
pnpm exec wrangler kv namespace create OAUTH_KV
```
It prints an `id`. Open `wrangler.toml` and replace `REPLACE_WITH_KV_ID` with it.

### 4. Set the secrets (do this in PowerShell so the prompt shows)
```powershell
pnpm exec wrangler secret put SUPABASE_URL
pnpm exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY
pnpm exec wrangler secret put ADMIN_ACTOR_ID
pnpm exec wrangler secret put OAUTH_PASSWORD
```

### 5. Deploy
```bash
# use `wrangler deploy`, NOT `pnpm deploy` (that's a different pnpm built-in)
pnpm exec wrangler deploy
```
Your MCP endpoint is the printed URL + **`/mcp`**, e.g.
`https://airlink-assets-mcp.<subdomain>.workers.dev/mcp`

### 6. Verify it's live
```bash
curl https://airlink-assets-mcp.<subdomain>.workers.dev/health
# {"ok":true,...}

# The OAuth discovery doc Claude reads:
curl https://airlink-assets-mcp.<subdomain>.workers.dev/.well-known/oauth-authorization-server
```

---

## Connect it to Claude (browser)

1. claude.ai → **Settings → Connectors → Add custom connector**.
2. Paste your `…/mcp` URL.
3. Claude registers itself and opens your **consent screen** — type your
   `OAUTH_PASSWORD` and click **Authorize**.
4. The asset tools appear. Try *"list my branches."*

(No client ID or token to paste — the OAuth handshake is automatic once the
password is accepted.)

---

## Local development
```bash
cd apps/mcp-server
cp .dev.vars.example .dev.vars   # fill with real values
pnpm dev                         # wrangler dev on http://127.0.0.1:8788
```

## Try it (once connected)
- *"List the branches."* → `list_branches`
- *"Add a PC, serial PC-014, to Khan Tower, assigned to John."* → `add_item`
- *"Move PC-014 to Branch 3."* → `list_items` then `transfer_item`
- *"Retire PC-014."* → `soft_delete_item`

Then open the web dashboard — the change is already there (same database).

**Exit criteria (Phase 2):** an action via Claude produces the same `items` row
and `audit_log` entry as the same action via the web form. ✅
