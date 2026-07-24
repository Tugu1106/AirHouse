# Airlink IT Asset Tracker

Custom IT asset tracking for Airlink Mongolia — tracks hardware (PCs, cables,
monitors, switches, printers, etc.), who they're assigned to, which branch they
live at, and their full history. Soft-delete only; every change is audit-logged.

Monorepo, built in phases. **Phase 1 (this) = web app + database, single admin.**

## Structure

```
apps/web         Next.js app — the only UI in v1 (dashboard, branch views, forms)
packages/core    Shared business logic — ALL validation/audit/soft-delete rules
supabase/        SQL schema, migration, seed
```

Both the web app now and the MCP server later (phase 2) call the **same**
`packages/core` functions, so behavior is identical regardless of entry point.

## Tech
- Supabase (Postgres + Auth)
- Next.js 15 (App Router) + Tailwind, deployed on Vercel
- pnpm workspaces, TypeScript, Zod validation

---

## First-time setup

### 0. Enable pnpm (one time)
```bash
corepack enable
```

### 1. Create the Supabase project
1. Go to https://supabase.com → **New project**. Pick a name + a strong DB password, region close to Mongolia.
2. Wait for it to finish provisioning.

### 2. Create the database schema
1. In Supabase, open **SQL Editor**.
2. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and **Run**.
3. Paste the contents of [`supabase/seed.sql`](supabase/seed.sql), edit the branch
   names to your real branches, and **Run**. (Khan Tower is included as an example.)

### 3. Create the admin login
1. Supabase → **Authentication → Users → Add user**.
2. Enter your email + a password. (This is the single admin account for v1.)
3. Recommended: **Authentication → Providers → Email** → turn **off** "Confirm email"
   so the account works immediately without an email round-trip.

### 4. Wire up environment variables
1. Supabase → **Project Settings → API**. You need three values:
   - **Project URL**
   - **anon public** key
   - **service_role** key (secret — never commit it)
2. Copy [`apps/web/.env.local.example`](apps/web/.env.local.example) to
   `apps/web/.env.local` and fill them in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<Project URL>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
   SUPABASE_URL=<Project URL>
   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
   ```

### 5. Install + run
```bash
corepack pnpm install
corepack pnpm dev
```
Open http://localhost:3000 → you'll be sent to `/login` → sign in with the admin
account from step 3.

---

## Deploy to Vercel (when ready)
1. Push this repo to GitHub.
2. Vercel → **New Project** → import the repo.
3. Set **Root Directory** to `apps/web`.
4. Add the same 4 environment variables from step 4 in Vercel's project settings.
5. Deploy.

---

## Everyday commands
```bash
corepack pnpm dev          # run the web app locally
corepack pnpm build        # production build
corepack pnpm typecheck    # typecheck all packages
```

## Adding a new hardware type later
Edit one file: [`packages/core/src/itemTypes.ts`](packages/core/src/itemTypes.ts).
Add an entry to `ITEM_TYPES` with the type's fields. No database migration is
needed (item properties are stored as JSONB), and the web forms + filters pick
it up automatically.

## Roadmap
- **Phase 1 (done):** web + DB, single admin.
- **Phase 2 (built):** `apps/mcp-server` — a Cloudflare Worker exposing add/transfer/list to Claude via MCP, reusing `packages/core`. Deploy + connect steps in [apps/mcp-server/README.md](apps/mcp-server/README.md).
- **Phase 3:** polished branch drill-down UX; optional worker accounts + RLS scoped by `branch_id`.
