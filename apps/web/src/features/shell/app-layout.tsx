import { useQuery } from '@tanstack/react-query';
import { Outlet, useRouter, useRouterState } from '@tanstack/react-router';
import { SettingsIcon } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/ui/app-shell';
import { AskOverlay } from '@/components/ui/ask-overlay';
import { ReauthNotice } from '@/features/auth/reauth-notice';
import { RequireLogin, useRenewalFailed } from '@/features/auth/require-login';
import { useMe } from '@/features/auth/use-me';
import { AskContext, type AskRequest } from '@/features/prompt/ask-context';
import { AskPanel } from '@/features/prompt/ask-panel';
import { useToken } from '@/features/ratings/use-rating';
import { SupportBanner } from '@/features/support/support-banner';
import { ApiError, todayQueryOptions } from '@/lib/api';
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
 * Rahmen nach NAV-10 2.0 (UX-20 `AppShell`): ab 761 px Seitenleiste mit den Hauptpunkten, „Im
 * Hintergrund“, Mein Agent, Einstellungen und Person, bis 760 px die Tab-Leiste (Käufer fünf Ziele,
 * Lieferant drei). Darin die lokale Leiste eines Lieferanten (falls die Seite eine hat), die Bühne
 * und der Inhalt.
 */
function Shell() {
  const t = useT();
  const { main, agent, actions } = useNavTargets();
  const activeKey = useActiveNavKey();
  const me = useMe();
  const accessToken = useToken();
  const buyer = !!me.data?.permissions.viewBuyerAreas;
  // HE-01: Zahl an Heute = offene Fokus-Themen; dazu der Lauf, an dem Reziproq gerade arbeitet.
  const today = useQuery({
    ...todayQueryOptions(accessToken),
    enabled: !!me.data?.organization && accessToken !== '',
  });
  const openFocus = today.data?.openFocus ?? 0;
  const running = today.data?.background;
  const initials = me.data ? personInitials(me.data.name) : undefined;
  const [localBarSlot, setLocalBarSlot] = useState<HTMLDivElement | null>(null);
  const [stageSlot, setStageSlot] = useState<HTMLDivElement | null>(null);
  // NAV-10 2.0: Frag Reziproq liegt als Überlagerung über der Seite (E-K0-01), nicht als eigene Seite.
  const ask = useAskState();
  const openAsk = ask.open;
  // UMB-02: Die Überlagerung sperrt die Seite; der Hinweis zum neu Anmelden steht dann auch darin.
  const renewalFailed = useRenewalFailed();
  useAskShortcut(openAsk);
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
    ...(target.key === 'myDay' && openFocus > 0 ? { badge: openFocus } : {}),
  }));
  const questions = actions.find((target) => target.key === 'questions');
  const profile = actions.find((target) => target.key === 'profile');
  const questionsTab = questions
    ? [
        {
          key: 'questions',
          label: t.nav.ask,
          href: questions.href,
          icon: icon(questions),
          onSelect: () => openAsk(askContextOf(window.location.pathname)),
        },
      ]
    : [];
  // TN-02: Käufer Heute, Beziehungen, Frag, Warengruppen, Wert; Lieferant Heute, Kunden, Frag.
  const tabs = buyer
    ? [...items.slice(0, 2), ...questionsTab, ...items.slice(2)]
    : [...items, ...questionsTab];

  return (
    <AskContext.Provider value={openAsk}>
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
                    onOpen: () => openAsk(askContextOf(window.location.pathname)),
                  },
                }
              : {})}
            items={items}
            {...(running
              ? {
                  background: {
                    label: t.nav.background(
                      running.counterpart
                        ? `${running.task} · ${running.counterpart}`
                        : running.task,
                    ),
                    href: '/mein-agent',
                  },
                }
              : {})}
            footer={
              agent
                ? [{ key: agent.key, label: agent.label, href: agent.href, icon: icon(agent) }]
                : []
            }
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
            tabs={tabs}
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
          <AskOverlay
            open={ask.isOpen}
            onClose={ask.close}
            title={t.prompt.title}
            closeLabel={t.app.close}
          >
            {renewalFailed && <ReauthNotice />}
            <AskPanel
              initialQuestion={ask.request.question}
              supplier={ask.request.supplier}
              customer={ask.request.customer}
            />
          </AskOverlay>
        </StageSlotProvider>
      </LocalBarSlotProvider>
    </AskContext.Provider>
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

