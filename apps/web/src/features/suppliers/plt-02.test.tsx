// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  anna,
  api,
  renderAt,
  sampleRelationships,
  sampleSuppliers,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';

// Oberflächentests zu docs/specs/PLT-02.md und PLT-03.md (Teil a): Lieferantenliste und Hinweise.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
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

/** Namen der Zeilen der Liste (BZ-01), ohne die Zeilen von „Das Wichtigste“ */
const cardNames = async () => {
  await screen.findByRole('group', { name: 'Filter' });
  return [
    ...(document
      .querySelector('[data-slot="relationship-rows"]')
      ?.querySelectorAll('a[href^="/beziehungen/"] b') ?? []),
  ].map((name) => name.firstChild?.textContent?.trim());
};
const row = (name: RegExp) =>
  within(document.querySelector('[data-slot="relationship-rows"]') as HTMLElement).getByRole(
    'link',
    { name },
  );

const suppliersRequested = () =>
  vi
    .mocked(fetch)
    .mock.calls.some(([url]) =>
      ['/api/suppliers', '/api/beziehungen'].some((path) => String(url).startsWith(path)),
    );

// PLT-02, PLT-03a seit BZ-01 (K2-b.4): Liste der Seite Lieferanten. Die eigene Suche ist
// gestrichen (Frag Reziproq übernimmt); Sortierung und „Beendete zeigen“ stehen in der Adresse.
describe('Lieferantenseite', () => {
  it('Anzahl und Spend aus der API stehen oben, ohne beendete Beziehungen', async () => {
    renderAt('/beziehungen');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Lieferanten' });
    await cardNames();
    expect(text(heading.closest('header'))).toContain(
      '4 Beziehungen · 11,83 Mio. € Spend 2026 · 5 Lieferanten im Portfolio',
    );
  });

  it('LS-01: Zeilen zeigen Anzeigename ohne Rechtsform, Demo, Land und Spend in Mio. €', async () => {
    renderAt('/beziehungen');
    expect(await cardNames()).toHaveLength(4);
    const first = text(row(/Rheintal Elektronik/));
    expect(first).toContain('Rheintal Elektronik');
    expect(first).not.toContain('GmbH');
    expect(first).toContain('Demo');
    expect(first).toContain('Deutschland');
    // 482000000 Cent = 4,82 Mio. €
    expect(first).toContain('4,82 Mio. €');
    // Der Entwurf steht erst mit „Mehr Filter: Portfolio“ in der Liste (E-K2-10)
    expect(await cardNames()).not.toContain('Test-Lieferant');
  });

  it('sortiert standardmäßig nach Aufmerksamkeit, auf Wunsch nach Spend, ohne Spend zuletzt', async () => {
    const router = renderAt('/beziehungen');
    expect(await cardNames()).toEqual([
      'Rheintal Elektronik',
      'Silesia Guss',
      'Kessler Präzision',
      'Alpen Sensorik',
    ]);
    const sort = screen.getByRole('combobox', { name: 'Sortierung' });
    expect(sort).toHaveProperty('value', 'aufmerksamkeit');
    fireEvent.change(sort, { target: { value: 'spend' } });
    await waitFor(() => expect(router.state.location.search).toEqual({ sortierung: 'spend' }));
    expect(await cardNames()).toEqual([
      'Rheintal Elektronik',
      'Silesia Guss',
      'Alpen Sensorik',
      'Kessler Präzision',
    ]);
  });

  it('Sortierung und der Filter „Beendete zeigen“ funktionieren und stehen in der Adresse', async () => {
    const router = renderAt('/beziehungen?sortierung=spend');
    await cardNames();
    fireEvent.click(screen.getByRole('button', { name: 'Mehr Filter' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Beendete zeigen' }));
    await waitFor(async () => expect(await cardNames()).toContain('Lombardia Fonderie'));
    expect(text(row(/Lombardia Fonderie/))).toContain('beendet');
    // Beendete stehen am Ende, auch nach Spend
    expect((await cardNames()).at(-1)).toBe('Lombardia Fonderie');
    expect(router.state.location.search).toEqual({ sortierung: 'spend', beendet: 1 });
  });

  it('stellt Sortierung und Filter aus der Adresse wieder her', async () => {
    renderAt('/lieferanten?sortierung=spend&beendet=1');
    await waitFor(async () => expect(await cardNames()).toContain('Lombardia Fonderie'));
    expect(screen.getByRole('combobox', { name: 'Sortierung' })).toHaveProperty('value', 'spend');
    expect(
      screen.getByRole('switch', { name: 'Beendete zeigen' }).getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('ignoriert ungültige Werte in der Adresse', async () => {
    renderAt('/lieferanten?sortierung=preis&beendet=ja');
    expect(await cardNames()).toHaveLength(4);
    expect(screen.getByRole('combobox', { name: 'Sortierung' })).toHaveProperty(
      'value',
      'aufmerksamkeit',
    );
  });

  it('sagt, wenn kein Lieferant zu den Filtern passt', async () => {
    renderAt('/beziehungen?bu=bu-2&filter=meine');
    expect(await screen.findByText('Kein Lieferant passt zu diesen Filtern.')).toBeDefined();
  });

  it('zeigt bei leerer Liste den leeren Zustand aus der Spec', async () => {
    api.relationships = {
      status: 200,
      body: {
        ...sampleRelationships,
        head: { active: 0, spend: [], portfolio: 0 },
        rows: [],
      },
      drafts: [],
      ended: [],
    };
    renderAt('/beziehungen');
    expect(await screen.findByText('Noch keine Lieferanten.')).toBeDefined();
    expect(screen.getByText('Füge den ersten hinzu oder importiere eine Liste.')).toBeDefined();
    expect(screen.queryByRole('group', { name: 'Filter' })).toBeNull();
  });

  it('zeigt ohne Käufer-Rolle einen Hinweis und fragt die Liste nicht an', async () => {
    api.me = { ...anna, permissions: { ...anna.permissions, viewSuppliers: false } };
    renderAt('/beziehungen');
    expect(await screen.findByText('Dir fehlt eine Rolle')).toBeDefined();
    expect(suppliersRequested()).toBe(false);
  });

  it('zeigt den Rollen-Hinweis auch, wenn die API mit keine_berechtigung antwortet', async () => {
    api.relationships = {
      ...api.relationships,
      status: 403,
      body: { statusCode: 403, code: 'keine_berechtigung' },
    };
    renderAt('/beziehungen');
    expect(await screen.findByText('Dir fehlt eine Rolle')).toBeDefined();
  });
});

describe('Wenn /api/me scheitert', () => {
  // Die App versucht es zweimal erneut; danach muss ein Fehler statt „lädt …“ erscheinen.
  it('zeigt die Lieferantenseite einen Fehler statt endlos „lädt …“', async () => {
    api.meStatus = 503;
    renderAt('/beziehungen');
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
const areaLinks = [
  'Heute',
  'Lieferanten',
  'Warengruppen',
  'Ergebnisse',
  'Mein Agent',
  'Frag Reziproq',
];
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
        viewCustomers: false,
        switchCustomer: false,
      },
    };
  };

  it.each(['/heute', '/beziehungen', '/portfolio', '/wert', '/fragen', '/gibt-es-nicht'])(
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
    renderAt('/beziehungen');
    await cardNames();
    expect(screen.queryByText(missing)).toBeNull();
  });
});

describe('Ein Nutzer ohne Feature buyer sieht die Käuferbereiche nicht', () => {
  const soon = 'Der Lieferantenzugang kommt bald.';

  it.each(['/heute', '/beziehungen', '/wert'])(
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
