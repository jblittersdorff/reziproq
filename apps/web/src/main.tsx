import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from 'react-oidc-context';
import { oidcConfig, zitadelSettings } from './lib/auth';
import { LocaleProvider } from './lib/i18n';
import { ThemeProvider } from './lib/theme';
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
    storage: window.sessionStorage,
    // Code und State aus der Adresse entfernen und zur Übersicht wechseln.
    onSigninCallback: () => {
      void router.navigate({ to: '/uebersicht', replace: true });
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
    <ThemeProvider>
      <LocaleProvider>
        {authConfig ? <AuthProvider {...authConfig}>{app}</AuthProvider> : app}
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>,
);
