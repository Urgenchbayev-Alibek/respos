import { useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { OfflineBanner } from './pwa/OfflineBanner';
import { PwaUpdatePrompt } from './pwa/PwaUpdatePrompt';
import { AppProviders } from './providers/AppProviders';
import { createAppRouter } from './router/router';

/**
 * Service worker: production web builds only. The desktop shell build (`VITE_DESKTOP=true`) never registers one —
 * the shell ships and replaces the app files itself. Both flags are build-time constants, so the prompt and the
 * registration code are dropped from bundles that do not use them.
 */
const SERVICE_WORKER_ENABLED = import.meta.env.PROD && import.meta.env.VITE_DESKTOP !== 'true';

export function App() {
  const [router] = useState(createAppRouter);
  return (
    <AppProviders>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
      <OfflineBanner />
      {SERVICE_WORKER_ENABLED && <PwaUpdatePrompt />}
    </AppProviders>
  );
}
