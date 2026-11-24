import { useQuery } from '@tanstack/react-query';
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { SettingsIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { AppShell } from '@/components/ui/app-shell';
import { RequireLogin } from '@/features/auth/require-login';
import { useMe } from '@/features/auth/use-me';
import { useToken } from '@/features/ratings/use-rating';
import { SupportBanner } from '@/features/support/support-banner';
import { ApiError, dueQueryOptions } from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';
import { LocalBarSlotProvider } from './local-bar-slot';
import { type NavTarget, routerLink, useActiveNavKey, useNavTargets } from './navigation';
import { StageSlotProvider } from './stage-slot';

/** Alle Seiten des Rahmens brauchen einen Login; ohne ihn erscheint die Anmeldung. */
export function AppLayout() {
  return (
    <RequireLogin>
      <Shell />
    </RequireLogin>
  );
}

/**
 * Rahmen nach NAV-10 1.1 (UX-20 `AppShell`): ab 761 px Seitenleiste mit den Hauptpunkten,
 * Einstellungen und Person, darunter die Tab-Leiste mit fünf Zielen. Darin die lokale Leiste eines
 * Lieferanten (falls die Seite eine hat), die Bühne und der Inhalt.
 */
function Shell() {
  const t = useT();
  const { main, actions } = useNavTargets();
  const activeKey = useActiveNavKey();
  const me = useMe();
  const accessToken = useToken();
  const buyer = !!me.data?.permissions.viewBuyerAreas;
  const due = useQuery({ ...dueQueryOptions(accessToken), enabled: buyer && accessToken !== '' });
  const today = new Date().toISOString().slice(0, 10);
  const dueToday = due.data?.items.filter((item) => item.dueDate <= today).length ?? 0;
  const initials = me.data ? personInitials(me.data.name) : undefined;
  const [localBarSlot, setLocalBarSlot] = useState<HTMLDivElement | null>(null);
  const [stageSlot, setStageSlot] = useState<HTMLDivElement | null>(null);
  useQuestionsShortcut();
  useAccountLocale();

  const icon = (target: NavTarget) => {
    const Icon = target.icon;
    return <Icon aria-hidden />;
  };
  const items = main.map((target) => ({
    key: target.key,
    label: target.label,
    href: target.href,
    icon: icon(target),
    ...(target.key === 'myDay' && dueToday > 0 ? { badge: dueToday } : {}),
  }));
  const questions = actions.find((target) => target.key === 'questions');
  const profile = actions.find((target) => target.key === 'profile');

  return (
    <LocalBarSlotProvider value={localBarSlot}>
      <StageSlotProvider value={stageSlot}>
        {/* Erstes Tab-Ziel: springt an der Navigation vorbei direkt zum Inhalt. */}
        <a
          href="#inhalt"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-background focus:px-4 focus:shadow-md focus:outline-none focus:ring-3 focus:ring-ring/50"
        >
          {t.app.skipToContent}
        </a>
        <AppShell
          label={t.app.navigation}
          tabsLabel={t.app.tabNavigation}
          brand={t.app.name}
          brandHref="/"
          {...(questions
            ? {
                search: {
                  key: 'questions',
                  label: t.nav.searchOrAsk,
                  href: questions.href,
                  shortcut: '⌘K',
                },
              }
            : {})}
          items={items}
          {...(buyer || me.data?.permissions.viewOrganizationSettings
            ? {
                settings: {
                  key: 'settings',
                  label: t.nav.settings,
                  href: '/einstellungen',
                  icon: <SettingsIcon aria-hidden />,
                },
              }
            : {})}
          {...(me.data && initials
            ? {
                person: {
                  initials,
                  name:
                    me.data.organization && !buyer
                      ? `${me.data.name} · ${me.data.organization.name}`
                      : me.data.name,
                  href: profile?.href ?? '/profil',
                  label: t.nav.profile,
                },
              }
            : {})}
          tabs={[
            ...items,
            ...(questions
              ? [
                  {
                    key: 'questions',
                    label: t.nav.ask,
                    href: questions.href,
                    icon: icon(questions),
                  },
                ]
              : []),
          ]}
          activeKey={activeKey}
          renderLink={routerLink}
        >
          {/* Betreiber-Ansicht (PLT-13): schmale Leiste ganz oben über dem Inhalt; neben der
              Seitenleiste, damit diese so hoch bleibt wie der Bildschirm. */}
          <SupportBanner />
          {/* Lokale Leiste eines Lieferanten (NAV-06); leer auf allen anderen Seiten. */}
          <div ref={setLocalBarSlot} className="contents" />
          <main id="inhalt" tabIndex={-1} className="flex w-full flex-col outline-none">
            {/* Bühne über die ganze Breite (PLT-10); leer auf Seiten ohne Bühne. */}
            <div ref={setStageSlot} className="contents" />
            <div className="mx-auto flex w-full min-w-0 max-w-300 flex-col gap-8 px-4 py-6 sm:px-10 shell:py-8 [&>*]:min-w-0">
              <ContentGate />
            </div>
          </main>
        </AppShell>
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
  const { setLocale, setCategoryLabel } = useLocale();
  const saved = me.data?.locale;
  useEffect(() => {
    if (saved) setLocale(saved);
  }, [saved, setLocale]);
  // WG-01: Bezeichnung der Warengruppe der Organisation
  const label = me.data?.categoryLabel;
  useEffect(() => {
    if (label) setCategoryLabel(label);
  }, [label?.singular, label?.plural, label, setCategoryLabel]);
}

/** Cmd+K (Mac) oder Strg+K öffnet von jeder Seite die Fragen-Seite, wie Spotlight (PLT-12). */
function useQuestionsShortcut() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        // NAV-10: Auf der Seite eines Lieferanten hat die Frage ihn als Kontext.
        const lieferant = /^\/lieferanten\/([0-9a-f-]{36})(?:\/|$)/.exec(pathname)?.[1];
        void navigate({ to: '/fragen', search: lieferant ? { lieferant } : {} });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, pathname]);
}

/** Profil, Einstellungen, Menü und die Kundenwahl der Betreiber gehen auch ohne Organisation. */
const alwaysOpen = ['/profil', '/einstellungen', '/menu', '/betreiber'];

/** Was die Lieferantenseite sieht (LIF-02); alles andere gehört dem Käufer. */
const supplierPaths = ['/start', '/kunden', '/fragen', '/feedback'];

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

  // IN-02: Anmeldung über das Firmenkonto abgelehnt (falscher Mandant, nur SSO …): klarer Hinweis
  const rejection =
    me.error instanceof ApiError ? (me.error.body as { code?: string } | null)?.code : undefined;
  const rejected = rejection ? t.organization.signInRejected[rejection] : undefined;
  if (rejected) return <Notice>{rejected}</Notice>;
  // Solange /me lädt oder scheitert, entscheiden die Seiten selbst (Lade- und Fehlerzustand).
  if (!me.data && within(['/mein-tag', '/uebersicht']))
    return <Notice>{me.isError ? t.user.failed : t.user.loading}</Notice>;
  if (!me.data || open) return <Outlet />;

  if (!me.data.organization) {
    return (
      <Notice>
        {me.data.permissions.switchCustomer ? t.support.chooseCustomer : t.organization.missing}
      </Notice>
    );
  }
  // IN-02: über die Firmen-Domain angelegt; bis zur Freigabe nur dieser Hinweis
  if (me.data.pendingApproval) return <Notice>{t.organization.pendingApproval}</Notice>;
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
