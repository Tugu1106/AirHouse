# Airlink IT Asset Tracker

Tracks hardware (PCs, monitors, cables, printers, switches…) — who owns each item,
which branch it's at, and its full history. Every change is audit-logged.
**Fully self-hosted — no third-party cloud.**

## Tech
- **Frontend + backend:** Next.js 15 (App Router) + React 19 + Tailwind
- **Database:** self-hosted PostgreSQL 16, accessed via Kysely
- **Auth:** custom — bcrypt + database-backed session cookies
- **Runtime:** Node 22 · pnpm monorepo · TypeScript
- **Infra:** Docker Compose + Nginx on an internal Ubuntu server
- **AI:** a local MCP server to manage assets from Claude Desktop

## Structure
```
apps/web          Next.js app (UI + server actions = the backend)
packages/core     Shared business logic + DB layer (Kysely/pg)
apps/mcp-server   Local stdio MCP server for Claude Desktop
db/init           Database schema
```

## Local development
```bash
corepack enable
pnpm install
pnpm db:up                                            # start local Postgres (Docker)
ADMIN_EMAIL=you@x.mn ADMIN_PASSWORD=secret pnpm seed:admin
pnpm dev                                              # http://localhost:3000
```
Set `DATABASE_URL` in `apps/web/.env.local` (copy from `apps/web/.env.example`).

## Deploy (internal server)
Push to GitLab, then on the server:
```bash
cd ~/airhouse && git pull && bash ~/airhouse/deploy.sh
```
Runs Postgres + the app in Docker (`docker-compose.prod.yml`). Live at **http://10.58.152.12**.

## MCP (Claude Desktop)
```bash
pnpm --filter @airlink/mcp-server build
```
Point `claude_desktop_config.json` at `apps/mcp-server/dist/airhouse-mcp.cjs`, with
`DATABASE_URL` in its `env`. Restart Claude Desktop.

## Add a new hardware type
Edit `packages/core/src/itemTypes.ts` — no migration needed (item properties are JSONB;
forms and filters pick it up automatically).
