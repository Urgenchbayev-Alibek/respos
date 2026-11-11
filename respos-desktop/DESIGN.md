# respos-desktop — design brief (Electron shell for RestaurantOS)

Owner request (2026-11-10): ship the existing web app (`respos-admin`) as a Windows desktop program (exe).
Decision: **Electron** (not Tauri) — the machine has no Rust/MSVC toolchain, and Electron gives silent thermal
printing (`webContents.print({ silent, deviceName })`), which a POS needs. Record this in ADR-0016.

## Deliverables

- `respos-desktop/` — Electron app (TypeScript strict, ESLint, every source file ≤ 500 lines).
- `RestaurantOS-Setup-<version>.exe` (NSIS, per-user, no admin rights) and `RestaurantOS-<version>-portable.exe`
  in `respos-desktop/release/` (gitignored). Product name `RestaurantOS`, appId `uz.respos.desktop`.
- Works against ANY RestaurantOS backend: the server address is entered on first run (no rebuild per restaurant).

## Architecture: loopback gateway

```
Electron main ──► LocalGateway (node:http, 127.0.0.1:<port>)
                    ├─ static: built respos-admin SPA (resources/web-dist), SPA fallback → index.html
                    └─ reverse proxy → <serverUrl>:  /api/*  /hubs/* (HTTP + WebSocket upgrade)  /files/*  /health/*
BrowserWindow (sandboxed renderer) loads http://127.0.0.1:<port>/
```

Why: the SPA and the API become **same-origin** for the renderer, so the httpOnly refresh cookie
(`SameSite=Lax`, path `/api/v1/auth`), SignalR and file URLs work exactly as in the browser, with no CORS
allow-list entry and no `SameSite=None`. The backend is NOT modified.

Gateway rules:
- Bind `127.0.0.1` only. Preferred fixed port **47615** (stable origin keeps localStorage: theme, branch, device
  settings); if busy → random free port (log a warning; cookies are host-scoped so the session survives).
- Validate `Host` header (`127.0.0.1:<port>` / `localhost:<port>`) → otherwise 403 (DNS-rebinding guard).
- Proxy: stream request/response bodies (multipart photo upload, SSE/long-polling fallback), keep status and
  headers, set `Host` to the backend host, drop `Origin`/`Referer` toward the backend (the hop is not a browser),
  rewrite `Set-Cookie` (remove `Secure` and `Domain`; keep `HttpOnly`, `Path`, `Max-Age/Expires`; force
  `SameSite=Lax`) because the loopback hop is plain http. Forward `Cookie` unchanged. WebSocket upgrade for
  `/hubs/*` is tunnelled (socket piping) with the same header rules.
- Backend unreachable / timeout → `502` with ProblemDetails JSON `{ "status":502, "code":"desktop.server_unreachable",
  "title":"Server unreachable" }` (the SPA already retries refresh on 5xx and shows a connection toast).
- `https://` backends: normal certificate validation (never `rejectUnauthorized: false`).
- Static: correct MIME types, `index.html` `Cache-Control: no-cache`, hashed assets `immutable`; path traversal safe.

## Web app build for desktop (`respos-admin`, small additive changes)

- `env.ts`: `VITE_API_BASE_URL` / `VITE_HUB_URL` may be root-relative (`/api/v1`, `/hubs/restaurant`); resolve
  them against `window.location.origin` at startup so the rest of the code still gets absolute URLs
  (`api-client.ts` uses `new URL(...)`). Absolute URLs keep working (web/Vercel builds unchanged).
- `VITE_DESKTOP=true` build flag: no service worker / PWA registration in desktop builds (the shell updates the
  bundled files itself; a SW would serve stale assets after an upgrade). Web builds unchanged.
- Print bridge: `shared/ui/PrintArea/print-controller.ts` is the single print entry point → when
  `window.resposDesktop` exists call `resposDesktop.print({ paper })`, else `window.print()` (cleanup of the
  print layout must wait for the promise). Types in `src/shared/types/desktop.d.ts`.
- User menu: item «Настройки подключения» (visible only in desktop) → `resposDesktop.openConnectionSettings()`.
- Known web bug to fix while here: the API returns relative file URLs (`/files/...`, see
  `LocalFileStorage`), but the SPA renders `<img src={photoUrl}>` directly, which resolves against the SPA
  origin when SPA and API are on different origins. Add ONE helper (API origin + relative path) and use it
  wherever such URLs are rendered (admin; check `respos-landing` QR menu too).

## `window.resposDesktop` contract (preload, `contextBridge`)

