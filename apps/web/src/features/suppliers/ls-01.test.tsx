// @vitest-environment jsdom
import type { SuppliersResponse } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  renderAt,
  sampleSuppliers,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';

// Tests zu docs/specs/LS-01.md in der Oberfläche: gleiche Zeilenhöhe, Anzeigename, „nicht
// bewertet“, Balken, Auswahl in der Adresse, Tastatur und eigene Ansicht unter 760 px.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const longName = `${'Sehr Lange Firmenbezeichnung Mit Vielen Wörtern '.repeat(2).slice(0, 72)} GmbH`;
const base = sampleSuppliers.suppliers[0] as SuppliersResponse['suppliers'][number];
const rows = (): HTMLElement[] =>
  within(screen.getByRole('list', { name: 'Lieferanten' })).getAllByRole('button');

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.suppliers = {
    status: 200,
    body: {
      ...sampleSuppliers,
      suppliers: [
        {
          ...base,
          segmentType: '3-2',
          targetType: '3-3',
          isFocus: true,
          topMaterialGroup: 'Elektronik',
        },
        {
          ...base,
          relationshipId: 'rel-lang',
          name: longName,
          spend: { amountCents: 241_000_000, currency: 'EUR' },
          primaryMaterialGroup: null,
          materialGroups: [],
          isFocus: false,
        },
        {
          ...base,
          relationshipId: 'rel-klein',
          name: 'Moravia Plast s.r.o.',
          spend: { amountCents: 48_200_000, currency: 'EUR' },
          isFocus: false,
        },
      ],
    } satisfies SuppliersResponse,
  };
  api.handle = ({ url }) =>
    url.endsWith('/overview')
      ? Response.json({
          head: { segment: null, sro: { userId: 'sara', name: 'Sara Ost' }, nextMeeting: null },
          metrics: [],
          cycle: null,
          canStartCycle: false,
          canSetJbpDate: false,
          openHints: 2,
          overdueCommitments: 1,
          openDrafts: 3,
        })
      : undefined;
});

afterEach(() => {
  tearDownApp();
  vi.unstubAllGlobals();
});

describe('LS-01 Lieferantenliste mit Detailleiste', () => {
  it('alle Zeilen haben dieselbe Höhe, auch mit langem Namen, ohne Segment und ohne Warengruppe', async () => {
    renderAt('/lieferanten');
    await screen.findByRole('list', { name: 'Lieferanten' });
    expect(rows().every((row) => row.className.includes('h-16'))).toBe(true);
    const long = rows()[1] as HTMLElement;
    const name = long.querySelector('[data-slot="supplier-name"]') as HTMLElement;
    expect(name.className).toContain('truncate');
    expect(name.getAttribute('title')).toBe(longName);
    expect(within(long).getByText(/Warengruppe fehlt/)).toBeTruthy();
    expect(within(long).getByText('nicht bewertet')).toBeTruthy();
  });

  it('der Anzeigename entfernt die Rechtsform; „(Demo)“ wird zum Kennzeichen', async () => {
    renderAt('/lieferanten');
    await screen.findByRole('list', { name: 'Lieferanten' });
    const first = rows()[0] as HTMLElement;
    expect(within(first).getByText('Rheintal Elektronik')).toBeTruthy();
    expect(within(first).getByText('Demo')).toBeTruthy();
    expect(within(first).getByText('Hoher Impact · ausbaufähig')).toBeTruthy();
    expect(within(rows()[2] as HTMLElement).getByText('Moravia Plast')).toBeTruthy();
  });

  it('der Balken des größten Lieferanten ist voll, die anderen im Verhältnis', async () => {
    renderAt('/lieferanten');
    await screen.findByRole('list', { name: 'Lieferanten' });
    const bars = rows().map((row) =>
      row.querySelector('[data-slot="meter-bar"]')?.getAttribute('data-value'),
    );
    expect(bars).toEqual(['100', '50', '10']);
  });

  it('die Auswahl steht in der Adresse und überlebt ein Neuladen; die Leiste zeigt das Wichtigste', async () => {
    const router = renderAt('/lieferanten');
    await screen.findByRole('list', { name: 'Lieferanten' });
    fireEvent.click(rows()[2] as HTMLElement);
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ lieferant: 'rel-klein' }),
    );
    const body = api.suppliers.body;
    const handle = api.handle;
    tearDownApp();
    setUpApp();
    api.suppliers = { status: 200, body };
    api.handle = handle;
    renderAt('/lieferanten?lieferant=rel-Rheintal%20Elektronik%20GmbH%20(Demo)');
    const panel = await screen.findByRole('region', { name: 'Details zu Rheintal Elektronik' });
    expect(within(panel).getByText('Segment Hoher Impact · ausbaufähige Beziehung')).toBeTruthy();
    expect(within(panel).getByText('Soll-Typ Hoher Impact · starke Beziehung')).toBeTruthy();
    expect(await within(panel).findByText('2 offen')).toBeTruthy();
    expect(within(panel).getByText('1 überfällig')).toBeTruthy();
    expect(within(panel).getByText('3 zu prüfen')).toBeTruthy();
    expect(within(panel).getByText('Sara Ost')).toBeTruthy();
    expect((rows()[0] as HTMLElement).getAttribute('aria-pressed')).toBe('true');
  });

  it('Pfeiltasten wechseln die Zeile, Enter öffnet den Lieferanten, Escape schließt die Leiste', async () => {
    const router = renderAt('/lieferanten');
    await screen.findByRole('list', { name: 'Lieferanten' });
    const list = screen.getByRole('list', { name: 'Lieferanten' });
    fireEvent.click(rows()[0] as HTMLElement);
    await waitFor(() =>
      expect((rows()[0] as HTMLElement).getAttribute('aria-pressed')).toBe('true'),
    );
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ lieferant: 'rel-lang' }),
    );
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        lieferant: 'rel-Rheintal Elektronik GmbH (Demo)',
      }),
    );
    fireEvent.keyDown(list, { key: 'Escape' });
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('lieferant'));
    fireEvent.click(rows()[2] as HTMLElement);
    await waitFor(() =>
      expect((rows()[2] as HTMLElement).getAttribute('aria-pressed')).toBe('true'),
    );
    fireEvent.keyDown(list, { key: 'Enter' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/lieferanten/rel-klein'));
  });

  it('unter 760 px öffnet die Detailleiste als eigene Ansicht mit Zurück', async () => {
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: query.includes('max-width'),
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    const router = renderAt('/lieferanten');
    await screen.findByRole('list', { name: 'Lieferanten' });
    // Ohne Auswahl keine Leiste neben der Liste
    expect(screen.queryByRole('region', { name: /Details zu/ })).toBeNull();
    fireEvent.click(rows()[2] as HTMLElement);
    expect(await screen.findByRole('region', { name: 'Details zu Moravia Plast' })).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Lieferanten' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück zur Liste' }));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('lieferant'));
    expect(await screen.findByRole('list', { name: 'Lieferanten' })).toBeTruthy();
  });
});
