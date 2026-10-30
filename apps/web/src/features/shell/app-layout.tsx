import { IconMenu2, IconX } from '@tabler/icons-react';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  AuthChecking,
  AuthFailed,
  AuthNotConfigured,
  AuthPage,
  SignIn,
} from '@/features/auth/auth-states';
import { ReauthNotice } from '@/features/auth/reauth-notice';
import { useMe } from '@/features/auth/use-me';
import { PromptProvider } from '@/features/prompt/prompt-provider';
import { SupportBanner } from '@/features/support/support-banner';
import { signedOut, signInState, zitadelSettings } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { AppSidebar } from './app-sidebar';

/** Alle Seiten des Rahmens brauchen einen Login; ohne ihn erscheint die Anmeldung. */
export function AppLayout() {
  // Ohne Zitadel-Werte gibt es keinen AuthProvider, also auch kein useAuth.
  if (!zitadelSettings) {
    return (
      <AuthPage>
        <AuthNotConfigured />
      </AuthPage>
    );
  }
  return <AuthGate />;
}

function AuthGate() {
  const t = useT();
  const auth = useAuth();
  // Nach dem Abmelden zeigt die App „Anmelden“, statt sofort wieder zu Zitadel zu leiten (PLT-01).
  const [justSignedOut] = useState(() => signedOut.isSet());
  const redirecting = useRef(false);
  const here = useRouterState({ select: (state) => state.location.href });

  // Ohne Sitzung (auch nach dem Neuladen, die Tokens liegen nur im Speicher) geht es direkt zu
  // Zitadel; danach zurück auf genau diese Seite.
  const needsLogin =
    !auth.isLoading && !auth.error && !auth.user && !auth.activeNavigator && !justSignedOut;
  useEffect(() => {
    if (!needsLogin || redirecting.current) return;
    redirecting.current = true;
    void auth.signinRedirect({ state: signInState(here) });
  }, [needsLogin, auth, here]);

  const signIn = () => {
    signedOut.clear();
    void auth.signinRedirect({ state: signInState(here) });
  };

  // Bis die Anmeldung abgeschlossen ist, nur der ruhige Ladezustand, nie Inhalte. Ist schon jemand
  // angemeldet (z. B. Neuanmeldung im Popup), bleibt die Seite stehen, damit nichts verloren geht.
  if (!auth.user && (auth.isLoading || needsLogin || auth.activeNavigator)) {
    return (
      <AuthPage>
        <AuthChecking />
      </AuthPage>
    );
  }
  if (!auth.user) {
    return (
      <AuthPage>
        {auth.error ? (
          <AuthFailed action={<Button onClick={signIn}>{t.auth.retry}</Button>} />
        ) : (
          <SignIn onSignIn={signIn} />
        )}
      </AuthPage>
    );
  }
  // Erneuerung gescheitert: Seite bleibt stehen, darüber der Hinweis zum neu Anmelden.
  const renewalFailed = auth.user.expired || auth.error?.source === 'renewSilent';
  return (
    <PromptProvider>
      <Shell />
      {renewalFailed && <ReauthNotice />}
    </PromptProvider>
  );
}

function Shell() {
  const t = useT();
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = () => setNavOpen(false);

  return (
    <div className="flex min-h-svh">
      {/* Erstes Tab-Ziel: springt an der Navigation vorbei direkt zum Inhalt. */}
      <a
        href="#inhalt"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-background focus:px-4 focus:shadow-md focus:outline-none focus:ring-3 focus:ring-ring/50"
      >
        {t.app.skipToContent}
      </a>

      {/* Breite Fenster: feste Seitenleiste mit leichtem Glas-Effekt */}
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 bg-muted/90 backdrop-blur sidebar:block">
        <AppSidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Schmale Fenster: Seitenleiste eingeklappt, Menü-Knopf blendet sie ein */}
        <header className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 px-2 py-2 backdrop-blur sidebar:hidden">
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t.app.openNavigation}>
                <IconMenu2 />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle className="sr-only">{t.app.navigation}</SheetTitle>
              <AppSidebar
                onNavigate={closeNav}
                headerAction={
                  <SheetClose asChild>
                    <Button variant="ghost" size="icon" aria-label={t.app.closeNavigation}>
                      <IconX />
                    </Button>
                  </SheetClose>
                }
              />
            </SheetContent>
          </Sheet>
          <span className="font-semibold text-base">{t.app.name}</span>
        </header>

        <main
          id="inhalt"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 outline-none sm:px-8 sidebar:py-12"
        >
          <SupportBanner />
          <MissingOrganizationNotice />
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Hinweis auf allen Seiten, solange die Person keiner Organisation zugeordnet ist (PLT-02). */
function MissingOrganizationNotice() {
  const t = useT();
  const me = useMe();
  if (!me.data || me.data.organization) return null;
  return (
    <p role="status" className="rounded-lg bg-warning-soft px-4 py-3 text-warning-soft-foreground">
      {me.data.permissions.switchCustomer ? t.support.chooseCustomer : t.organization.missing}
    </p>
  );
}
