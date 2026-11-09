# Starts local PostgreSQL for RestaurantOS development and prints next steps.
# Usage: pwsh ./scripts/dev-up.ps1   (or: powershell -File scripts\dev-up.ps1)
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $root 'infra/docker/docker-compose.yml'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error 'Docker не найден. Установите Docker Desktop с Compose v2.'
    exit 1
}

Write-Host 'Запуск PostgreSQL (docker compose)...'
docker compose -f $composeFile up -d postgres
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Ожидание готовности БД...'
$status = 'unknown'
for ($i = 0; $i -lt 30; $i++) {
    $containerId = docker compose -f $composeFile ps -q postgres
    if ($containerId) {
        $status = docker inspect -f '{{.State.Health.Status}}' $containerId
        if ($status -eq 'healthy') { break }
    }
    Start-Sleep -Seconds 2
}
Write-Host "PostgreSQL: $status (localhost:5433, db=respos, user=respos, password=respos_dev — только для dev)"

if (-not (Test-Path (Join-Path $root '.env'))) {
    Write-Host 'Подсказка: скопируйте .env.example в .env и задайте Jwt__SigningKey (>= 32 символа).'
}

Write-Host @'

Дальше:
  1) Backend:  cd respos-backend; dotnet restore; dotnet run --project src/Restaurant.Api
               -> http://localhost:5080/swagger
  2) Admin:    cd respos-admin; npm install; npm run dev      -> http://localhost:5173
  3) Landing:  cd respos-landing; npm install; npm run dev    -> http://localhost:5174
  Demo-вход (Development seed): owner@demo.respos.uz / пароль из Seed__DemoPassword
  Остановить БД: docker compose -f infra/docker/docker-compose.yml down
'@
