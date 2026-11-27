import type { Page } from '@playwright/test';
import type { RelationshipRow, RelationshipsResponse } from '@reziproq/shared';

// BZ-01 (K2-b.4): Antworten von GET /api/beziehungen für die E2E-Tests mit nachgebauter API.
// Mit `portfolio=1` kommen die Entwürfe dazu, mit `beendet=1` die beendeten, wie in der API.

const mio = (euro: number) => ({ amountCents: Math.round(euro * 100_000_000), currency: 'EUR' });

/** Eine Zeile der Liste; ohne Angaben aktiv, ohne Grund, Segment und Zusagen */
export function relationshipRow(
  n: number,
  overrides: Partial<RelationshipRow> = {},
): RelationshipRow {
  return {
    relationshipId: `0190a0a0-0000-7000-8000-${String(n).padStart(12, '0')}`,
    name: `Lieferant ${n}`,
    status: 'active',
    country: 'DE',
    materialGroup: null,
    spend: null,
    reason: null,
    attention: 0,
    segment: null,
    disputed: false,
    quota: null,
    isMine: false,
    isFocus: false,
    openCommitments: 0,
    businessUnitIds: [],
    materialGroupIds: [],
    targetType: null,
    categorySegments: [],
    ...overrides,
  };
}

/** Antwort mit den Zeilen; Kopf und Chips aus den Zeilen gezählt */
export function relationshipsResponse(
  rows: RelationshipRow[],
  overrides: Partial<RelationshipsResponse> = {},
): RelationshipsResponse {
  const active = rows.filter((row) => row.status === 'active');
  const cents = active.reduce((sum, row) => sum + (row.spend?.amountCents ?? 0), 0);
  return {
    year: 2026,
    head: {
      active: active.length,
      spend: cents > 0 ? [{ amountCents: cents, currency: 'EUR' }] : [],
      portfolio: rows.filter((row) => row.status !== 'ended').length,
    },
    counts: {
      alle: active.length,
      meine: active.filter((row) => row.isMine).length,
      strategisch: active.filter((row) => row.isFocus).length,
      offeneZusagen: active.filter((row) => row.openCommitments > 0).length,
    },
    rows: active,
    summary: { keptBetter: 0, unrated: null, rows: [] },
    filters: { businessUnits: [], materialGroups: [], targetTypes: [] },
    ...overrides,
  };
}

/** Silesia wie in den bisherigen Tests der Liste (PLT-01, PLT-12) */
export const silesia = relationshipRow(1, {
  name: 'Silesia Guss Sp. z o.o. (Demo)',
  country: 'PL',
  materialGroup: 'Guss',
  spend: mio(3.15),
  segment: { key: '3-3', name: 'Strategisch' },
  quota: {
    own: { kept: 5, due: 5, percent: 100 },
    counterpart: { kept: 3, due: 5, percent: 60 },
  },
});

/**
 * Beantwortet GET /api/beziehungen. Entwürfe und beendete Zeilen der Liste `rows` kommen nur mit
 * portfolio=1 und beendet=1 mit, wie in der API. `onRequest` sieht jede Anfrage.
 */
export async function routeRelationships(
  page: Page,
  rows: RelationshipRow[] = [silesia],
  options: {
    overrides?: Partial<RelationshipsResponse>;
    onRequest?: (request: import('@playwright/test').Request) => void;
  } = {},
) {
  await page.route(/\/api\/beziehungen(\?.*)?$/, (route) => {
    options.onRequest?.(route.request());
    const query = new URL(route.request().url()).searchParams;
    const body = relationshipsResponse(rows, options.overrides);
    return route.fulfill({
      json: {
        ...body,
        rows: [
          ...body.rows,
          ...(query.get('portfolio') === '1' ? rows.filter((row) => row.status === 'draft') : []),
          ...(query.get('beendet') === '1' ? rows.filter((row) => row.status === 'ended') : []),
        ],
      },
    });
  });
}

/** Die Liste unter den Filtern, ohne die Zeilen von „Das Wichtigste“ */
export const relationshipList = (page: Page) => page.locator('[data-slot="relationship-rows"]');
