/**
 * Shown by the gateway when no built web app is bundled (`web-dist/` missing — a developer checkout before
 * `npm run build:web`). Never part of an installer: `npm run dist` builds the web app first.
 * It has no script and is served with the same Content-Security-Policy as the real web app.
 */
const PLACEHOLDER_STYLE = [
  'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#0f172a;',
  'font:16px/1.5 "Segoe UI",system-ui,sans-serif}',
  'main{max-width:34rem;padding:2rem}',
  'h1{margin:0 0 1rem;font-size:1.5rem;color:#e85d2a}',
  'p{margin:.5rem 0}',
  'code{padding:.1rem .35rem;border-radius:.25rem;background:#e2e8f0;font-family:Consolas,monospace}',
  '@media (prefers-color-scheme:dark){body{background:#0f172a;color:#e2e8f0}code{background:#334155}}',
].join('');

export const PLACEHOLDER_HTML = Buffer.from(
  [
    '<!doctype html>',
    '<html lang="ru">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>RestaurantOS</title>',
    `<style>${PLACEHOLDER_STYLE}</style>`,
    '</head>',
    '<body>',
    '<main data-testid="desktop-placeholder">',
    '<h1>RestaurantOS</h1>',
    '<p lang="ru">Веб-приложение не собрано: выполните <code>npm run build:web</code> в папке respos-desktop.</p>',
    '<p lang="uz">Veb-ilova yig‘ilmagan: respos-desktop papkasida <code>npm run build:web</code> buyrug‘ini bajaring.</p>',
    '<p lang="en">The web app is not built: run <code>npm run build:web</code> in respos-desktop.</p>',
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n'),
  'utf8',
);
