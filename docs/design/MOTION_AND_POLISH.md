# Motion and Polish — RestaurantOS

One design-language update distilled from six surface audits (UI kit, shell, ops, admin pages, landing,
public phone pages). It supersedes the "Иконки и движение" line of `DESIGN_SYSTEM.md` (120–200ms ease-out)
and that file's toast placement. Product rules win over taste, accessibility wins over polish.

Sources of craft: emil-design-eng, apple-design, improve-animations, choreograph. Stack: CSS Modules +
custom properties, `@starting-style`, `transition-behavior: allow-discrete`, Web Animations API.
No new runtime dependency.

## 1. Principles

1. **Speed beats decoration.** A POS is used all day. Anything seen 100+ times a shift does not animate.
2. **Feedback lands on pointer-down.** Every pressable has an `:active` state that applies in 0ms.
   Release may ease; press-in never does.
3. **Motion is spent only where it explains something**: where a surface came from (overlay), that an
   event happened that the user did not cause (new KDS ticket, reconnecting), or that a rare action
   succeeded (booking, demo request, call waiter).
4. **Layout never moves under the finger.** Selected states do not change border width or font weight,
   loaders reserve their space, numbers use tabular figures.
5. **Enter eased, exit instant** (admin app). The user has already decided; unmount stays synchronous so
   tests and focus return are untouched. The only animated exits are the toast and the landing mobile menu.
6. **One token set, two apps.** Curves, durations and press scales have identical names in
   `respos-admin` and `respos-landing`.
7. **Restraint for low-end tablets.** Transform and opacity only, no blur in the admin app, no
   per-frame paint or layout animation.

### Frequency map

| Class | Rule | Surfaces in this product |
|---|---|---|
| **High** (100+/day) | No transition on the action. Colour swap on `:active` at 0ms, no transform on burst-tapped cells | Waiter: menu tile tap (+1), `QuantityStepper`, category chips, table tiles, modifier choices, guest-count options, `ItemOptionsSheet` / `GuestCountDialog` / `ItemCommentModal` opening. KDS: Start / Ready / Served, per-item status buttons, station toggles. Cashier: payment method keys, exact-amount key, bill tiles, payable order rows, `1/2/3`, `Enter`, `F2`, `/`. Everywhere: PIN keys, sidebar links, workspace tabs, bottom nav, `Tabs`, table sort, pagination, search typing, input focus, row-action menus opened from the keyboard |
| **Frequent** (tens/day) | Hover colour 150ms (pointer devices only), instant press; no entrance | Period presets (`.segment`), order status chips, DataTable rows, dashboard cards, schedule cells, settings links, sidebar collapse |
| **Occasional** | Standard short entrance (150–250ms), instant exit | `Modal`, `ConfirmDialog`, `Drawer`, phone bottom sheet, `DropdownMenu` opened by pointer, notifications bell panel, toasts, reconnecting dot, new KDS ticket ring |
| **Rare** | May carry delight | Wrong-PIN shake, landing hero, landing section reveal, FAQ accordion, landing mobile menu, demo-request success, booking success, call-waiter confirmation |

## 2. Motion tokens

