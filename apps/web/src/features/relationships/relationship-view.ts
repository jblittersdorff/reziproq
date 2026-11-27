import type { Money, RelationshipFilters, RelationshipRow } from '@reziproq/shared';
import { z } from 'zod';

// BZ-01 (K2-b.4): Regeln der Linse Liste ohne Oberfläche. Filter-Chips, „Mehr Filter“ und
// Sortierung stehen in der Adresse, z. B. /beziehungen?filter=meine&sortierung=spend&portfolio=1.
// Ungültige Werte fallen auf den Standard.

export const relationshipSearchSchema = z.object({
  /** Linse Segmente; ohne Angabe die Liste */
  linse: z.enum(['segmente']).optional().catch(undefined),
  filter: z.enum(['meine', 'strategisch', 'offene-zusagen']).optional().catch(undefined),
  /** Standard ist „nach Aufmerksamkeit“ */
  sortierung: z.enum(['spend']).optional().catch(undefined),
  /** E-K2-10: auch die importierten Lieferanten ohne Anbindung */
  portfolio: z.literal(1).optional().catch(undefined),
  /** PLT-03: „Beendete zeigen“ */
  beendet: z.literal(1).optional().catch(undefined),
  /** Typ des Segments („2-2“), „ohne“ oder „strittig“ */
  segment: z.string().optional().catch(undefined),
  /** NAV-12: Soll-Typ, Warengruppe, Business Unit */
  typ: z.string().optional().catch(undefined),
  wg: z.string().optional().catch(undefined),
  bu: z.string().optional().catch(undefined),
  // Alte Adressen (`/lieferanten?ansicht=matrix`, `?ansicht=runde`, `/portfolio?warengruppe=<id>`):
  // matrix öffnet die Linse Segmente, runde die Bewertungsrunden; mit Warengruppe oder Business Unit
  // öffnet die Linse Segmente bis K2-e die bisherige Matrix mit Filtern (WG-18), `segmente` ist dort
  // Ist, Soll oder beides.
  ansicht: z.enum(['matrix', 'runde']).optional().catch(undefined),
  warengruppe: z.string().optional().catch(undefined),
  segmente: z.enum(['ist', 'soll', 'both']).optional().catch(undefined),
});

export type RelationshipSearch = z.infer<typeof relationshipSearchSchema>;
export type ChipValue = 'alle' | 'meine' | 'strategisch' | 'offene-zusagen';

/** So viele Zeilen zeigt die Liste, die übrigen stehen in „N weitere Beziehungen“ (Vorlage) */
export const firstRows = 8;

/** Wie viele Filter unter „Mehr Filter“ gesetzt sind */
export function moreFilterCount(search: RelationshipSearch): number {
  return [
    search.portfolio,
    search.beendet,
    search.segment,
    search.typ,
    search.wg,
    search.bu,
  ].filter((value) => value !== undefined).length;
}

/**
 * „Mehr Filter“ ohne Portfolio und Beendete (die holt die API): Segment, Soll-Typ, Warengruppe und
 * Business Unit. Eine Oberebene der Warengruppe schließt ihre Untergruppen ein (NAV-12).
 */
export function moreFiltered(
  rows: RelationshipRow[],
  search: RelationshipSearch,
  groups: RelationshipFilters['materialGroups'] = [],
): RelationshipRow[] {
  const groupIds = new Set(
    search.wg
      ? [search.wg, ...groups.filter((group) => group.parentId === search.wg).map((g) => g.id)]
      : [],
  );
  return rows.filter(
    (row) =>
      (!search.segment ||
        (search.segment === 'strittig'
          ? row.disputed
          : search.segment === 'ohne'
            ? row.segment === null
            : row.segment?.key === search.segment)) &&
      (!search.typ || row.targetType?.key === search.typ) &&
      (!search.wg || row.materialGroupIds.some((id) => groupIds.has(id))) &&
      (!search.bu || row.businessUnitIds.includes(search.bu)),
  );
}

/** Zeilen eines Chips: Meine (Team), Strategisch (Fokus, E-K0-09), Offene Zusagen */
export function chipRows(rows: RelationshipRow[], chip: ChipValue): RelationshipRow[] {
  switch (chip) {
    case 'meine':
      return rows.filter((row) => row.isMine);
    case 'strategisch':
      return rows.filter((row) => row.isFocus);
    case 'offene-zusagen':
      return rows.filter((row) => row.openCommitments > 0);
    case 'alle':
      return rows;
  }
}

/** Zahl je Chip über die Zeilen nach „Mehr Filter“ */
export function chipCounts(rows: RelationshipRow[]): Record<ChipValue, number> {
  return {
    alle: rows.length,
    meine: chipRows(rows, 'meine').length,
    strategisch: chipRows(rows, 'strategisch').length,
    'offene-zusagen': chipRows(rows, 'offene-zusagen').length,
  };
}

const cents = (spend: Money | null) => spend?.amountCents ?? -1;

/**
 * Nach Aufmerksamkeit ist die Reihenfolge der API; nach Spend der größte zuerst, ohne Spend
 * zuletzt. Beendete stehen immer am Ende.
 */
export function sortedRows(rows: RelationshipRow[], sort: 'aufmerksamkeit' | 'spend') {
  if (sort === 'aufmerksamkeit') return rows;
  return [...rows].sort(
    (a, b) =>
      Number(a.status === 'ended') - Number(b.status === 'ended') ||
      cents(b.spend) - cents(a.spend) ||
      a.name.localeCompare(b.name, 'de'),
  );
}

/** Das Feld mit beiden höchsten Stufen (Strategisch) aus den Soll-Typen des aktiven Modells */
export function topSegmentKey(filters: RelationshipFilters): string | null {
  const levels = filters.targetTypes.flatMap((type) => type.key.split('-').map(Number));
  const highest = Math.max(...levels.filter((level) => Number.isInteger(level)));
  return Number.isFinite(highest) ? `${highest}-${highest}` : null;
}

/** Summe der Spends je Währung; für „N weitere Beziehungen · 7,3 Mio. €“ */
export function spendTotals(rows: RelationshipRow[]): Money[] {
  const totals = new Map<string, number>();
  for (const { spend } of rows) {
    if (spend) totals.set(spend.currency, (totals.get(spend.currency) ?? 0) + spend.amountCents);
  }
  return [...totals].map(([currency, amountCents]) => ({ amountCents, currency }));
}
