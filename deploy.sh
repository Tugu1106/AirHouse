#!/bin/bash
# Deploy AirHouse on the internal server (self-hosted Postgres + web).
# Usage: bash ~/airhouse/deploy.sh   (reads config from ~/airhouse/.env)
set -e
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.prod.yml"

echo "==> Pulling latest code..."
git pull

# One-time: remove the old single-container (pre-Postgres) deploy if it exists,
# so it doesn't hold port 3000.
docker rm -f airhouse >/dev/null 2>&1 || true

echo "==> Building + starting Postgres and web..."
$COMPOSE up -d --build

echo "==> Seeding admin (create-only, idempotent)..."
$COMPOSE run --rm seed || true

echo "==> Status:"
$COMPOSE ps

echo "==> web logs (last 25 lines):"
$COMPOSE logs --tail 25 web || true

echo "==> Done. App: http://10.58.152.12"