Identical names and values in `respos-admin/src/shared/ui/theme/tokens.css` (the `:root, [data-theme='kds']`
block) and `respos-landing/src/app/styles/global.css` (`:root`).

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);       /* entrances, press release, anything user-triggered */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);   /* on-screen movement and pulses */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);    /* drawer, bottom sheet */
--duration-press: 100ms;   /* release of a press scale (press-in is always 0ms) */
--duration-fast: 150ms;    /* hover colour, dropdown, popover, tooltip, switch thumb, fades */
--duration-base: 200ms;    /* modal, toast, landing mobile menu, accordion, scrim */
--duration-slow: 250ms;    /* drawer, bottom sheet */
--duration-exit: 150ms;    /* the few animated exits */
--press-scale: 0.97;       /* buttons */
--press-scale-wide: 0.985; /* lg and full-width buttons */
--press-scale-icon: 0.95;  /* icon buttons, burger */
--stagger-step: 40ms;      /* admin: reserved, no admin surface staggers today. landing: 80ms */
```

Landing-only extension: `--duration-reveal: 600ms` (hero and scroll reveal). Admin keeps
`--transition: 150ms ease` as an alias for hover colour only; never use it for movement.

Hard rules: never `ease-in`, never `transition: all`, never `scale(0)` (minimum 0.96), exact property
lists, transform and opacity for movement (colour, background-color, border-color, box-shadow only for
hover, press and focus). No animation above 300ms in the admin app.

| Element class | Duration | Curve |
|---|---|---|
| Press release | `--duration-press` | `--ease-out` |
| Hover colour, switch thumb | `--duration-fast` | `ease` / `--ease-out` |
| Dropdown, popover, tooltip | `--duration-fast` | `--ease-out` |
| Modal, toast, scrim, accordion | `--duration-base` | `--ease-out` |
| Drawer, bottom sheet | `--duration-slow` | `--ease-drawer` |
| Landing hero, reveal | 400–700ms | `--ease-out` |

## 3. Component specs

### 3.1 Buttons and pressables

Two press classes. Both apply on `:active`, never on `click`.

**P-scale** — discrete actions: `Button`, `IconButton`, KDS `.btn` / `.itemBtn`, topbar triggers, landing
`Button` and burger.

```css
.button {
  transition: transform var(--duration-press) var(--ease-out),
    background-color var(--duration-fast) ease, border-color var(--duration-fast) ease, color var(--duration-fast) ease;
}
.button:active:not(:disabled) { transform: scale(var(--press-scale)); transition-duration: 0ms; }
.lg:active:not(:disabled), .fullWidth:active:not(:disabled) { transform: scale(var(--press-scale-wide)); }
.primary:active:not(:disabled) { background: var(--color-primary-strong-hover); }
.secondary:active:not(:disabled), .ghost:active:not(:disabled) { background: var(--color-pressed); }
.danger:active:not(:disabled) { background: var(--color-danger-hover); }
```

`IconButton`: same transition, `transform: scale(var(--press-scale-icon)); background: var(--color-pressed); color: var(--color-text)`.
New token `--color-pressed: color-mix(in srgb, var(--color-text) 12%, var(--color-surface))` (works in
light, dark and KDS). Landing: `--color-pressed: #f1f5f9`.

**P-color** — burst-tapped or edge-sharing cells: menu tiles, category chips, stepper, table tiles, PIN
keys, staff tiles, payment method keys, bill tiles, order rows, KDS toggles, nav links, tabs, bottom nav,
segments, chips, booking slots, table rows, menu items. `background: var(--color-pressed)` (or the darker
brand fill for selected/primary cells) at 0ms, **no transform**. Release is instant, except the menu tile
and PIN keys which fade back over 150ms so a 40ms tap leaves a visible trace.

Keyboard shortcuts trigger programmatic clicks, so `:active` never fires: the keyboard path has no motion.

Sizes: `sm` reads `--control-height-sm` (30px admin with a mouse; 44px in waiter / cashier / stock, on KDS
and under `pointer: coarse`). KDS per-item status buttons are 56px high. Loading is unchanged: the spinner
replaces the icon and the label stays visible (as `DESIGN_SYSTEM.md` requires).

Hover: every `:hover` rule sits inside `@media (hover: hover) and (pointer: fine)`.

### 3.2 Inputs

`transition: border-color var(--duration-fast) ease` for hover only. Focus is instant
(`.control:focus, .control:focus-visible { transition: none; }`): outline `2px solid var(--color-focus)`,
`outline-offset: -1px`, `border-color: var(--color-focus)`. Under `pointer: coarse` text is
`max(16px, 1em)` and the control is 44px high. Numeric, time and date inputs use `tabular-nums`.
Validation messages never animate.

### 3.3 Modal

```css
.overlay { transition: background-color var(--duration-base) var(--ease-out); }
.panel {
  transform-origin: center; box-shadow: var(--shadow-lg);
  max-height: calc(100vh - 2 * var(--space-4)); max-height: calc(100dvh - 2 * var(--space-4));
  transition: opacity var(--duration-base) var(--ease-out), transform var(--duration-base) var(--ease-out);
}
.body { overscroll-behavior: contain; }
@starting-style { .overlay { background-color: transparent; } .panel { opacity: 0; transform: scale(0.96); } }
.overlay[data-motion='instant'], .overlay[data-motion='instant'] .panel { transition: none; }
```

