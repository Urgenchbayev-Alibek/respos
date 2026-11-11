/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** Absolute URL, or a root-relative path (`/api/v1`) when the API is served from the page origin. */
  readonly VITE_API_BASE_URL?: string;
  /** Absolute URL, or a root-relative path (`/hubs/restaurant`). */
  readonly VITE_HUB_URL?: string;
  readonly VITE_LANDING_URL?: string;
  readonly VITE_APP_ENV?: string;
  /** `true` = build for the desktop shell (`respos-desktop`): no service worker / PWA. */
  readonly VITE_DESKTOP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
