import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { type ReactNode, useEffect, useState } from 'react';
import { GlobalBar } from '@/components/ui/global-bar';
import { RequireLogin } from '@/features/auth/require-login';
import { useMe } from '@/features/auth/use-me';
import { SupportBanner } from '@/features/support/support-banner';
import { useLocale, useT } from '@/lib/i18n';
import { LocalBarSlotProvider } from './local-bar-slot';
import { routerLink, useActiveNavKey, useNavTargets } from './navigation';
import { StageSlotProvider } from './stage-slot';

/** Alle Seiten des Rahmens brauchen einen Login; ohne ihn erscheint die Anmeldung. */
export function AppLayout() {
  return (
    <RequireLogin>
      <Shell />
    </RequireLogin>
  );
}

/** Globale Leiste oben (PLT-11), darunter die Bühne, falls die Seite eine hat, und der Inhalt mittig. */
function Shell() {
  const t = useT();
  const { main, actions } = useNavTargets();
  const activeKey = useActiveNavKey();
  const me = useMe();
  const initials = me.data ? personInitials(me.data.name) : undefined;
  const [localBarSlot, setLocalBarSlot] = useState<HTMLDivElement | null>(null);
  const [stageSlot, setStageSlot] = useState<HTMLDivElement | null>(null);
  useQuestionsShortcut();
  useAccountLocale();

  return (
    <LocalBarSlotProvider value={localBarSlot}>
      <StageSlotProvider value={stageSlot}>
        <div className="flex min-h-svh flex-col">
          {/* Erstes Tab-Ziel: springt an der Navigation vorbei direkt zum Inhalt. */}
          <a
            href="#inhalt"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-background focus:px-4 focus:shadow-md focus:outline-none focus:ring-3 focus:ring-ring/50"
          >
            {t.app.skipToContent}
          </a>

          {/* Betreiber-Ansicht (PLT-13): schmale Leiste ganz oben, über der globalen Leiste. */}
          <SupportBanner />
          <GlobalBar
            label={t.app.navigation}
            brand={t.app.name}
            brandHref="/start"
            items={main}
            actions={actions.map((action) => {
              const Icon = action.icon;
              // Profil als Tinte-Kreis mit Mint-Initialen (Designsprache „Kopfleiste“).
              return {
                ...action,
                icon: <Icon aria-hidden />,
                ...(action.key === 'profile' && initials ? { initials } : {}),
              };
            })}
            activeKey={activeKey}
            menuHref="/menu"
            menuLabel={t.app.openMenu}
            renderLink={routerLink}
          />
          {/* Lokale Leiste eines Lieferanten (NAV-06); leer auf allen anderen Seiten. */}
          <div ref={setLocalBarSlot} className="contents" />

          <main id="inhalt" tabIndex={-1} className="flex w-full flex-col outline-none">
            {/* Bühne über die ganze Breite (PLT-10); leer auf Seiten ohne Bühne. */}
            <div ref={setStageSlot} className="contents" />
            <div className="mx-auto flex w-full max-w-300 flex-col gap-8 px-4 py-8 sm:px-12 sidebar:py-12">
              <ContentGate />
            </div>
          </main>
        </div>
      </StageSlotProvider>
    </LocalBarSlotProvider>
  );
}

/** Initialen einer Person aus Vor- und Nachname, z. B. „Anna Schmidt“ → „AS“. */
export function personInitials(name: string): string | undefined {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = [parts[0], parts.length > 1 ? parts[parts.length - 1] : undefined]
    .map((part) => part?.charAt(0).toLocaleUpperCase('de') ?? '')
    .join('');
  return letters || undefined;
}

/**
 * Die gespeicherte Sprache gilt, sobald /me geladen ist, auf jedem Gerät (PLT-09). Bis dahin zeigt
 * die App die Browsersprache.
 */
function useAccountLocale() {
  const me = useMe();
  const { setLocale } = useLocale();
  const saved = me.data?.locale;
  useEffect(() => {
    if (saved) setLocale(saved);
  }, [saved, setLocale]);
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

/** Was die Lieferantenseite sieht (LIF-02); alles andere gehört dem Käufer. */
const supplierPaths = ['/start', '/kunden'];

/**
 * Zeigt die Seite nur, wenn die Organisation sie freigibt (PLT-02). Ohne Organisation erscheint nur
 * der Hinweis, ohne Feature buyer der Hinweis zum Lieferantenzugang. Profil und Einstellungen
 * bleiben immer erreichbar. Was die Person sehen darf, entscheidet die API über /me.
 */
function ContentGate() {
  const t = useT();
  const me = useMe();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const within = (paths: string[]) =>
    paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const open = within(alwaysOpen);

  // Solange /me lädt oder scheitert, entscheiden die Seiten selbst (Lade- und Fehlerzustand).
  if (!me.data || open) return <Outlet />;

  if (!me.data.organization) {
    return (
      <Notice>
        {me.data.permissions.switchCustomer ? t.support.chooseCustomer : t.organization.missing}
      </Notice>
    );
  }
  if (!me.data.permissions.viewBuyerAreas) {
    // Lieferantenseite (LIF-02): Start und Kunden; Käuferadressen zeigen einen klaren Hinweis.
    if (me.data.permissions.viewCustomers && within(supplierPaths)) return <Outlet />;
    return (
      <Notice>
        {me.data.permissions.viewCustomers
          ? t.organization.buyerOnly
          : t.organization.supplierAccessSoon}
      </Notice>
    );
  }
  return <Outlet />;
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-lg bg-warning-soft px-4 py-3 text-warning-soft-foreground">
      {children}
    </p>
  );
}
