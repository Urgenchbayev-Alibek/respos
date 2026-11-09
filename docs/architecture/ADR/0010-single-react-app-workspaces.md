# ADR-0010. Одно React-приложение с workspaces + отдельный лендинг

**Статус:** Accepted
**Дата:** 2026-11-10

## Контекст

ТЗ §2.2: 7 типов интерфейсов; на MVP рабочие интерфейсы могут быть в одном React-приложении с разными маршрутами,
layout и правами. Публичный сайт имеет другие требования (SEO, скорость, без авторизации).

## Решение

- `respos-admin` (в ТЗ — `frontend/`): одно SPA (React 18 + TS + Vite) с workspaces:
  `/admin/*` (Admin Panel), `/waiter/*`, `/kds/*`, `/cashier/*`, `/stock/*`, `/platform/*`.
  Каждый workspace — свой layout (sidebar для admin, full-screen тёмный для KDS, touch-first для waiter) и guard по правам.
  После логина — выбор workspace из доступных по `MeDto.permissions` (единственный — открывается сразу).
- Общие `shared/` (api-client, permissions, i18n, ui-kit, realtime) — одна копия на приложение.
- Ленивая загрузка (`React.lazy`) по workspace, чтобы KDS/waiter грузили минимум кода.
- `respos-landing`: отдельный статический React + Vite сайт, свой проект Vercel; общается с API только через
  `POST /public/demo-requests` и `GET /public/plans`.

## Альтернативы

- **Отдельное приложение на каждый workspace** — дублирование shared-кода, несколько деплоев.
- **Monorepo с пакетами (pnpm workspaces / Nx)** — оправдано при росте; пока лишняя сложность.
- **Лендинг внутри SPA** — хуже SEO, связывает релизы маркетинга и продукта.
- **Next.js для лендинга** — возможно позже ради SSR/SEO.

## Последствия

- Единая дизайн-система и i18n, один bundle-конфиг.
- Нужна дисциплина code-splitting; размер чанков контролировать позже.
- Отдельный KDS/PWA/desktop-клиент можно выделить позже на том же API.
