# RestaurantOS — public website (`respos-landing`)

Marketing site for RestaurantOS: home, features/modules, pricing (informational), FAQ, contacts,
demo request form, privacy/terms drafts. Static SPA, deployed to Vercel.

Stack: React 18.3 + TypeScript (strict) + Vite, React Router 6, i18next (RU primary, UZ Latin, EN placeholder),
CSS Modules + CSS custom properties, lucide-react, @fontsource/inter, Vitest + Testing Library.

## Run locally

```bash
cp .env.example .env.local   # adjust URLs if needed
npm install
npm run dev                  # http://localhost:5174
```

The demo form posts to `${VITE_API_BASE_URL}/public/demo-requests`; pricing optionally reads
`${VITE_API_BASE_URL}/public/plans` and falls back to static text if the API is unavailable.
The backend must allow this site's origin in CORS (`Frontend__AllowedOrigins`).

## Environment variables

Only public, non-secret values (everything in `VITE_*` ends up in the browser bundle):

| Variable | Example | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:5080/api/v1` | Backend API base (incl. `/api/v1`) |
| `VITE_ADMIN_APP_URL` | `http://localhost:5173` | Target of the "Войти" link (RestaurantOS web app) |
| `VITE_PUBLIC_BRANCH_SLUG` | `demo` (default) | Public branch slug for online reservations on `/booking` (same as the QR menu slug; empty → "not connected" notice) |

## Quality checks

```bash
npm run lint        # ESLint (max-lines 500 enforced)
npm run typecheck   # tsc --noEmit
npm run test        # Vitest (demo form, language switch, routing smoke, phone helpers)
npm run build       # typecheck + production build to dist/
npm run preview     # serve dist/ on :5174
```

## Deploy (Vercel)

1. Import the repo in Vercel, set **Root Directory** = `respos-landing`.
2. Framework preset: Vite (also defined in `vercel.json`); build `npm run build`, output `dist`.
3. Set `VITE_API_BASE_URL` and `VITE_ADMIN_APP_URL` separately for Preview and Production.
4. `vercel.json` contains the SPA rewrite (all routes → `index.html`) and basic security headers.
5. Before launch: replace `https://example.com` in `public/robots.txt` and `public/sitemap.xml`
   with the real domain, add an OG image, publish real contacts, and replace the legal drafts.

## Structure

```
src/
  app/        App, router (AppRoutes), Layout (skip link, header, main, footer), global styles/tokens
  pages/      one component per route
  widgets/    page sections: header, footer, hero, home, modules, features, pricing, faq, demo-form, legal, mockups
  shared/
    api/      fetch client (ProblemDetails errors) + public endpoints
    config/   env, routes
    i18n/     i18next setup, locales/{ru,uz,en}; UZ files are type-checked against RU keys
    lib/      phone mask/validation (+998), usePageMeta (title/description/OG), cx
    ui/       Button, Container, Section, Badge, Field, Logo
```

## Notes

- Payments/fiscalization are described honestly as manual/planned; integrations are not connected.
- Prices are not published ("Цены уточняются").
- Privacy policy and terms are placeholders marked "Черновик — требует юридической проверки".
- Uzbek (Latin) texts are best effort and need proofreading.
- Filled buttons use `--color-primary-strong` (#C2461A) instead of the brand saffron `#E85D2A`,
  because white text on `#E85D2A` has only ~3.5:1 contrast (WCAG AA needs 4.5:1).