Exit: instant unmount. `motion="instant"` (prop → `data-motion`) is mandatory for dialogs inside a
high-frequency loop: `ItemOptionsSheet`, `GuestCountDialog`, `ItemCommentModal`.

### 3.4 Drawer and bottom sheet

Drawer: `.panel { transition: transform var(--duration-slow) var(--ease-drawer); box-shadow: var(--shadow-lg); }`,
scrim fades like the modal, `@starting-style { .right { transform: translateX(100%); } .left { transform: translateX(-100%); } }`,
`.body { overscroll-behavior: contain; }`. Exit instant (an animated exit needs delayed unmount in a shared
dialog; deferred, see §9).

Bottom sheet = `Modal` at `max-width: 767px`: `max-height: 92dvh` (after the `92vh` fallback),
`.panel { transition: transform var(--duration-slow) var(--ease-drawer); }`,
`@starting-style { .panel { opacity: 1; transform: translateY(100%); } }`,
`.footer { padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom, 0px)); }`. No drag-to-dismiss.

### 3.5 Dropdown and popover (origin-aware)

```css
.menu {
  transition: opacity var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out);
  max-height: 60vh; max-height: 60dvh; overscroll-behavior: contain;
}
.start { transform-origin: top left; }
.end { transform-origin: top right; }
@starting-style { .menu { opacity: 0; transform: scale(0.97); } }
.menu[data-instant] { transition: none; }
```

`data-instant` is set when the menu was opened from the keyboard (ArrowDown, or a click with
`event.detail === 0`). Items never stagger. Close is instant. Notifications bell panel: same recipe,
`transform-origin: top right`, `scale(0.96)`; at ≤767px it becomes `position: fixed` under the topbar with
`transform-origin: top center`.

### 3.6 Tooltip

No tooltip component exists (native `title` only). Do not build one in this pass. If one is added:
`opacity` + `scale(0.97)` over 125ms `--ease-out`, origin at the trigger, 400ms open delay for the first
tooltip, 0ms delay and no transition for the next ones (`data-instant`), instant close, never on touch.

### 3.7 Toast

Transitions, not keyframes; enters and exits along the edge its stack lives on.

```css
.toast { transition: opacity var(--duration-base) var(--ease-out), transform var(--duration-base) var(--ease-out); }
@starting-style { .toast { opacity: 0; transform: translateY(100%); } }
.toast[data-closing] { opacity: 0; transform: translateY(100%); transition-duration: var(--duration-exit); pointer-events: none; }
@media (max-width: 767px) {
  .region { top: calc(var(--space-2) + env(safe-area-inset-top, 0px)); bottom: auto; left: var(--space-3); right: var(--space-3); width: auto; flex-direction: column-reverse; }
  @starting-style { .toast { transform: translateY(-100%); } }
  .toast[data-closing] { transform: translateY(-100%); }
}
```

Desktop: bottom right. Phones: top, so the bottom navigation and "Send to kitchen" stay reachable.
Removal waits for the exit transition via `element.getAnimations()`; when that returns nothing (jsdom,
unsupported) the toast is removed synchronously. Auto-dismiss timers pause on hover, focus and while the
tab is hidden (`ACCESSIBILITY.md` §8). Close button hit area 44×44px via `::after { inset: -12px; }`.

### 3.8 Tabs, segmented controls, chips

Instant. No sliding indicator, no panel transition (arrow-key driven). Selected state = colour +
background / 2px edge, never a weight change that resizes the tab. Overflowing tab rows get a
scroll-driven 32px edge mask (`animation-timeline: scroll(self inline)`, position-driven, not time-driven).

### 3.9 Switch and checkbox

Switch: thumb `transition: transform var(--duration-fast) var(--ease-out)`, track
`transition: background-color var(--duration-fast) ease`; off track `var(--color-text-subtle)` (≥3:1);
hit area 44×44px via `.track::after { inset: -11px -2px; }`. Checkbox: native `accent-color`, no animation;
under `pointer: coarse` the row gets `padding-block: 10px` (44px).

