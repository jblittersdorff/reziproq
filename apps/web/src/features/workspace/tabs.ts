import type { PageKey } from './areas';

// NAV-10: Die Lieferantenleiste hat vier Reiter und den Knopf Profil. Jede bisherige Seite gehört
// genau einem Reiter oder dem Profil; die Adressen bleiben, damit Lesezeichen und Links in Mails
// weiter funktionieren.

export const supplierTabs = ['overview', 'activities', 'plan', 'results'] as const;
export type SupplierTab = (typeof supplierTabs)[number] | 'profile';

/** Seite unter /lieferanten/<id>/<path> mit ihrem Titel aus workspace.pages oder activities */
export interface TabPage {
  key: PageKey | 'history';
  path: string;
}

export const tabPages: Record<SupplierTab, TabPage[]> = {
  overview: [],
  activities: [
    { key: 'history', path: 'aktivitaeten' },
    { key: 'meetings', path: 'umsetzung/termine' },
  ],
  plan: [
    { key: 'preparation', path: 'plan/vorbereitung' },
    { key: 'topics', path: 'plan/themen' },
    { key: 'initiatives', path: 'plan/initiativen' },
    { key: 'commitments', path: 'plan/zusagen' },
    { key: 'actions', path: 'umsetzung/massnahmen' },
    { key: 'scorecard', path: 'plan/scorecard' },
    { key: 'approval', path: 'plan/freigabe' },
  ],
  // „Gesichert“ ist die P&L-Brücke (bestätigte Ergebnisse), dazu Ergebnisse je Initiative;
  // Wertpotenziale kommen mit KI-11.
  results: [
    { key: 'bridge', path: 'wirkung/bruecke' },
    { key: 'initiativeImpact', path: 'wirkung/initiativen' },
    { key: 'feedback', path: 'beziehung/feedback' },
  ],
  profile: [
    { key: 'profile', path: 'strategie/profil' },
    { key: 'spend', path: 'strategie/spend' },
    { key: 'segmentation', path: 'strategie/segmentierung' },
    { key: 'supplierPlan', path: 'strategie/lieferantenplan' },
    { key: 'team', path: 'beziehung/team' },
    { key: 'rules', path: 'beziehung/spielregeln' },
    // Nicht in der Tabelle der Spec; Kontaktpunkte gehören zur Beziehung und damit zum Profil.
    { key: 'touchpoints', path: 'beziehung/kontaktpunkte' },
  ],
};

/** Weitere Adressen, die zu einem Reiter gehören, ohne eigene Pille (z. B. Versionen, Zyklus) */
const extraPrefixes: [string, SupplierTab][] = [
  ['plan/versionen', 'plan'],
  ['plan', 'plan'],
  ['umsetzung', 'plan'],
  ['wirkung', 'results'],
  ['zyklus', 'overview'],
  ['strategie', 'profile'],
  ['beziehung', 'profile'],
];

/** Reiter und Unterseite zu einer Adresse unter /lieferanten/<id> */
export function tabOf(pathname: string): { tab: SupplierTab; page: TabPage | undefined } {
  const rest = pathname.split('/').slice(3).join('/');
  if (!rest) return { tab: 'overview', page: undefined };
  for (const tab of [...supplierTabs, 'profile'] as SupplierTab[]) {
    const page = tabPages[tab].find(
      (entry) => rest === entry.path || rest.startsWith(`${entry.path}/`),
    );
    if (page) return { tab, page };
  }
  const extra = extraPrefixes.find(([prefix]) => rest === prefix || rest.startsWith(`${prefix}/`));
  return { tab: extra?.[1] ?? 'overview', page: undefined };
}

export const tabHref = (relationshipId: string, tab: SupplierTab) => {
  const first = tabPages[tab][0];
  return first ? `/lieferanten/${relationshipId}/${first.path}` : `/lieferanten/${relationshipId}`;
};
