import { IconMenu2, IconX } from '@tabler/icons-react';
import { Outlet } from '@tanstack/react-router';
import { useState } from 'react';
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
import { zitadelSettings } from '@/lib/auth';
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

  if (auth.isLoading) {
    return (
      <AuthPage>
        <AuthChecking />
      </AuthPage>
    );
  }
  if (auth.error) {
    return (
      <AuthPage>
        <AuthFailed
          action={<Button onClick={() => void auth.signinRedirect()}>{t.auth.retry}</Button>}
        />
      </AuthPage>
    );
  }
  if (!auth.user || auth.user.expired) {
    return (
      <AuthPage>
        <SignIn onSignIn={() => void auth.signinRedirect()} />
      </AuthPage>
    );
  }
  return <Shell />;
}

function Shell() {
  const t = useT();
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = () => setNavOpen(false);

  return (
    <div className="flex min-h-svh">
      {/* Breite Fenster: feste Seitenleiste */}
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 bg-muted lg:block">
        <AppSidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Schmale Fenster: Seitenleiste eingeklappt, Menü-Knopf blendet sie ein */}
        <header className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 px-2 py-2 backdrop-blur lg:hidden">
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

        <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:px-8 lg:py-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
