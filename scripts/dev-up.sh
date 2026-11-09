#!/usr/bin/env bash
# Starts local PostgreSQL for RestaurantOS development and prints next steps.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT/infra/docker/docker-compose.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker не найден. Установите Docker Desktop / Docker Engine с Compose v2." >&2
  exit 1
fi

echo "Запуск PostgreSQL (docker compose)..."
docker compose -f "$COMPOSE_FILE" up -d postgres

echo "Ожидание готовности БД..."
for _ in $(seq 1 30); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose -f "$COMPOSE_FILE" ps -q postgres)" 2>/dev/null || echo unknown)"
  if [ "$status" = "healthy" ]; then break; fi
  sleep 2
done
echo "PostgreSQL: $status (localhost:5433, db=respos, user=respos, password=respos_dev — только для dev)"

if [ ! -f "$ROOT/.env" ]; then
  echo "Подсказка: скопируйте .env.example в .env и задайте Jwt__SigningKey (>= 32 символа)."
fi

cat <<'EOF'

Дальше:
  1) Backend:  cd respos-backend && dotnet restore && dotnet run --project src/Restaurant.Api
               -> http://localhost:5080/swagger
  2) Admin:    cd respos-admin && npm install && npm run dev      -> http://localhost:5173
  3) Landing:  cd respos-landing && npm install && npm run dev    -> http://localhost:5174
  Demo-вход (Development seed): owner@demo.respos.uz / пароль из Seed__DemoPassword
  Остановить БД: docker compose -f infra/docker/docker-compose.yml down
EOF
