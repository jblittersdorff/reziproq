// @vitest-environment jsdom
import type { RelationshipRow, RelationshipsResponse } from '@reziproq/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  renderAt,
  sampleRelationships,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';

// Oberflächentests zu docs/specs/NAV-12.md: Filter der Lieferantenliste.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const row = (n: number, extra: Partial<RelationshipRow>): RelationshipRow => ({
  ...(sampleRelationships.rows[3] as RelationshipRow),
  relationshipId: `0190a0a0-0000-7000-8000-${String(n).padStart(12, '0')}`,
  name: `Lieferant ${n}`,
  country: 'DE',
  status: 'active',
  spend: { amountCents: 1_000_000 * (10 - n), currency: 'EUR' },
  reason: null,
  attention: 0,
  materialGroup: null,
  businessUnitIds: [],
  materialGroupIds: [],
  targetType: null,
  categorySegments: [],
  isFocus: false,
  isMine: false,
  ...extra,
});
const partner = { key: '3-3', name: 'Partner' };

const body: RelationshipsResponse = {
  ...sampleRelationships,
  rows: [
    row(1, { businessUnitIds: ['bu1'], materialGroupIds: ['wg-sub'], isFocus: true }),
    row(2, { businessUnitIds: ['bu1'], materialGroupIds: ['wg-other'], isMine: true }),
    row(3, { businessUnitIds: ['bu2'], materialGroupIds: ['wg-sub'], targetType: partner }),
    row(4, { isFocus: true, isMine: true, targetType: partner }),
  ],
  filters: {
    businessUnits: [
      { id: 'bu1', name: 'Antrieb' },
      { id: 'bu2', name: 'Karosserie' },
    ],
    materialGroups: [
      { id: 'wg-top', name: 'Stahl', parentId: null },
      { id: 'wg-sub', name: 'Blech', parentId: 'wg-top' },
      { id: 'wg-other', name: 'Kunststoff', parentId: null },
    ],
    targetTypes: [partner],
  },
};
const ended = row(5, { status: 'ended', isFocus: true });

const serveBody = () => {
  api.relationships = { status: 200, body, drafts: [], ended: [ended] };
};

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  serveBody();
});

afterEach(tearDownApp);

// BZ-01: Namen der Zeilen der Liste in ihrer Folge
const names = async () => {
  await screen.findByRole('group', { name: 'Filter' });
  return [
    ...(document
      .querySelector('[data-slot="relationship-rows"]')
      ?.querySelectorAll('a[href^="/lieferanten/"] b') ?? []),
  ].map((name) => name.firstChild?.textContent?.trim());
};

// NAV-12 seit BZ-01 (K2-b.4): Strategisch und Meine sind Filter-Chips, Business Unit, Warengruppe
// und Soll-Typ stehen unter „Mehr Filter“; alles in der Adresse.
describe('NAV-12 Filter der Lieferantenliste', () => {
  it('jeder Filter liefert allein und in Kombination die richtigen Lieferanten', async () => {
    renderAt('/lieferanten?bu=bu1');
    await waitFor(async () => expect(await names()).toEqual(['Lieferant 1', 'Lieferant 2']));
    cleanupAndRender('/lieferanten?filter=strategisch');
    await waitFor(async () => expect(await names()).toEqual(['Lieferant 1', 'Lieferant 4']));
  });

  it('Warengruppe schließt Untergruppen ein; Soll-Typ und Team wirken', async () => {
    renderAt('/lieferanten?wg=wg-top');
    await waitFor(async () => expect(await names()).toEqual(['Lieferant 1', 'Lieferant 3']));
    cleanupAndRender('/lieferanten?typ=3-3');
    await waitFor(async () => expect(await names()).toEqual(['Lieferant 3', 'Lieferant 4']));
    cleanupAndRender('/lieferanten?filter=meine');
    await waitFor(async () => expect(await names()).toEqual(['Lieferant 2', 'Lieferant 4']));
    cleanupAndRender('/lieferanten?bu=bu1&filter=meine&typ=3-3');
    expect(await screen.findByText('Kein Lieferant passt zu diesen Filtern.')).toBeTruthy();
  });

  it('Zahlen an den Chips, Beendete und Zurücksetzen', async () => {
    renderAt('/lieferanten?filter=strategisch&beendet=1');
    await waitFor(async () =>
      expect(await names()).toEqual(['Lieferant 1', 'Lieferant 4', 'Lieferant 5']),
    );
    expect(screen.getByRole('button', { name: 'Strategisch · 3' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }));
    await waitFor(async () => expect(await names()).toEqual(['Lieferant 1', 'Lieferant 4']));
    expect(screen.getByRole('button', { name: 'Strategisch · 2' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Filter zurücksetzen' })).toBeNull();
  });

  it('Filter stehen in der Adresse, und Zurück erhält sie', async () => {
    const router = renderAt('/beziehungen');
    fireEvent.click(await screen.findByRole('button', { name: 'Strategisch · 2' }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ filter: 'strategisch' }),
    );
    // BZ-01: Die Zeile öffnet den Lieferanten direkt, ohne Detailleiste
    fireEvent.click(await screen.findByRole('link', { name: /Lieferant 1/ }));
    await waitFor(() => expect(router.state.location.pathname).toContain('/lieferanten/0190'));
    act(() => router.history.back());
    await waitFor(() => expect(router.state.location.pathname).toBe('/beziehungen'));
    expect(router.state.location.search).toMatchObject({ filter: 'strategisch' });
    await waitFor(async () => expect(await names()).toEqual(['Lieferant 1', 'Lieferant 4']));
  });
});

function cleanupAndRender(path: string) {
  tearDownApp();
  setUpApp();
  serveBody();
  auth.state = signedIn;
  renderAt(path);
}
