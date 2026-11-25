import type { AreaKey } from '@reziproq/shared';
import { useRouter, useRouterState } from '@tanstack/react-router';
import {
  BoxesIcon,
  BuildingIcon,
  ChartScatterIcon,
  CircleDotDashedIcon,
  FactoryIcon,
  HouseIcon,
  type LucideIcon,
  MessageCircleQuestionIcon,
  UserRoundIcon,
} from 'lucide-react';
import type { NavItem, RenderLink } from '@/components/ui/nav-link';
import { useMe } from '@/features/auth/use-me';
import { useT } from '@/lib/i18n';

// Ziele der Seitenleiste und der Tab-Leiste (NAV-10 2.0): beim Käufer Heute, Beziehungen,
// Warengruppen und Wert, darunter Mein Agent; beim Lieferanten Heute und Kunden (LP-01). Dazu
// Frag Reziproq und die Person. Leisten und Menüseite lesen von hier. Die Schlüssel behalten ihre
// Namen aus 1.1 (overview = Wert, myDay = Heute, suppliers = Beziehungen), NAV-10 erlaubt das.

export type NavKey =
  | AreaKey
  | 'overview'
  | 'myDay'
  | 'myAgent'
  | 'customers'
  | 'questions'
  | 'profile'
  | 'settings';

export interface NavTarget extends NavItem {
  key: NavKey;
  icon: LucideIcon;
}

/**
 * Welche Adressen zu welchem Ziel gehören; die längste passende gewinnt. Alte Adressen, die noch
 * Seiten haben (Tabelle in packages/shared/src/route-moves.ts), gehören zu ihrem neuen Ziel.
 */
const sections = (
  [
    // Heute; bis K1-e liegen Alle Aufgaben, Maßnahmen, Hinweise und Neu eingegangen noch darunter.
    { prefix: '/heute', key: 'myDay' },
    { prefix: '/mein-tag', key: 'myDay' },
    { prefix: '/start', key: 'myDay' },
    { prefix: '/hinweise', key: 'myDay' },
    // HE-01: Kurz prüfen und Erledigt gehören zu Heute
    { prefix: '/kurz-pruefen', key: 'myDay' },
    { prefix: '/erledigt', key: 'myDay' },
    { prefix: '/warum', key: 'myDay' },
    { prefix: '/mappe', key: 'myDay' },
    { prefix: '/beziehungen', key: 'suppliers' },
    { prefix: '/lieferanten', key: 'suppliers' },
    { prefix: '/portfolio', key: 'suppliers' },
    { prefix: '/warengruppen', key: 'materialGroups' },
    { prefix: '/wert', key: 'overview' },
    { prefix: '/uebersicht', key: 'overview' },
    { prefix: '/wirkung', key: 'overview' },
    { prefix: '/mein-agent', key: 'myAgent' },
    { prefix: '/kunden', key: 'customers' },
    { prefix: '/profil', key: 'profile' },
    { prefix: '/einstellungen', key: 'settings' },
  ] satisfies { prefix: string; key: NavKey }[]
).sort((a, b) => b.prefix.length - a.prefix.length);

export function activeNavKey(pathname: string): NavKey | undefined {
  return sections.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    ?.key;
}

export function useActiveNavKey(): NavKey | undefined {
  return useRouterState({ select: (state) => activeNavKey(state.location.pathname) });
}

/**
 * Die Ziele für diese Person. Ohne Organisation oder ohne Feature buyer fehlen die Käuferziele
 * und Mein Agent (PLT-02); das Profil bleibt immer erreichbar. Solange /me lädt, alle zeigen, damit
 * die Leiste nicht springt.
 */
export function useNavTargets(): {
  main: NavTarget[];
  agent: NavTarget | undefined;
  actions: NavTarget[];
} {
  const t = useT();
  const me = useMe();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const buyer = !me.data || (me.data.organization !== null && me.data.permissions.viewBuyerAreas);
  const today = { key: 'myDay' as const, label: t.nav.myDay, href: '/heute', icon: HouseIcon };
  const questions = {
    key: 'questions' as const,
    label: t.nav.searchOrAsk,
    // Frag Reziproq öffnet sich über der Seite; als Link (Menü) öffnet ?frag sie über Heute.
    href: '/heute?frag=1',
    icon: MessageCircleQuestionIcon,
  };
  const profile = {
    key: 'profile' as const,
    label: t.nav.profile,
    href: '/profil',
    icon: UserRoundIcon,
  };
  // NAV-10 2.0, TN-01: vier Hauptpunkte in dieser Reihenfolge, darunter Mein Agent.
  if (buyer)
    return {
      main: [
        today,
        { key: 'suppliers', label: t.nav.suppliers, href: '/beziehungen', icon: FactoryIcon },
        {
          key: 'materialGroups',
          label: t.nav.materialGroups,
          href: '/warengruppen',
          icon: BoxesIcon,
        },
        { key: 'overview', label: t.nav.overview, href: '/wert', icon: ChartScatterIcon },
      ],
      agent: {
        key: 'myAgent',
        label: t.nav.myAgent,
        href: '/mein-agent',
        icon: CircleDotDashedIcon,
      },
      actions: [questions, profile],
    };
  // Lieferantenseite (LP-01): Heute und Kunden, Frag sucht im aktuellen Kunden (QS-05). Mein Agent
  // kommt mit dem Lieferanten-Agenten (K5-e).
  if (me.data?.permissions.viewCustomers) {
    const customer = /^\/kunden\/([0-9a-f-]{36})(?:\/|$)/.exec(pathname)?.[1];
    const search = {
      ...questions,
      href: customer ? `/heute?frag=1&kunde=${customer}` : '/heute?frag=1',
    };
    const customers = {
      key: 'customers' as const,
      label: t.nav.customers,
      href: '/kunden',
      icon: BuildingIcon,
    };
    return { main: [today, customers], agent: undefined, actions: [search, profile] };
  }
  return { main: [], agent: undefined, actions: [profile] };
}

/**
 * Links der Bausteine aus components/ui über den Router, ohne Neuladen der Seite. Ein normales
 * `<a>` statt Link des Routers: Welche Seite als aktiv markiert ist, entscheidet der Baustein,
 * Link würde sonst auch den Namen links und übergeordnete Ebenen markieren.
 */
export const routerLink: RenderLink = (props) => <RouterAnchor {...props} />;

function RouterAnchor({ href, children, ...props }: Parameters<RenderLink>[0]) {
  const router = useRouter();
  return (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        // Neuer Tab, Fenster oder Download bleiben Sache des Browsers.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        // Ein Abschnitt wie /lieferanten/<id>#strategie (UMB-05) geht als hash mit.
        // Mit Suchteil wie /hinweise?hinweis=<id> (KI-16) liest der Router das ganze href.
        if (href.includes('?')) {
          void router.navigate({ href });
          return;
        }
        const [to = href, hash] = href.split('#');
        void router.navigate({ to, ...(hash ? { hash } : {}) });
      }}
    >
      {children}
    </a>
  );
}