### 3.10 Skeleton and spinner

Skeleton: hidden for the first 200ms (`DESIGN_SYSTEM.md` "skeleton after 200ms"), then a compositor-only
sweep: `.skeleton::after { transform: translateX(-100%); animation: shimmer 1.2s linear 200ms infinite; }`
with `@keyframes shimmer { to { transform: translateX(100%); } }`. Never animate `background-position`.
Spinner: `spin 0.7s linear infinite` (landing 0.6–0.7s). Route-level loader (`.page`) fades in after 200ms
(`loader-in 150ms var(--ease-out) 200ms both`) so fast chunks never flash it.

### 3.11 Table rows, cards, lists

No entrance, no stagger, no sort / pagination / refetch transition, no count-up. Rows: hover background
on pointer devices; `.clickable:active { background: var(--color-pressed); }`. Cards are static: border +
`--shadow-sm`, no hover lift (a lift promises a click target). Stale data during a refetch may dim to
`opacity: 0.55` after a 120ms delay (dashboard period switch) — opacity only.

### 3.12 Sidebar and topbar

Sidebar collapse is instant (the `width` transition is deleted). Sidebar list: 24px bottom mask fade,
`overscroll-behavior: contain`. Topbar and bottom nav are opaque surfaces with a 1px border. Navigation
links: P-color press, active = `--color-primary-subtle` fill; bottom nav active = semibold + 2px top bar.
Connection dot: filled (online), pulsing `800ms var(--ease-in-out) infinite alternate` (reconnecting /
connecting only), hollow ring (offline).

### 3.13 Page-level transitions

**None.** Route changes are instant in both apps. No view transitions, no content fade, no tab-panel
motion. The only route-level motion is the delayed loader (§3.10).

### 3.14 Landing hero and section reveals

Hero: one-shot CSS, `animation-fill-mode: both`, `var(--ease-out)`, individual `translate` property
(composes with the existing `rotate`). CTAs are clickable from their first frame; done by ~920ms.

| Element | Role | Starts | Duration | Motion | Relationship |
|---|---|---|---|---|---|
| `.title` | Lead | 0ms | 600ms | fade + 12px rise | — |
| `.eyebrow` | Decoration | 0ms | 400ms | fade only | together with title |
| `.lead` | Support | 80ms | 500ms | fade + 8px rise | overlaps title |
| `.mainMock` | Support | 100ms | 700ms | fade + 16px rise | overlaps title |
| `.ctas` | Support | 140ms | 500ms | fade + 6px rise | overlaps lead |
| `.points` | Decoration | 190ms | 500ms | fade only | overlaps CTAs |
| `.floatMock` | Support | 320ms | 600ms | fade + 24px rise | lands after the dashboard (order → kitchen) |

Does not move: header, hero background, modules grid (10 tiles), role cards, pricing cards, features
page, language switch, burger icon, validation errors.

Scroll reveal (once, `IntersectionObserver`, only after JS confirms it can reveal): `.showcaseItem` and
`.step`: `opacity 0 → 1` and `translate: 0 16px → 0` over `--duration-reveal` `--ease-out`,
`transition-delay: calc(var(--i) * var(--stagger-step))` (i = 0, 1, 2) at ≥1024px only.
FAQ accordion: `::details-content` block-size + opacity 200ms `--ease-out`, chevron on the same clock.
Mobile menu: opacity + `translateY(-8px)` 200ms in, 150ms out (`display` with `allow-discrete`).
Success states (demo, booking): container fade 200–250ms, icon `scale(0.9) → 1` 300–400ms, no bounce.
QR menu: call-waiter feedback rises 4px over 200ms; chips and search results never animate.

## 4. What must NOT animate

- Adding a dish, quantity changes, cart lines appearing, totals updating.
- KDS tickets changing column or status; timers; column counters.
- Payment keys, payment success, cash change, any number (no count-up, no flip).
- Table tiles and their status changes on the floor plan.
- Keyboard-initiated actions: shortcuts, Tab focus, arrow-key menus, search typing, focus rings.
- Route changes, tab changes, sort, pagination, list refetch, DataTable rows, dashboard card entrance.
- Sidebar collapse, bottom nav, workspace tabs, language switch.
- `ItemOptionsSheet`, `GuestCountDialog`, `ItemCommentModal` (instant even though Modal animates).
- Charts (`isAnimationActive={false}` stays), sparklines, form validation, slot selection, category jump.
- Hover lifts on non-interactive cards; anything looping while idle on a healthy screen.

