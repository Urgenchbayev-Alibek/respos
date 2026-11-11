import type { ResposDesktopApi } from '@/shared/types/desktop';

/** The desktop shell bridge (`window.resposDesktop`), or `null` when the app runs in a browser. */
export function getDesktopApi(): ResposDesktopApi | null {
  return window.resposDesktop ?? null;
}
