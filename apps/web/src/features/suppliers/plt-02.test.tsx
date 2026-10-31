// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  anna,
  api,
  renderAt,
  sampleSuppliers,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';

// Oberflächentests zu docs/specs/PLT-02.md: Lieferantenliste und Hinweise.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
});

afterEach(tearDownApp);

/** Text ohne geschützte Leerzeichen, die Intl zwischen Betrag und Währung setzt. */
const text = (element: Element | null) => element?.textContent?.replaceAll(' ', ' ') ?? '';

const cardNames = async () => {
  const list = await screen.findByRole('list', { name: 'Lieferanten' });
  return within(list)
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent);
};

const suppliersRequested = () =>
  vi.mocked(fetch).mock.calls.some(([url]) => String(url) === '/api/suppliers');

describe('Lieferantenseite', () => {
  it('zeigt oben Titel, Anzahl und Gesamtspend aus der API', async () => {
    renderAt('/lieferanten');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Lieferanten' });
    expect(await screen.findByText(/^3 Lieferanten/)).toBeDefined();
    expect(text(heading.parentElement)).toContain('3 Lieferanten · 10.230.000 € Jahresspend 2025');
  });

  it('zeigt je Lieferant eine Karte mit Name, Land, Warengruppe und Spend in Euro', async () => {
    renderAt('/lieferanten');
    const list = await screen.findByRole('list', { name: 'Lieferanten' });
    const cards = within(list).getAllByRole('listitem');
    expect(cards).toHaveLength(3);
    const first = text(cards[0] ?? null);
    expect(first).toContain('Rheintal Elektronik GmbH (Demo)');
    expect(first).toContain('Deutschland');
    expect(first).toContain('Elektronik');
    // Deutsches Format, ganze Euro ohne Nachkommastellen
    expect(first).toContain('4.820.000 €');
    expect(first).not.toMatch(/4\.820\.000,00/);
  });

  it('sortiert standardmäßig nach Spend, absteigend', async () => {
    renderAt('/lieferanten');
    expect(await cardNames()).toEqual([
      'Rheintal Elektronik GmbH (Demo)',
      'Silesia Guss Sp. z o.o. (Demo)',
      'Alpen Sensorik GmbH (Demo)',
    ]);
    expect(screen.getByRole('combobox', { name: 'Sortieren' })).toHaveProperty('value', 'spend');
  });

  it('sortiert auf Wunsch nach Name', async () => {
    renderAt('/lieferanten');
    await cardNames();
    fireEvent.change(screen.getByRole('combobox', { name: 'Sortieren' }), {
      target: { value: 'name' },
    });
    expect(await cardNames()).toEqual([
      'Alpen Sensorik GmbH (Demo)',
      'Rheintal Elektronik GmbH (Demo)',
      'Silesia Guss Sp. z o.o. (Demo)',
    ]);
  });

  it.each([
    ['nach Name', 'silesia', ['Silesia Guss Sp. z o.o. (Demo)']],
    [
      'nach Warengruppe',
      'elektronik',
      ['Rheintal Elektronik GmbH (Demo)', 'Alpen Sensorik GmbH (Demo)'],
    ],
  ])('filtert beim Tippen %s', async (_case, query, expected) => {
    renderAt('/lieferanten');
    await cardNames();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Lieferant oder Warengruppe suchen' }), {
      target: { value: query },
    });
    expect(await cardNames()).toEqual(expected);
  });

  it('sagt, wenn die Suche nichts findet', async () => {
    renderAt('/lieferanten');
    await cardNames();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Holz' } });
    expect((await screen.findByRole('status')).textContent).toBe('Keine Lieferanten zu „Holz“.');
  });

  it('zeigt bei leerer Liste den leeren Zustand aus der Spec', async () => {
    api.suppliers = {
      status: 200,
      body: { suppliers: [], count: 0, totalSpend: [], spendYear: null },
    };
    renderAt('/lieferanten');
    expect(await screen.findByText('Noch keine Lieferanten.')).toBeDefined();
    expect(
      screen.getByText('Mit dem Import (kommt in Release 0.1) lädst du sie aus Excel.'),
    ).toBeDefined();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('zeigt ohne Käufer-Rolle einen Hinweis und fragt die Liste nicht an', async () => {
    api.me = { ...anna, permissions: { ...anna.permissions, viewSuppliers: false } };
    renderAt('/lieferanten');
    expect(await screen.findByText('Dir fehlt eine Rolle')).toBeDefined();
    expect(suppliersRequested()).toBe(false);
  });

  it('zeigt den Rollen-Hinweis auch, wenn die API mit keine_berechtigung antwortet', async () => {
    api.suppliers = { status: 403, body: { statusCode: 403, code: 'keine_berechtigung' } };
    renderAt('/lieferanten');
    expect(await screen.findByText('Dir fehlt eine Rolle')).toBeDefined();
  });
});

