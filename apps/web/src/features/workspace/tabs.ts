import type { PageKey } from './areas';

// NAV-10: Die Lieferantenleiste hat vier Reiter und den Knopf Profil. Jede bisherige Seite gehört
// genau einem Reiter oder dem Profil; die Adressen bleiben, damit Lesezeichen und Links in Mails
// weiter funktionieren.

export const supplierTabs = ['overview', 'activities', 'plan', 'results'] as const;
export type SupplierTab = (typeof supplierTabs)[number] | 'profile';

/** Seite unter /lieferanten/<id>/<path> mit ihrem Titel aus workspace.pages oder activities */
export interface TabPage {
  key: PageKey;
  path: string;
}

export const tabPages: Record<SupplierTab, TabPage[]> = {
  overview: [],
  // K2-c.7: Der Verlauf steht in der Akte (Nur für dich); die bisherige Seite leitet dorthin.
  activities: [{ key: 'meetings', path: 'umsetzung/termine' }],
  plan: [
    { key: 'preparation', path: 'plan/vorbereitung' },
    { key: 'topics', path: 'plan/themen' },
    { key: 'initiatives', path: 'plan/initiativen' },
    { key: 'commitments', path: 'plan/zusagen' },
    { key: 'actions', path: 'umsetzung/massnahmen' },
    { key: 'scorecard', path: 'plan/scorecard' },
    { key: 'approval', path: 'plan/freigabe' },
  ],
  // „Gesichert“ ist die P&L-Brücke (bestätigte Ergebnisse), dazu Ergebnisse je Initiative und
  // Wertpotenziale (KI-11). Adresse unter wirkung/ wie die übrigen Ergebnisseiten, nicht
  // ergebnisse/ wie in der Spec, damit alle Lesezeichen gleich aufgebaut bleiben.
  results: [
    { key: 'bridge', path: 'wirkung/bruecke' },
    { key: 'initiativeImpact', path: 'wirkung/initiativen' },
    { key: 'valueOpportunities', path: 'wirkung/wertpotenziale' },
    { key: 'feedback', path: 'beziehung/feedback' },
  ],
  // NAV-10 1.1 (Vorlage L-Profil): Profil und Spend sind eine Seite; die Spend-Einträge liegen
  // weiter unter strategie/spend und gehören zur Pille „Profil und Spend“.
  profile: [
    { key: 'profile', path: 'strategie/profil' },
    { key: 'segmentation', path: 'strategie/segmentierung' },
    // WG-20: Warengruppen des Lieferanten (NAV-10: im Profil nach der Segmentierung)
    { key: 'categories', path: 'strategie/warengruppen' },
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

/** Adressen, die zur Pille einer anderen Seite gehören */
export const pageAliases: [string, string][] = [['strategie/spend', 'strategie/profil']];

/** Reiter und Unterseite zu einer Adresse unter /lieferanten/<id> */
export function tabOf(pathname: string): { tab: SupplierTab; page: TabPage | undefined } {
  const path = pathname.split('/').slice(3).join('/').replace(/\/$/, '');
  const alias = pageAliases.find(([from]) => path === from || path.startsWith(`${from}/`));
  const rest = alias ? alias[1] : path;
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