## 5. Typography

Inter, weights 400/500/600/700 only (never `800`; it is not loaded).

| Size | Tracking | Leading | Where |
|---|---|---|---|
| ≥40px display (landing) | -0.028em to -0.03em | 1.08–1.1 | hero, page titles |
| 26–36px | -0.024em | 1.15 | landing section titles, CTA |
| 22–28px | -0.02em | 1.15–1.2 | `PageHeader`, `StatCard` value, KDS title/clock, table number, status page |
| 20–23px | -0.017em | 1.2–1.25 | auth title, amount due, order grand total |
| 16–19px titles | -0.011em to -0.014em | 1.25–1.3 | modal / drawer / empty-state / card titles, dish names |
| 14–16px body | 0 | 1.5 (admin) / 1.6 (landing) | text |
| 11–12px caps and tab-bar labels | +0.04em caps, +0.01em labels | 1.2 | table headers, bottom nav |

- `h1–h4 { text-wrap: balance; }`, paragraphs `text-wrap: pretty` (landing, empty states, descriptions).
- Tabular figures for money, time and counters: inherited in the waiter, cashier, kitchen and stock
  workspaces; at component level in `DataTable`, `StatCard`, `Pagination`, `StatusBadge`, numeric inputs,
  topbar triggers, notification badge, landing mocks, prices, time slots.
- Font-size tokens derive from `--font-size-base` with `calc()` so nested components stop compounding
  (`0.786 × 0.857 × 14px = 9.4px` today).
- Selected / active states keep the same weight as their unselected state unless the box is fixed-width.

## 6. Depth and materials

- **Borders for resting surfaces, shadows for floating ones.** Cards, tables, inputs: 1px border +
  `--shadow-sm`. Dropdown, toast, bell panel: `--shadow-md`. Modal, drawer, sheet: new `--shadow-lg`.
- `--shadow-lg: 0 24px 48px -12px rgb(15 23 42 / 0.25), 0 8px 16px -8px rgb(15 23 42 / 0.12)`; in dark and
  KDS `0 0 0 1px rgb(255 255 255 / 0.08), 0 24px 48px -12px rgb(0 0 0 / 0.6)` (shadows do not read on dark,
  the hairline ring does).
- **Admin app: no `backdrop-filter`, no translucent chrome.** Topbar, sidebar, bottom nav, KDS header are
  solid. Low-end kitchen and waiter tablets pay for blur on every scroll frame.
- Scroll edges use `mask-image` fades (sidebar list, category chips, tab rows), never blur.
- Pinned bars cast their shadow toward the content: the waiter order footer and the QR call bar use an
  upward shadow.
- **Landing only**: translucent sticky header (`rgb(255 255 255 / 0.82)` + `blur(16px) saturate(180%)` on a
  `::before` layer), QR category bar (86% + `blur(12px)`), QR call bar (90% + `blur(16px)`). Each has a
  solid fallback under `@supports not (backdrop-filter: blur(1px))` and `prefers-reduced-transparency`.
- Landing mocks: `--shadow-md` by default, `--shadow-lg` only for the hero pair.

## 7. Accessibility policy

- **Focus**: one indicator everywhere — `outline: 2px solid var(--color-focus); outline-offset: 2px`, no
  transition. `--color-focus`: `#2563eb` light (5.2:1), `#93c5fd` dark (~9:1), `#ffffff` on KDS at 3px.
  Landing: `#2563eb`, and `#ffffff` inside the footer, CTA banner and primary contact card.
  `--focus-ring` stays as a box-shadow form of the same ring
  (`0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-focus)`) for containers that draw focus with
  `:focus-within` and for existing call sites. Outline survives forced-colors and is not overridden by
  selected-state shadows.
