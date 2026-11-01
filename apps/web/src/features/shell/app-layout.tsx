import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { type ReactNode, useEffect } from 'react';
import { GlobalBar } from '@/components/ui/global-bar';
import { RequireLogin } from '@/features/auth/require-login';
import { useMe } from '@/features/auth/use-me';
import { SupportBanner } from '@/features/support/support-banner';
import { useT } from '@/lib/i18n';
import { routerLink, useActiveNavKey, useNavTargets } from './navigation';

/** Alle Seiten des Rahmens brauchen einen Login; ohne ihn erscheint die Anmeldung. */
export function AppLayout() {
  return (
    <RequireLogin>
      <Shell />
    </RequireLogin>
  );
}

/** Globale Leiste oben (PLT-11), darunter der Inhalt mittig mit großzügigem Rand. */
function Shell() {
  const t = useT();
  const { main, actions } = useNavTargets();
  const activeKey = useActiveNavKey();
  useQuestionsShortcut();

  return (
    <div className="flex min-h-svh flex-col">
      {/* Erstes Tab-Ziel: springt an der Navigation vorbei direkt zum Inhalt. */}
      <a
        href="#inhalt"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-background focus:px-4 focus:shadow-md focus:outline-none focus:ring-3 focus:ring-ring/50"
      >
        {t.app.skipToContent}
      </a>

      <GlobalBar
        label={t.app.navigation}
        brand={t.app.name}
        brandHref="/start"
        items={main}
        actions={actions.map((action) => {
          const Icon = action.icon;
          return { ...action, icon: <Icon aria-hidden /> };
        })}
        activeKey={activeKey}
        menuHref="/menu"
        menuLabel={t.app.openMenu}
        renderLink={routerLink}
      />

      <main
        id="inhalt"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 outline-none sm:px-8 sidebar:py-12"
      >
        <SupportBanner />
        <ContentGate />
      </main>
    </div>
  );
}

/** Cmd+K (Mac) oder Strg+K öffnet von jeder Seite die Fragen-Seite, wie Spotlight (PLT-12). */
function useQuestionsShortcut() {
  const navigate = useNavigate();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        void navigate({ to: '/fragen' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);
}

/** Profil, Einstellungen, Menü und die Kundenwahl der Betreiber gehen auch ohne Organisation. */
const alwaysOpen = ['/profil', '/einstellungen', '/menu', '/betreiber'];

/**
 * Zeigt die Seite nur, wenn die Organisation sie freigibt (PLT-02). Ohne Organisation erscheint nur
 * der Hinweis, ohne Feature buyer der Hinweis zum Lieferantenzugang. Profil und Einstellungen
 * bleiben immer erreichbar. Was die Person sehen darf, entscheidet die API über /me.
 */
function ContentGate() {
  const t = useT();
  const me = useMe();
  const open = useRouterState({
    select: (state) =>
      alwaysOpen.some(
        (path) =>
          state.location.pathname === path || state.location.pathname.startsWith(`${path}/`),
      ),
  });

  // Solange /me lädt oder scheitert, entscheiden die Seiten selbst (Lade- und Fehlerzustand).
  if (!me.data || open) return <Outlet />;

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
