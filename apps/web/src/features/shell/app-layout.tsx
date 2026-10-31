import { Outlet, useRouterState } from '@tanstack/react-router';
import { MenuIcon, XIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { RequireLogin } from '@/features/auth/require-login';
import { useMe } from '@/features/auth/use-me';
import { PromptProvider } from '@/features/prompt/prompt-provider';
import { SupportBanner } from '@/features/support/support-banner';
import { useT } from '@/lib/i18n';
import { AppSidebar } from './app-sidebar';

/** Alle Seiten des Rahmens brauchen einen Login; ohne ihn erscheint die Anmeldung. */
export function AppLayout() {
  return (
    <RequireLogin>
      <PromptProvider>
        <Shell />
      </PromptProvider>
    </RequireLogin>
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
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle className="sr-only">{t.app.navigation}</SheetTitle>
              <AppSidebar
                onNavigate={closeNav}
                headerAction={
                  <SheetClose asChild>
                    <Button variant="ghost" size="icon" aria-label={t.app.closeNavigation}>
                      <XIcon />
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
          <ContentGate />
        </main>
      </div>
    </div>
  );
}

/**
 * Zeigt die Seite nur, wenn die Organisation sie freigibt (PLT-02). Ohne Organisation erscheint nur
 * der Hinweis, ohne Feature buyer der Hinweis zum Lieferantenzugang. Die Einstellungen bleiben
 * immer erreichbar. Was die Person sehen darf, entscheidet die API über /me.
 */
function ContentGate() {
  const t = useT();
  const me = useMe();
  const onSettings = useRouterState({
    select: (state) => state.location.pathname === '/einstellungen',
  });

  // Solange /me lädt oder scheitert, entscheiden die Seiten selbst (Lade- und Fehlerzustand).
  if (!me.data || onSettings) return <Outlet />;

  if (!me.data.organization) {
    return (
      <Notice>
        {me.data.permissions.switchCustomer ? t.support.chooseCustomer : t.organization.missing}
      </Notice>
    );
  }
  if (!me.data.permissions.viewBuyerAreas)
    return <Notice>{t.organization.supplierAccessSoon}</Notice>;
  return <Outlet />;
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-lg bg-warning-soft px-4 py-3 text-warning-soft-foreground">
      {children}
    </p>
  );
}
