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
import { DemoAuthProvider } from '@/features/demo/demo-auth';
import { startBusinessTime } from '@/lib/clock';
import { demoRestartHref, startupDemoRestart, startupDemoSession } from '@/lib/demo-session';

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

// DM-01 (K1-b.5): Fachzeit des Tabs nur in einer Demo-Sitzung, vor dem ersten Bild
startBusinessTime(startupDemoSession !== null);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Element #root fehlt in index.html');

// DM-01: Ist die Demo-Sitzung abgelaufen oder ist der Tab neu, startet die Demo als dieselbe Person
// neu und kehrt auf diese Seite zurück, statt zur Anmeldung zu führen. Bis dahin zeigt die App
// nichts, damit sie nicht zugleich die Anmeldung bei Zitadel beginnt. Nie auf der Seite, die die
// Demo startet, und nie mitten in einer Anmeldung bei Zitadel (/auth/…).
const restartPerson = /^\/(demo\/als|auth)\//.test(window.location.pathname)
  ? null
  : startupDemoRestart;
if (restartPerson) window.location.replace(demoRestartHref(restartPerson, window.location));
else
  createRoot(rootElement).render(
    <StrictMode>
      <LocaleProvider>
        {/* DM-01, E-K0-05: In einer Demo-Sitzung meldet die Demo-Person ohne Zitadel an */}
        {startupDemoSession ? (
          <DemoAuthProvider session={startupDemoSession}>{app}</DemoAuthProvider>
        ) : authConfig ? (
          <AuthProvider {...authConfig}>{app}</AuthProvider>
        ) : (
          app
        )}
      </LocaleProvider>
    </StrictMode>,
  );