- **prefers-reduced-motion**: the global blanket stays as the safety net and gains
  `animation-iteration-count: 1` (admin), `animation-delay: 0s; transition-delay: 0s` (landing) and
  `scroll-behavior: auto`. Overlays that move (modal, sheet, drawer, toast, dropdown, bell panel, landing
  menu) override it with a 150ms opacity fade and `transform: none`. Spinner becomes an opacity pulse
  (`1s ease-in-out infinite alternate`, 1 → 0.35); skeleton is static; KDS ticket ring, PIN shake and the
  reconnecting pulse do not run; hero and reveals appear together with no delay.
- **prefers-reduced-transparency**: every translucent landing surface becomes solid, blur removed.
- **prefers-contrast / forced-colors**: nothing relies on shadow alone — focus is an outline, selected
  states carry a border or inset edge, status carries text or shape (hollow / filled / pulsing dot).
- **Hover gating**: all hover styles behind `@media (hover: hover) and (pointer: fine)`.
- **Targets**: ≥44px in waiter, cashier, stock, KDS (status buttons 56px) and wherever `pointer: coarse`;
  small glyph buttons get invisible hit areas. Portaled dialogs and toasts inherit workspace density
  because the workspace attributes are mirrored on `<body>`.
- **Contrast**: input borders and switch tracks ≥3:1, feedback text ≥4.5:1 (`--color-success-text #166534`).
- Nothing blinks faster than 3Hz; no idle loops on a healthy screen.

## 8. Mobile-native rules

All apps:
- `html { -webkit-tap-highlight-color: transparent; }`; `touch-action: manipulation` on links, buttons,
  labels, summaries, tabs, switches, menu items; `user-select: none` + `-webkit-touch-callout: none` on
  controls only, never on body text.
- `viewport-fit=cover`; never `user-scalable=no` or `maximum-scale`. `theme-color` matches the top bar
  (`#ffffff` light, `#162032` dark, `#111a2e` KDS; landing `#ffffff`).
- `100dvh` after every `100vh` fallback (landing shell: `100svh`). `env(safe-area-inset-*)` on fixed bars,
  sheet footers and horizontal page padding.
- Inputs ≥16px on touch. `overscroll-behavior: contain` on every inner scroller (modal body, drawer body,
  menus, bill lines, chips).

Waiter: bottom nav is the thumb zone — nothing covers it (toasts go to the top on phones); "Send to
kitchen" is sticky above the bottom nav at ≤900px; category chips contain horizontal overscroll so a swipe
never triggers browser back; `html, body { overscroll-behavior-y: none; }` so pull-to-refresh cannot wipe
an unsent cart; topbar keeps the branch label readable and turns clock-in / switch-user into icon buttons.

Cashier: keyboard-first on desktop, touch on tablets — both paths instant; tabs wrap to a second topbar
row between 768 and 1023px instead of scrolling.

KDS: always dark, 20px base, wall-mounted and touched with wet fingers — press feedback from the glass
(0ms), 56px status buttons, 3px white focus outline, portaled toasts in the KDS palette.

Public pages (QR menu, booking): documents, so pull-to-refresh stays; restaurant identity scrolls away and
the 60px category bar is pinned instead; call bar is 88px from 340px width up and respects the home
indicator; chips and slots are 44px with instant colour press; a failed booking submit moves focus to the
first invalid field.

## 9. Implementation plan

Five partitions with disjoint paths. `foundation` runs first; the others depend on its tokens
(`--ease-*`, `--duration-*`, `--press-scale*`, `--color-pressed`, `--color-focus`, `--control-height-sm`,
`--shadow-lg`) and on `Modal`'s `motion` prop.

| Partition | Paths |
|---|---|
| foundation | `respos-admin/src/shared/ui/**` |
| shell | `respos-admin/index.html`, `respos-admin/vite.config.ts`, `respos-admin/src/app/**`, `src/widgets/**`, `src/pages/{auth,device,errors}/**`, `src/features/{shared-device,notifications,auth}/**`, `src/shared/lib/theme.ts` |
| ops | `src/pages/{waiter,kitchen,cashier}/**`, `src/features/{waiter-order,kitchen,cashier,floor,split-bill,order-actions,payments,cash-shifts,customers,waiter-calls}/**` |
| admin | `src/pages/{admin,stock,platform,delivery,profile}/**`, all remaining `src/features/*/**` |
| landing | `respos-landing/index.html`, `respos-landing/src/**` |