/**
 * NAV-10 TN-08: Die Frage auf der Seite einer Beziehung hat sie als Kontext; beim Lieferanten der
 * Kunde, in dem er gerade ist (QS-05).
 */
export function askContextOf(pathname: string): AskRequest {
  const supplier = /^\/(?:lieferanten|beziehungen)\/([0-9a-f-]{36})(?:\/|$)/.exec(pathname)?.[1];
  const customer = /^\/kunden\/([0-9a-f-]{36})(?:\/|$)/.exec(pathname)?.[1];
  return { ...(supplier ? { supplier } : {}), ...(customer ? { customer } : {}) };
}

/** Cmd+K (Mac) oder Strg+K öffnet Frag Reziproq über jeder Seite, wie Spotlight (NAV-10 TN-08). */
function useAskShortcut(open: (request: AskRequest) => void) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open(askContextOf(pathname));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, pathname]);
}

/**
 * Links auf Frag Reziproq (früher /fragen, TN-07): `?frag` öffnet die Überlagerung über der Seite,
 * mit `q` als Frage und `lieferant` bzw. `kunde` als Kontext. Die Angaben verschwinden danach aus der
 * Adresse, damit Neuladen und Zurück die Frage nicht noch einmal stellen.
 */
/** Adresse mit geändertem Suchteil, ohne den Router zu fragen (Frag Reziproq, `?frag`) */
function withSearch(
  location: { pathname: string; searchStr: string; hash: string },
  change: (params: URLSearchParams) => void,
) {
  const params = new URLSearchParams(location.searchStr);
  change(params);
  const query = params.toString();
  return `${location.pathname}${query ? `?${query}` : ''}${location.hash ? `#${location.hash}` : ''}`;
}

/**
 * Frag Reziproq ist offen, solange die Adresse `?frag` trägt (NAV-10 2.0, E-K0-01): Zurück schließt
 * die Überlagerung, ein Link und die Rückkehr nach der Neuanmeldung (UMB-02) öffnen sie wieder.
 * `q`, `lieferant` und `kunde` eines Links (früher /fragen, TN-07) werden Frage und Kontext und
 * verschwinden danach aus der Adresse, damit Neuladen die Frage nicht noch einmal stellt.
 */
function useAskState() {
  const router = useRouter();
  const location = useRouterState({ select: (state) => state.location });
  const search = location.search as Record<string, unknown>;
  const isOpen = 'frag' in search;
  const [request, setRequest] = useState<AskRequest>({});
  // Selbst geöffnet: Schließen geht einen Schritt zurück, sonst wird nur ?frag entfernt.
  const pushed = useRef(false);

  const open = useCallback(
    (next: AskRequest = {}) => {
      setRequest(next);
      const current = router.state.location;
      if ('frag' in (current.search as Record<string, unknown>)) return;
      pushed.current = true;
      router.history.push(withSearch(current, (params) => params.set('frag', '1')));
    },
    [router],
  );

  const close = useCallback(
    (reason?: 'link') => {
      const current = router.state.location;
      if (!('frag' in (current.search as Record<string, unknown>))) return;
      // Ein Link in der Antwort führt gleich weiter; Zurück würde ihn überholen.
      if (pushed.current && reason !== 'link') {
        pushed.current = false;
        router.history.back();
        return;
      }
      pushed.current = false;
      router.history.replace(withSearch(current, (params) => params.delete('frag')));
    },
    [router],
  );

  useEffect(() => {
    if (!isOpen) {
      pushed.current = false;
      setRequest({});
      return;
    }
    const text = (value: unknown) =>
      typeof value === 'string' && value.trim() ? value : undefined;
    const link = {
      question: text(search.q),
      supplier: text(search.lieferant),
      customer: text(search.kunde),
    };
    if (!link.question && !link.supplier && !link.customer) return;
    setRequest(link);
    router.history.replace(
      withSearch(location, (params) => {
        for (const key of ['q', 'lieferant', 'kunde']) params.delete(key);
      }),
    );
  }, [isOpen, search.q, search.lieferant, search.kunde, location, router]);

  return { isOpen, request, open, close };
}

/** Profil, Einstellungen, Menü und die Kundenwahl der Betreiber gehen auch ohne Organisation. */
const alwaysOpen = ['/profil', '/einstellungen', '/menu', '/betreiber'];

/** Was die Lieferantenseite sieht (LIF-02); alles andere gehört dem Käufer. */
const supplierPaths = ['/heute', '/start', '/kunden', '/feedback'];

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
  if (!me.data && within(['/heute', '/wert']))
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
