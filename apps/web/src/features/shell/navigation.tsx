import { type AreaKey, areas } from '@reziproq/shared';
import { useRouter, useRouterState } from '@tanstack/react-router';
import {
  BuildingIcon,
  ChartScatterIcon,
  FactoryIcon,
  HouseIcon,
  type LucideIcon,
  MessageCircleQuestionIcon,
  ReceiptEuroIcon,
  UserRoundIcon,
} from 'lucide-react';
import type { NavItem, RenderLink } from '@/components/ui/nav-link';
import { useMe } from '@/features/auth/use-me';
import { useT } from '@/lib/i18n';

// Ziele der globalen Leiste (PLT-11): Start, Lieferanten, Portfolio und Wirkung aus
// @reziproq/shared, rechts Fragen und Profil. Die Lieferantenseite hat Start, Kunden und Profil
// (LIF-02). Leiste und Menüseite lesen von hier.

export type NavKey = AreaKey | 'customers' | 'questions' | 'profile';

export interface NavTarget extends NavItem {
  key: NavKey;
  icon: LucideIcon;
}

const areaIcons: Record<AreaKey, LucideIcon> = {
  start: HouseIcon,
  suppliers: FactoryIcon,
  portfolio: ChartScatterIcon,
  impact: ReceiptEuroIcon,
};

/** Welche Adressen zu welchem Ziel gehören; die längste passende gewinnt. */
const sections: { prefix: string; key: NavKey }[] = [
  ...areas.map((area) => ({ prefix: area.path, key: area.key })),
  { prefix: '/kunden', key: 'customers' },
  { prefix: '/fragen', key: 'questions' },
  { prefix: '/profil', key: 'profile' },
  { prefix: '/einstellungen', key: 'profile' },
];

export function activeNavKey(pathname: string): NavKey | undefined {
  return sections.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    ?.key;
}

export function useActiveNavKey(): NavKey | undefined {
  return useRouterState({ select: (state) => activeNavKey(state.location.pathname) });
}

/**
 * Die Ziele für diese Person. Ohne Organisation oder ohne Feature buyer fehlen die Käuferziele
 * und Fragen (PLT-02); das Profil bleibt immer erreichbar. Solange /me lädt, alle zeigen, damit
 * die Leiste nicht springt.
 */
export function useNavTargets(): { main: NavTarget[]; actions: NavTarget[] } {
  const t = useT();
  const me = useMe();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const buyer = !me.data || (me.data.organization !== null && me.data.permissions.viewBuyerAreas);
  const main = areas.map((area) => ({
    key: area.key,
    label: t.nav[area.key],
    href: area.path,
    icon: areaIcons[area.key],
  }));
  const questions = {
    key: 'questions' as const,
    label: t.nav.questions,
    href: '/fragen',
    icon: MessageCircleQuestionIcon,
  };
  const profile = {
    key: 'profile' as const,
    label: t.nav.profile,
    href: '/profil',
    icon: UserRoundIcon,
  };
  if (buyer) return { main, actions: [questions, profile] };
  // Lieferantenseite (LIF-02): Start, Kunden und Fragen (QS-05: Suche im aktuellen Kunden).
  if (me.data?.permissions.viewCustomers) {
    const customer = /^\/kunden\/([0-9a-f-]{36})(?:\/|$)/.exec(pathname)?.[1];
    const search = { ...questions, href: customer ? `/fragen?kunde=${customer}` : '/fragen' };
    const start = main.find((target) => target.key === 'start');
    const customers = {
      key: 'customers' as const,
      label: t.nav.customers,
      href: '/kunden',
      icon: BuildingIcon,
    };
    return { main: start ? [start, customers] : [customers], actions: [search, profile] };
  }
  return { main: [], actions: [profile] };
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
        const [to = href, hash] = href.split('#');
        void router.navigate({ to, ...(hash ? { hash } : {}) });
      }}
    >
      {children}
    </a>
  );
}
