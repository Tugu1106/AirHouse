# Airlink Assets — MCP Server

A **local stdio MCP server** that exposes the asset tracker to Claude Desktop as
tools. It's a thin wrapper over `@airlink/core` — the *same* logic the web app
uses — so an action taken through Claude produces identical database state and
audit entries as the same action in the web form.

It talks to Claude over stdin/stdout (newline-delimited JSON-RPC) and connects
straight to Postgres. No Cloudflare, no OAuth, no public endpoint.

**Tools.** Claude gets everyday, reversible actions. Permanent deletions
(branch/employee) are intentionally NOT exposed — those stay human-only in the
web app, behind a confirmation.
- Read: `list_branches`, `list_employees`, `list_item_types`, `list_items`
- Items: `add_item`, `update_item`, `transfer_item`, `soft_delete_item` (reversible), `restore_item`
- Employees: `add_employee`, `update_employee`
- Branches: `add_branch`, `rename_branch`, `set_central_branch`

---

## How it fits together

```
You (chatting in Claude Desktop)
        │  "Add PC-014 to John at Khan Tower"
        ▼
Claude Desktop ──spawns──► node dist/airhouse-mcp.cjs   (this server, stdio)
                                │ calls @airlink/core
                                ▼
                           Postgres  ──►  web dashboard reflects it instantly
```

Actions are attributed to the admin user — resolved from the database, or
pinned with `ADMIN_ACTOR_ID` if you set it.

---

## Setup

### 1. Build the server
```bash
pnpm --filter @airlink/mcp-server build
```
This bundles everything into `apps/mcp-server/dist/airhouse-mcp.cjs`.

### 2. Point Claude Desktop at it
Edit Claude Desktop's config file:
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
  (Microsoft Store build: `…\AppData\Local\Packages\Claude_*\LocalCache\Roaming\Claude\claude_desktop_config.json`)
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

Add the server (use the absolute path to the built `.cjs` and your DB URL):
```json
{
  "mcpServers": {
    "airhouse": {
      "command": "node",
      "args": ["D:\\tugu programs\\code\\AirHouse\\apps\\mcp-server\\dist\\airhouse-mcp.cjs"],
      "env": {
        "DATABASE_URL": "postgresql://airhouse:PASSWORD@10.58.152.12:5432/airhouse"
      }
    }
  }
}
```
Point `DATABASE_URL` at the production DB (Postgres is exposed on the internal
network) or a local dev DB (`pnpm db:up`).

### 3. Restart Claude Desktop
The asset tools appear. Try *"list my branches."*

---

## Config

| Variable          | Required | Purpose                                                        |
| ----------------- | -------- | -------------------------------------------------------------- |
| `DATABASE_URL`    | yes      | Postgres connection string.                                    |
| `ADMIN_ACTOR_ID`  | no       | Pin actions to a specific admin id (else the oldest admin).    |

There must be at least one admin user in the DB (see `pnpm seed:admin`).

---

## Try it (once connected)
- *"List the branches."* → `list_branches`
- *"Add a PC, serial PC-014, to Khan Tower, assigned to John."* → `add_item`
- *"Move PC-014 to Branch 3."* → `list_items` then `transfer_item`
- *"Retire PC-014."* → `soft_delete_item`

Then open the web dashboard — the change is already there (same database).
