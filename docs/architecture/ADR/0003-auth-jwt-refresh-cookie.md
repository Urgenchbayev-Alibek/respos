# ADR-0003. Auth: короткий JWT в памяти + ротируемый refresh token в httpOnly cookie

**Статус:** Accepted
**Дата:** 2026-11-10

## Контекст

ТЗ §4.2: стойкий хеш паролей, нельзя хранить долгоживущие секреты в `localStorage`, refresh token ротировать
и отзывать, rate limit входа. Frontend (Vercel) и API (другой хостинг) — потенциально разные домены. SignalR
требует токен для WebSocket.

## Решение

- **Access token**: JWT, 15 минут, claims `sub`, `org` (нет для platform-only сессии), `platform_admin`.
  Хранится **только в памяти** SPA. Права для чувствительных операций backend загружает из БД (кеш на запрос),
  не доверяя списку в токене.
- **Refresh token**: случайные ≥ 32 байта, cookie `refresh_token` — `HttpOnly`, `Secure`, `Path=/api/v1/auth`,
  `SameSite=None` в prod / `Lax` в dev. В БД хранится только **SHA-256 hash** (`RefreshToken.TokenHash`).
  *Уточнение v1.1 (DECISIONS_v1_1 §10, реализовано):* `SameSite` настраивается `Auth:RefreshCookieSameSite` (по умолчанию `Lax`);
  рекомендуемый деплой — same-site (`app.<domain>` + `api.<domain>`) с `Lax`; `None; Secure` — только при cross-site.
  Блокировка: 5 неудачных входов → 15 мин (DECISIONS_v1_1 §12).
- **Ротация**: каждый `POST /auth/refresh` выдаёт новый refresh, старый получает `RevokedAt` + `ReplacedByTokenId`.
  **Повторное использование отозванного токена → отзыв всей семьи** (`FamilyId`) + запись аудита.
- При перезагрузке страницы SPA вызывает `/auth/refresh`; logout отзывает токен и чистит cookie.
- Пароли: `PasswordHasher` ASP.NET Core (PBKDF2) или Argon2 — выбор backend-агента; политика ≥ 8 символов, буква + цифра.
- Rate limit логина 5/мин на IP+email → 429; lockout через `FailedLoginCount`/`LockoutUntil`.
- SignalR: токен через `?access_token=`; query-строку не логировать.
- CSRF: refresh/logout работают по cookie → проверять `Origin` по CORS allowlist; остальные эндпоинты
  требуют Bearer-заголовок (cookie для них не используется).
- Восстановление пароля: `forgot-password` всегда 202; токены сброса/приглашения — тоже только hash в БД.

## Альтернативы

- **Cookie-сессия (ASP.NET Identity cookies)** — проще, но сложнее для SignalR, мобильных клиентов и cross-site.
- **JWT + refresh в localStorage** — запрещено ТЗ (XSS-кража).
- **Долгий JWT без refresh** — нельзя отозвать.

## Последствия / риски

- **Cross-site cookie**: при `*.vercel.app` ↔ `api.other-host.com` cookie считается сторонним; Safari (ITP) и
  режимы блокировки сторонних cookie в других браузерах его отбрасывают → refresh перестаёт работать, пользователь
  разлогинивается при перезагрузке. **Рекомендация:** собственный домен с поддоменами одного site —
  `app.<domain>` (Vercel) и `api.<domain>` (backend); тогда cookie same-site, можно `SameSite=Lax`.
  Связано с User-Todo T7 (домен) и T3 (хостинг).
- Access token теряется при закрытии вкладки — ожидаемо; refresh восстанавливает сессию.
- Нужна фоновая очистка просроченных `RefreshToken`.
