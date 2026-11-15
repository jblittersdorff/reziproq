import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from 'react-oidc-context';
import { reportLogin } from './lib/api';
import { oidcConfig, safeReturnTo, zitadelSettings } from './lib/auth';
import { LocaleProvider } from './lib/i18n';
import { routeTree } from './routeTree.gen';
import './index.css';

const queryClient = new QueryClient();

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
});

// Macht die Routen im ganzen Projekt typsicher bekannt.
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Ohne Zitadel-Werte in der .env startet die App ohne Login und erklärt das auf der Startseite.
const authConfig =
  zitadelSettings &&
  oidcConfig({
    settings: zitadelSettings,
    origin: window.location.origin,
    // Code und State aus der Adresse entfernen und zur ursprünglich angefragten Seite wechseln.
    onSigninCallback: (user) => {
      if (user) void reportLogin(user.access_token);
      const returnTo = (user?.state as { returnTo?: unknown } | undefined)?.returnTo;
      router.history.replace(safeReturnTo(returnTo));
    },
  });

const app = (
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Element #root fehlt in index.html');

createRoot(rootElement).render(
  <StrictMode>
    <LocaleProvider>
      {authConfig ? <AuthProvider {...authConfig}>{app}</AuthProvider> : app}
    </LocaleProvider>
  </StrictMode>,
);
