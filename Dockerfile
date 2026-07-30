# ---- deps ----
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
RUN pnpm config set fetch-timeout 300000 --location=global \
 && pnpm config set fetch-retries 5 --location=global \
 && pnpm config set network-concurrency 4 --location=global
# All workspace manifests must be present for --frozen-lockfile to validate the
# lockfile (the workspace globs apps/* and packages/*), even mcp-server which we
# don't build here. The --filter keeps the install to web + its deps (skips
# mcp-server's Cloudflare/workerd deps).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/mcp-server/package.json apps/mcp-server/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter @airlink/web...

# ---- build ----
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
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