```ts
interface ResposDesktopApi {
  readonly isDesktop: true;
  readonly appVersion: string;
  /** Opens the native connection-settings window (server address, printer, kiosk, autostart). */
  openConnectionSettings(): Promise<void>;
  /** Prints the current page; the web app has already applied its @media print layout.
   *  Silent to the configured printer when enabled in desktop settings, otherwise the system dialog. */
  print(options?: { paper?: 'receipt-80mm' | 'a4' }): Promise<{ ok: true } | { ok: false; reason: string }>;
}
declare global { interface Window { resposDesktop?: ResposDesktopApi } }
```

Nothing else is exposed. IPC: fixed channel allow-list, argument validation in main, sender-origin check
(only the gateway origin / the bundled settings page may call their channels).

## Shell behaviour

- First run / unreachable server → **connection window** (bundled local HTML, strict CSP, no remote content,
  RU / UZ / EN): server address (`http://192.168.1.10:5080`, `https://api.example.uz`), «Проверить соединение»
  (main requests `<serverUrl>/health/ready`, 5 s timeout, shows result), Save → gateway retargets, main window opens.
  Same window also holds: thermal printer (list from `webContents.getPrintersAsync()`), silent printing on/off,
  kiosk mode on/off, «Запускать при входе в Windows» (`app.setLoginItemSettings`).
- Settings file `%APPDATA%/RestaurantOS/settings.json` (serverUrl, printer, silentPrint, kiosk, autoStart,
  windowBounds) — schema-validated on load, atomic write, no secrets.
- Single-instance lock; remember window bounds; RU application menu (Файл: Настройки подключения, Перезагрузить,
  Выход · Вид: Во весь экран F11, Масштаб · Справка: О программе with version + server address).
- Kiosk: `--kiosk` flag or setting (for KDS screens); exit with Ctrl+Shift+Q.
- Security (Electron checklist): `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`,
  `webSecurity: true`; deny `window.open` (http/https links → system browser via validated `shell.openExternal`);
  block navigation away from the gateway origin; `setPermissionRequestHandler` deny by default (allow fullscreen);
  no `remote`; Electron fuses (RunAsNode off, NODE_OPTIONS off, asar integrity where supported).
- Silent print: `webContents.print({ silent: true, deviceName, margins: { marginType: 'none' }, pageSize })`
  with an 80 mm page for `receipt-80mm`; failure → `{ ok: false, reason }` and the web app falls back to the dialog.

## Scripts (`respos-desktop/package.json`, exact pinned versions)

`build:web` (build `../respos-admin` with `VITE_DESKTOP=true VITE_API_BASE_URL=/api/v1 VITE_HUB_URL=/hubs/restaurant
VITE_APP_ENV=production` → copy to `web-dist/`), `build` (main + preload), `dev`, `lint`, `typecheck`,
`test` (gateway unit tests: static + SPA fallback, proxy pass-through incl. streaming, Set-Cookie rewrite,
Host guard, 502 mapping, WebSocket tunnel), `e2e` (Playwright `_electron` against a running backend),
`dist` (build:web + build + electron-builder → `release/`).

Packaging pitfall: on Windows without the symlink privilege electron-builder can fail extracting `winCodeSign`
(darwin symlinks). Solve it robustly and document how. The exe is unsigned → SmartScreen warning; a code-signing
certificate is an owner TODO.

## Test backend for desktop work (do NOT use ports 5080/5173/5174 or the `respos` compose project —
another agent is running tests there and resets that database)

```bash
docker run -d --name respos-desktop-pg -e POSTGRES_DB=respos -e POSTGRES_USER=respos -e POSTGRES_PASSWORD=respos_dev -p 5434:5432 postgres:16-alpine
# API from THIS worktree, Development seed (demo users, password Demo123!), port 5081:
cd respos-backend && ASPNETCORE_ENVIRONMENT=Development \
  ConnectionStrings__DefaultConnection="Host=localhost;Port=5434;Database=respos;Username=respos;Password=respos_dev" \
  dotnet run --project src/Restaurant.Api --no-launch-profile --urls http://localhost:5081
```

Login rate limit: 5/min per IP+email — reuse sessions in tests.

## Environment rules (Windows; drive C: is limited)

Set for every command: `TEMP`/`TMP=D:\tmp\desktop`, `npm_config_cache=D:\tmp\npm-cache`,
`ELECTRON_CACHE=D:\tmp\electron-cache`, `ELECTRON_BUILDER_CACHE=D:\tmp\electron-builder-cache`,
`PLAYWRIGHT_BROWSERS_PATH=D:\tmp\pw-browsers`.
