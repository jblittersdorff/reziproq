// @vitest-environment jsdom
import type { SuppliersResponse } from '@reziproq/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  renderAt,
  sampleSuppliers,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';

// Oberflächentests zu docs/specs/NAV-12.md: Filter der Lieferantenliste.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const supplier = (
  n: number,
  extra: Partial<NonNullable<SuppliersResponse['suppliers'][number]>>,
): SuppliersResponse['suppliers'][number] => ({
  relationshipId: `0190a0a0-0000-7000-8000-${String(n).padStart(12, '0')}`,
  name: `Lieferant ${n}`,
  country: 'DE',
  externalRef: null,
  status: 'active',
  spend: { amountCents: 1_000_000 * (10 - n), currency: 'EUR' },
  primaryMaterialGroup: null,
  materialGroups: [],
  businessUnitIds: [],
  materialGroupIds: [],
  targetType: null,
  isFocus: false,
  isMine: false,
  ...extra,
});

const body: SuppliersResponse = {
  ...sampleSuppliers,
  suppliers: [
    supplier(1, { businessUnitIds: ['bu1'], materialGroupIds: ['wg-sub'], isFocus: true }),
    supplier(2, { businessUnitIds: ['bu1'], materialGroupIds: ['wg-other'], isMine: true }),
    supplier(3, { businessUnitIds: ['bu2'], materialGroupIds: ['wg-sub'], targetType: '3-3' }),
    supplier(4, { isFocus: true, isMine: true, targetType: '3-3' }),
    supplier(5, { status: 'ended', isFocus: true }),
  ],
  count: 4,
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
    targetTypes: [{ key: '3-3', name: 'Partner' }],
  },
};

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.suppliers = { status: 200, body };
});

afterEach(tearDownApp);

// LS-01: Zeilen der Liste; der volle Name steht im Tooltip des Anzeigenamens
// NAV-10 1.1: Zeilen in den Gruppen „Brauchen dich“, „Laufen gut“ und „Beendet“, in dieser Folge
const names = async () => {
  await screen.findAllByRole('button', { pressed: false });
  return [
    ...document.querySelectorAll('[data-slot="supplier-row"] [data-slot="supplier-name"]'),
  ].map((name) => name.getAttribute('title'));
};

describe('NAV-12 Filter der Lieferantenliste', () => {
  it('jeder Filter liefert allein und in Kombination die richtigen Lieferanten', async () => {
    renderAt('/lieferanten?bu=bu1');
    expect(await names()).toEqual(['Lieferant 1', 'Lieferant 2']);
    cleanupAndRender('/lieferanten?fokus=1');
    expect(await names()).toEqual(['Lieferant 1', 'Lieferant 4']);
  });

  it('Warengruppe schließt Untergruppen ein; Soll-Typ und Team wirken', async () => {
    renderAt('/lieferanten?wg=wg-top');
    expect(await names()).toEqual(['Lieferant 1', 'Lieferant 3']);
    cleanupAndRender('/lieferanten?typ=3-3');
    expect(await names()).toEqual(['Lieferant 3', 'Lieferant 4']);
    cleanupAndRender('/lieferanten?meine=1');
    expect(await names()).toEqual(['Lieferant 2', 'Lieferant 4']);
    cleanupAndRender('/lieferanten?bu=bu1&fokus=1&meine=1');
    expect(await screen.findByText('0 Treffer')).toBeTruthy();
  });

  it('Treffer, Beendete und Zurücksetzen', async () => {
    renderAt('/lieferanten?fokus=1&beendet=1');
    expect(await screen.findByText('3 Treffer')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }));
    expect(await screen.findByText('5 Treffer')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Filter zurücksetzen' })).toBeNull();
  });

  it('Filter stehen in der Adresse, und Zurück erhält sie', async () => {
    const router = renderAt('/lieferanten');
    // NAV-10 1.1: Umschalter Meine, Strategisch (Fokuslieferanten), Alle
    fireEvent.click(await screen.findByRole('radio', { name: 'Strategisch' }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ fokus: 1 }));
    // LS-01: Zeile wählen, dann über die Detailleiste öffnen
    fireEvent.click(await screen.findByRole('button', { name: /Lieferant 1/ }));
    fireEvent.click(await screen.findByRole('link', { name: 'Lieferant öffnen' }));
    await waitFor(() => expect(router.state.location.pathname).toContain('/lieferanten/0190'));
    act(() => router.history.back());
    await waitFor(() => expect(router.state.location.pathname).toBe('/lieferanten'));
    expect(router.state.location.search).toMatchObject({ fokus: 1 });
    expect(await names()).toEqual(['Lieferant 1', 'Lieferant 4']);
  });
});

function cleanupAndRender(path: string) {
  tearDownApp();
  setUpApp();
  api.suppliers = { status: 200, body };
  auth.state = signedIn;
  renderAt(path);
}
