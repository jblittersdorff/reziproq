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

// Oberflächentests zu docs/specs/PLT-02.md und PLT-03.md (Teil a): Lieferantenliste und Hinweise.

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
  it('Anzahl und Gesamtspend aus der API stehen oben, ohne beendete Beziehungen', async () => {
    renderAt('/lieferanten');
    expect(await screen.findByText(/^4 Lieferanten/)).toBeDefined();
    const heading = screen.getByRole('heading', { level: 1, name: 'Lieferanten' });
    expect(text(heading.parentElement)).toContain('4 Lieferanten · 10.230.000 € Jahresspend 2025');
  });

  it('Spend erscheint als Euro im deutschen Format; Karten zeigen Name, Land und eigene Nummer', async () => {
    renderAt('/lieferanten');
    const list = await screen.findByRole('list', { name: 'Lieferanten' });
    const cards = within(list).getAllByRole('listitem');
    expect(cards).toHaveLength(4);
    const first = text(cards[0] ?? null);
    expect(first).toContain('Rheintal Elektronik GmbH (Demo)');
    expect(first).toContain('Deutschland');
    expect(first).toContain('Eigene NummerL-10001');
    expect(first).toContain('Jahresspend 2025');
    // Deutsches Format, ganze Euro ohne Nachkommastellen; in der Datenbank 482000000 Cent.
    expect(first).toContain('4.820.000 €');
    expect(first).not.toMatch(/4\.820\.000,00/);
    // Entwurf mit Kennzeichen und ohne Spend
    const draft = text(cards[3] ?? null);
    expect(draft).toContain('Entwurf');
    expect(draft).toContain('Jahresspend 2025–');
  });

  it('sortiert standardmäßig nach Spend, absteigend, ohne Spend zuletzt', async () => {
    renderAt('/lieferanten');
    expect(await cardNames()).toEqual([
      'Rheintal Elektronik GmbH (Demo)',
      'Silesia Guss Sp. z o.o. (Demo)',
      'Alpen Sensorik GmbH (Demo)',
      'Test-Lieferant (Demo)',
    ]);
    expect(screen.getByRole('combobox', { name: 'Sortieren' })).toHaveProperty('value', 'spend');
  });

  it('Suche, Sortierung und der Filter „Beendete zeigen“ funktionieren und stehen in der Adresse', async () => {
    const router = renderAt('/lieferanten');
    await cardNames();

    fireEvent.change(screen.getByRole('combobox', { name: 'Sortieren' }), {
      target: { value: 'name' },
    });
    expect(await cardNames()).toEqual([
      'Alpen Sensorik GmbH (Demo)',
      'Rheintal Elektronik GmbH (Demo)',
      'Silesia Guss Sp. z o.o. (Demo)',
      'Test-Lieferant (Demo)',
    ]);
    expect(router.state.location.search).toEqual({ sortierung: 'name' });

    fireEvent.click(screen.getByRole('switch', { name: 'Beendete zeigen' }));
    expect(await cardNames()).toContain('Lombardia Fonderie S.p.A. (Demo)');
    expect(text(screen.getByText('Lombardia Fonderie S.p.A. (Demo)').closest('li'))).toContain(
      'Beendet',
    );
    expect(router.state.location.search).toEqual({ sortierung: 'name', beendet: 1 });

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Lieferant oder eigene Nummer suchen' }),
      {
        target: { value: 'l-1000' },
      },
    );
    expect(await cardNames()).toEqual([
      'Alpen Sensorik GmbH (Demo)',
      'Lombardia Fonderie S.p.A. (Demo)',
      'Rheintal Elektronik GmbH (Demo)',
      'Silesia Guss Sp. z o.o. (Demo)',
    ]);
    expect(router.state.location.search).toEqual({
      sortierung: 'name',
      beendet: 1,
      suche: 'l-1000',
    });
  });

  it('stellt Suche, Sortierung und Filter aus der Adresse wieder her', async () => {
    renderAt('/lieferanten?suche=silesia&sortierung=name&beendet=1');
    expect(await cardNames()).toEqual(['Silesia Guss Sp. z o.o. (Demo)']);
    expect(screen.getByRole('searchbox')).toHaveProperty('value', 'silesia');
    expect(screen.getByRole('combobox', { name: 'Sortieren' })).toHaveProperty('value', 'name');
    expect(
      screen.getByRole('switch', { name: 'Beendete zeigen' }).getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('ignoriert ungültige Werte in der Adresse', async () => {
    renderAt('/lieferanten?sortierung=preis&beendet=ja');
    expect(await cardNames()).toHaveLength(4);
    expect(screen.getByRole('combobox', { name: 'Sortieren' })).toHaveProperty('value', 'spend');
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
      body: { suppliers: [], count: 0, totalSpend: [], spendYear: 2025 },
    };
    renderAt('/lieferanten');
    expect(await screen.findByText('Noch keine Lieferanten.')).toBeDefined();
    expect(screen.getByText('Füge den ersten hinzu oder importiere eine Liste.')).toBeDefined();
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
});

// Seit PLT-02 (neuer Zuschnitt): ohne Organisation nur der Hinweis, ohne Feature buyer der Hinweis
// zum Lieferantenzugang. Profil und Einstellungen bleiben erreichbar. Seit PLT-11 fehlen dann die
// Käuferziele in der globalen Leiste.
const areaLinks = ['Start', 'Lieferanten', 'Portfolio', 'Wirkung', 'Fragen'];
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

  it.each(['/start', '/lieferanten', '/portfolio', '/wirkung', '/fragen', '/gibt-es-nicht'])(
    'sieht auf %s nur den Hinweis, keine Bereiche',
    async (path) => {
      withoutOrganization();
      renderAt(path);
      expect(await screen.findByText(missing)).toBeDefined();
      expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
      expect(visibleAreaLinks()).toEqual([]);
      expect(suppliersRequested()).toBe(false);
    },
  );

  it('erreicht Profil und Einstellungen weiterhin, ohne Weg zur Organisation', async () => {
    withoutOrganization();
    renderAt('/profil');
    expect(await screen.findByRole('heading', { level: 1, name: 'Profil' })).toBeDefined();
    expect(screen.queryByText(missing)).toBeNull();
    expect(screen.queryByRole('link', { name: /Organisation/ })).toBeNull();
  });

  it('sieht keinen Hinweis, wenn eine Organisation zugeordnet ist', async () => {
    renderAt('/lieferanten');
    await screen.findByText(/^4 Lieferanten/);
    expect(screen.queryByText(missing)).toBeNull();
  });
});

describe('Ein Nutzer ohne Feature buyer sieht die Käuferbereiche nicht', () => {
  const soon = 'Der Lieferantenzugang kommt bald.';

  it.each(['/start', '/lieferanten', '/wirkung'])(
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
    renderAt('/einstellungen/organisation');
    expect(await screen.findByText('Test-Lieferant (Demo)')).toBeDefined();
  });
});

describe('Beispieldaten in den Tests', () => {
  it('sind nach Spend absteigend sortiert wie die API, ohne Spend zuletzt', () => {
    const spends = sampleSuppliers.suppliers.map((s) => s.spend?.amountCents ?? -1);
    expect(spends).toEqual([...spends].sort((a, b) => b - a));
  });

  it('zählen wie die API nur nicht beendete Beziehungen', () => {
    const current = sampleSuppliers.suppliers.filter((s) => s.status !== 'ended');
    expect(sampleSuppliers.count).toBe(current.length);
    expect(sampleSuppliers.totalSpend).toEqual([
      {
        amountCents: current.reduce((sum, s) => sum + (s.spend?.amountCents ?? 0), 0),
        currency: 'EUR',
      },
    ]);
  });
});
