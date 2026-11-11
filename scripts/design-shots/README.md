# design-shots — isolated stack + before/after capture

Tools for the visual redesign: an isolated test stack and a capture harness that writes comparable
screenshots and short interaction clips for a label (`before`, `after`, …).

## Stack (`stack.mjs`)

Never touches the default dev ports. Postgres container `respos-design-pg` :5435, API :5082,
admin :5183, landing :5184. Processes run detached; logs and the pid file are in `D:/tmp/design`
(`DESIGN_STACK_DIR`).

```bash
node scripts/design-shots/stack.mjs up        # idempotent, waits until everything answers
node scripts/design-shots/stack.mjs status    # exit code 1 when something is down
node scripts/design-shots/stack.mjs down      # stops API + Vite servers and the container (data kept)
node scripts/design-shots/stack.mjs down api  # one process only (api | admin | landing), then `up` again
node scripts/design-shots/stack.mjs down --purge   # also removes the container and its data
```

The Vite dev servers hot-reload CSS/TSX edits; only backend changes need `down api` + `up`.
After a fresh database run the API scenario once so the screens have content:
`cd scripts/e2e && E2E_API_URL=http://localhost:5082/api/v1 node e2e-smoke.mjs`.

## Capture (`capture.mjs`)

Uses the Playwright installed in `scripts/ui-smoke` (run `npm install` there once; Chromium via
`PLAYWRIGHT_BROWSERS_PATH`).

```bash
node scripts/design-shots/capture.mjs before                       # everything
node scripts/design-shots/capture.mjs after --only admin-dashboard,toast   # some ids (manifest is merged)
node scripts/design-shots/capture.mjs after --screens              # or --clips; --headed shows the browser
node scripts/design-shots/pairs.mjs                                 # before/after pairs -> redesign/pairs.json
```

Output: `docs/design/assets/redesign/<label>/` — `<id>--<theme>.png`, `<id>.webm` and `manifest.json`
(`id, kind, title, group, viewport, theme, file`). Screenshots of failed entries go to
`D:/tmp/design/failed-shots`; the run exits with code 1 when anything failed.

- Screens are listed in `screens.mjs`, clips in `clips.mjs`, sessions and viewports in `lib.mjs`.
- Elements are found by role / label / text (and the `data-testid` / `data-status` attributes the
  test suites already use), so the harness survives a visual redesign as long as texts, roles and
  aria-labels stay.
- Each role logs in once; sessions are saved in `scripts/design-shots/.auth/<role>.json` (gitignored)
  and chained: the refresh token rotates on every page load, so never run two captures in parallel.
  Login is rate limited (5/min per e-mail); every run does one API login as the owner to prepare data.
- Light and dark shots are taken in one page through `prefers-color-scheme` (the stored theme
  preference stays "system"). KDS is always dark. The landing site has a light theme only.
- A run prepares demo data only when it is missing (takeaway orders with the comment `design-shots`:
  KDS tickets in every column, an unpaid order for the cashier) and registers one shared device
  ("Design shots tablet") for the lock screen. The KDS clip moves one ticket to "in progress" per run.
- Clips record only the interaction (`page.screencast`), pointer-driven on purpose; open dialogs are
  closed with their close button, not Escape.