Rules for every executor: keep texts, aria-labels, roles, data attributes, routes and DOM structure;
CSS Modules only; each file ≤500 lines; if a step does not match the code found, make the smallest
equivalent change and report it. Verify with `npm run lint && npm run typecheck && npm run test` in the
touched app, then feel-check at 10% playback speed and with reduced motion emulated.

### Decisions on conflicting or dropped audit items

| Item | Decision |
|---|---|
| Focus ring: three variants (blue outline, blue shadow, saffron shadow) | Blue `outline` per `ACCESSIBILITY.md` §4; `--focus-ring` kept as an alias. This also fixes the cashier selected-order ring (OPS-07) |
| `sm` controls: real 44px vs 36px + invisible hit area | Real size through `--control-height-sm` |
| PIN keys: scale 0.96 vs colour only | Colour only — burst taps get no movement |
| Dropdown: animate vs stay instant | 150ms origin-aware for pointer opens, instant for keyboard opens |
| Toast on phones: top vs offset above bottom nav | Top |
| Spinner under reduced motion: slower spin vs pulse | Opacity pulse |
| Drawer animated exit (delayed unmount) | Deferred: lifecycle change in a shared dialog, not worth the test and focus risk tonight |
| Button loading overlay / icon slot | Deferred: hiding the label contradicts `DESIGN_SYSTEM.md`, and a wrapper span is a DOM change in the most-used component |
| `interactive-widget=resizes-content` | Dropped: changes keyboard layout behaviour |
| Auth `.page` font-size override | Superseded by the `pointer: coarse` control rules |
| Edge masks on DataTable and delivery board | Dropped for this pass; sticky first columns kept |
| Rejected by the audits and confirmed here | Route transitions, sliding tab indicator, staggered sidebar / menu / list items, card entrance and count-up, chart draw-in, KDS ticket move animation, cart-line insertion, table-ready pulse, payment flourish, translucent admin topbar, auth-card entrance, badge pop, offline-banner slide, swipe-to-close drawer, smooth-scroll chips, animated slot selection |

Needs a real device (cannot be confirmed in emulation): double-tap zoom, sticky hover, safe areas, iOS
input zoom and date input, `dvh`, pull-to-refresh. Contrast ratios were hand-calculated; re-check with a tool.

## 10. Known gaps

Left after the review of this pass (low severity, not trivial to fix safely in one evening):

- **Two success entrances on the landing.** `DemoForm` uses keyframes (200ms fade, 400ms pop, 350ms tick
  draw); `BookingForm` uses `@starting-style` transitions (250ms rise, 300ms icon). Unify on the
  `BookingForm` recipe and decide whether both keep the tick draw.
- **Tabs edge fade** animates registered custom properties that feed `mask-image` (paint work on scroll, not
  compositor-only). Bounded: the timeline is inactive unless the row overflows. Measure on a mid-range tablet;
  if frames drop, switch to two sticky gradient overlays driven by `opacity`.
- **Reduced motion on the landing** relies on the global 0.01ms rule for `heroRise`, the success keyframes
  and the scroll reveal: they jump to the end state rather than cross-fade.
- **Toast stack FLIP** starts from layout positions, so a second shift that arrives inside the 200ms settle
  restarts from the new offset rather than from the on-screen one. Toast auto-dismiss pauses on hover and
  focus through pointer and focus events only; there is no swipe-to-dismiss.
- **Selected segments and chips** (`.segmentActive`, order status chip `.on`) still switch to semibold when
  selected; section 5 asks selected states to keep their weight.
- **Modal and drawer exits** are still an instant unmount (see the decisions table above).
- **Not verified on hardware:** safe areas, `dvh`, iOS input zoom and date input, double-tap zoom, sticky
  hover, the feel of `:active` states, forced-colors rendering of the outline ring, touch-target sizes of
  cashier and waiter at 768px, contrast of pressed and selected colours in dark and KDS themes (calculated,
  not measured).

