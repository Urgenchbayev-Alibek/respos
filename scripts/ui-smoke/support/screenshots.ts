import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { SCREENSHOT_DIR } from './env';

/**
 * Saves a documentation screenshot to docs/design/assets/screenshots/<name>.png (viewport only, keeps files small).
 * Disabled with UI_SCREENSHOTS=0.
 */
export async function shot(page: Page, name: string): Promise<void> {
  if (process.env.UI_SCREENSHOTS === '0') return;
  const dir = fileURLToPath(SCREENSHOT_DIR);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: `${dir}${name}.png`,
    fullPage: false,
    animations: 'disabled',
    caret: 'hide',
    // Toasts from earlier steps would cover the content.
    style: '[class*="_toast_"] { visibility: hidden !important; }',
  });
}
