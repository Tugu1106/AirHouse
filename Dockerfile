# ---- deps ----
FROM node:22-alpine AS deps
# Download+activate pnpm in its own layer (keyed only on the version), so it is
# fetched from the registry at most once and reused — a source edit can't force
# corepack back onto the network.
RUN corepack enable && corepack prepare pnpm@11.16.0 --activate
WORKDIR /app
RUN pnpm config set fetch-timeout 300000 --location=global \
 && pnpm config set fetch-retries 5 --location=global \
 && pnpm config set network-concurrency 4 --location=global
# Only the workspace MANIFESTS go in before install — not the source — so this
# layer (and the install) is cached until dependencies actually change. All
# manifests must be present for --frozen-lockfile to validate the lockfile (the
# workspace globs apps/* and packages/*), even mcp-server which we don't build
# here. The --filter keeps the install to web + its deps (skips mcp-server's
# Cloudflare/workerd deps).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/mcp-server/package.json apps/mcp-server/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile --filter @airlink/web...

# ---- build ----
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@11.16.0 --activate
WORKDIR /app
# Bring the whole installed tree from deps — pnpm puts a node_modules in each
# workspace package (apps/web/node_modules holds the `next` binary), not just at
# the root. Then overlay the source (node_modules isn't in the git context, so
# the copied ones survive).
COPY --from=deps /app ./
COPY . .
RUN pnpm --filter @airlink/web build

# ---- runtime ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Bind to all interfaces so Nginx can reach the container on port 3000.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]