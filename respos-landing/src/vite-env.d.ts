/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ADMIN_APP_URL?: string;
  readonly VITE_PUBLIC_BRANCH_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