describe('Wenn /api/me scheitert', () => {
  // Die App versucht es zweimal erneut; danach muss ein Fehler statt „lädt …“ erscheinen.
  it('zeigt die Lieferantenseite einen Fehler statt endlos „lädt …“', async () => {
    api.meStatus = 503;
    renderAt('/lieferanten');
    expect(
      await screen.findByText(
        'Die Lieferanten konnten nicht geladen werden. Lade die Seite neu.',
        {},
        { timeout: 6000 },
      ),
    ).toBeDefined();
  }, 10_000);

  it('zeigt die Kachel einen Fehler statt endlos „lädt …“', async () => {
    api.meStatus = 503;
    renderAt('/uebersicht');
    expect(await screen.findByText('Gerade nicht geladen', {}, { timeout: 6000 })).toBeDefined();
  }, 10_000);
});

describe('Kachel Lieferanten auf der Übersicht', () => {
  it('zeigt Anzahl und Gesamtspend statt des Release-Hinweises', async () => {
    renderAt('/uebersicht');
    const region = await screen.findByRole('region', { name: 'Bereiche' });
    const tile = await within(region).findByText(/^3 Lieferanten/);
    expect(text(tile)).toBe('3 Lieferanten · 10.230.000 € Jahresspend 2025');
    expect(text(tile.closest('a'))).not.toContain('Kommt mit Release');
  });
});

// Seit PLT-02 (neuer Zuschnitt): ohne Organisation nur der Hinweis, ohne Feature buyer der Hinweis
// zum Lieferantenzugang. Die Einstellungen bleiben erreichbar.
const areaLinks = ['Übersicht', 'Lieferanten', 'Beziehungen', 'Beziehungspuls'];
const visibleAreaLinks = () => {
  const navigation = screen.getByRole('navigation', { name: 'Hauptnavigation' });
  return areaLinks.filter((name) => within(navigation).queryByRole('link', { name }) !== null);
};

describe('Ein Nutzer ohne Organisation sieht den Hinweis', () => {
  const missing =
    'Deine Organisation ist noch nicht freigeschaltet. Wende dich an deinen Ansprechpartner.';
  const withoutOrganization = () => {
    api.me = {
      ...anna,
      organization: null,
      permissions: {
        viewOrganizationSettings: false,
        viewBuyerAreas: false,
        viewSuppliers: false,
        switchCustomer: false,
      },
    };
  };

  it.each([
    '/uebersicht',
    '/lieferanten',
    '/beziehungen',
    '/puls',
    '/jbp',
    '/qbr',
    '/pnl',
    '/gibt-es-nicht',
  ])('sieht auf %s nur den Hinweis, keine Bereiche', async (path) => {
    withoutOrganization();
    renderAt(path);
    expect(await screen.findByText(missing)).toBeDefined();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(visibleAreaLinks()).toEqual([]);
    expect(suppliersRequested()).toBe(false);
  });

  it('erreicht die Einstellungen weiterhin, ohne Abschnitt Organisation', async () => {
    withoutOrganization();
    renderAt('/einstellungen');
    expect(await screen.findByRole('heading', { level: 1, name: 'Einstellungen' })).toBeDefined();
    expect(screen.queryByText(missing)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Organisation' })).toBeNull();
  });

  it('sieht keinen Hinweis, wenn eine Organisation zugeordnet ist', async () => {
    renderAt('/uebersicht');
    await screen.findByText(/^3 Lieferanten/);
    expect(screen.queryByText(missing)).toBeNull();
  });
});

describe('Ein Nutzer ohne Feature buyer sieht die Käuferbereiche nicht', () => {
  const soon = 'Der Lieferantenzugang kommt bald.';

  it.each(['/uebersicht', '/lieferanten', '/pnl'])(
    'sieht auf %s den Hinweis zum Lieferantenzugang',
    async (path) => {
      api.me = {
        ...anna,
        organization: { id: 'org-l', name: 'Test-Lieferant (Demo)' },
        permissions: { ...anna.permissions, viewBuyerAreas: false, viewSuppliers: false },
      };
      renderAt(path);
      expect(await screen.findByText(soon)).toBeDefined();
      expect(visibleAreaLinks()).toEqual([]);
      expect(suppliersRequested()).toBe(false);
    },
  );

  it('sieht die eigene Organisation in den Einstellungen', async () => {
    api.me = {
      ...anna,
      organization: { id: 'org-l', name: 'Test-Lieferant (Demo)' },
      permissions: { ...anna.permissions, viewBuyerAreas: false, viewSuppliers: false },
    };
    api.organization = { name: 'Test-Lieferant (Demo)', country: 'DE', members: [] };
    renderAt('/einstellungen');
    expect(await screen.findByText('Test-Lieferant (Demo)')).toBeDefined();
  });
});

describe('Beispieldaten in den Tests', () => {
  it('sind nach Spend absteigend sortiert wie die API', () => {
    const spends = sampleSuppliers.suppliers.map((s) => s.annualSpend.amountCents);
    expect(spends).toEqual([...spends].sort((a, b) => b - a));
  });
});
