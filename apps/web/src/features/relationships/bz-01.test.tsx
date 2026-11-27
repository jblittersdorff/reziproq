// @vitest-environment jsdom
import type { RelationshipsResponse } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  actionsFor,
  anna,
  api,
  renderAt,
  sampleRelationships,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';

// BZ-01 (K2-b.4): Seite Lieferanten, Linse Liste, nach Vorlage Lieferanten. Kopf, Als Nächstes,
// Das Wichtigste, Filter-Chips, „Mehr Filter“, Sortierung, Zeilen mit Mini-Spiegel (ZQ-01).

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

/** Text ohne geschützte Leerzeichen, die Intl zwischen Betrag und Währung setzt */
const plain = (value: string | null | undefined) => (value ?? '').replace(/[\u00a0\u202f]/g, ' ');
/** Die Liste unter den Filtern, ohne die Zeilen von „Das Wichtigste“ */
const list = () =>
  document.querySelector<HTMLElement>('[data-slot="relationship-rows"]') as HTMLElement;
/** Namen der Zeilen in der Reihenfolge der Liste */
const names = () =>
  [...(list()?.querySelectorAll('a[href^="/lieferanten/"] b') ?? [])].map((name) =>
    plain(name.firstChild?.textContent).trim(),
  );
const line = (name: RegExp) => within(list()).getByRole('link', { name });
const requested = (prefix: string) =>
  vi
    .mocked(fetch)
    .mock.calls.map(([url]) => String(url))
    .filter((url) => url.startsWith(prefix));

describe('BZ-01 Linse Liste', () => {
  it('Kopf mit Zahl, Spend und Portfolio; Umschalter Liste und Segmente', async () => {
    renderAt('/beziehungen');
    expect(await screen.findByRole('heading', { level: 1, name: 'Lieferanten' })).toBeTruthy();
    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName === 'SPAN' &&
          plain(element.textContent) ===
            '4 Beziehungen · 11,83 Mio. € Spend 2026 · 5 Lieferanten im Portfolio',
      ),
    ).toBeTruthy();
    const lenses = screen.getByRole('navigation', { name: 'Ansicht' });
    expect(within(lenses).getByRole('link', { name: 'Liste' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(within(lenses).getByRole('link', { name: 'Segmente' }).getAttribute('href')).toBe(
      '/beziehungen?linse=segmente',
    );
    expect(document.title).toContain('Lieferanten');
  });

  it('Zeilen nach Aufmerksamkeit mit Anzeigename, grauer Zeile, Segment-Chip und Mini-Spiegel', async () => {
    renderAt('/beziehungen');
    await screen.findByText('Rheintal Elektronik');
    expect(names()).toEqual([
      'Rheintal Elektronik',
      'Silesia Guss',
      'Kessler Präzision',
      'Alpen Sensorik',
    ]);
    const rheintal = line(/Rheintal Elektronik/);
    // LS-01: ohne Rechtsform, „(Demo)“ als Kennzeichen
    expect(within(rheintal).getByText('Demo')).toBeTruthy();
    expect(plain(rheintal.textContent)).toContain(
      'Leiterplatten · Deutschland · 4,82 Mio. € · 1 Zusage überfällig',
    );
    expect(within(rheintal).getByText('Strategisch')).toBeTruthy();
    // Desktop und Telefon haben je einen Mini-Spiegel; CSS zeigt nur einen (jsdom kennt kein CSS)
    expect(
      within(rheintal).getAllByRole('img', {
        name: 'Zusagen gehalten: ihr 90 %, Rheintal Elektronik 78 %',
      }),
    ).toHaveLength(2);
    const silesia = line(/Silesia Guss/);
    expect(plain(silesia.textContent)).toContain(
      'Sandguss · Polen · 3,15 Mio. € · Liefertreue 86 %',
    );
    const kessler = line(/Kessler Präzision/);
    expect(within(kessler).getByText('strittig')).toBeTruthy();
    expect(plain(kessler.textContent)).toContain('Segment strittig');
    const alpen = line(/Alpen Sensorik/);
    expect(within(alpen).getByText('ohne Segment')).toBeTruthy();
    expect(within(alpen).getByText('noch keine Zusagen')).toBeTruthy();
    // Jede Zeile führt in die Akte des Lieferanten, ohne Detailleiste
    expect(rheintal.getAttribute('href')).toBe('/lieferanten/00000000-0000-7000-8000-000000000001');
  });

  it('Das Wichtigste: Satz aus belegten Zahlen und die Zeilen Hakt, Fehlt, Info', async () => {
    renderAt('/beziehungen');
    const summary = await screen.findByRole('region', { name: 'Das Wichtigste' });
    expect(within(summary).getByText('Zusammengefasst von Reziproq')).toBeTruthy();
    expect(
      within(summary).getByText(
        'Bei 2 Beziehungen haltet ihr eure Zusagen deutlich besser als der Lieferant. Alpen Sensorik hat noch kein Segment.',
      ),
    ).toBeTruthy();
    const silesia = within(summary).getByRole('link', {
      name: /Silesia Guss hält 3 von 5 Zusagen/,
    });
    expect(silesia.textContent).toContain('Liefertreue 86 % · Hinweis in Arbeit');
    expect(within(silesia).getByText('Hakt')).toBeTruthy();
    expect(silesia.getAttribute('href')).toBe('/warum/00000000-0000-7000-8000-000000000050');
    const unrated = within(summary).getByRole('link', { name: /Alpen Sensorik ohne Segment/ });
    expect(within(unrated).getByText('Fehlt')).toBeTruthy();
    expect(unrated.getAttribute('href')).toBe('/beziehungen?linse=segmente');
    const gap = within(summary).getByRole('link', {
      name: /Rheintal Elektronik: 90 zu 78 % gehaltene Zusagen/,
    });
    expect(gap.textContent).toContain('1 Zusage überfällig: 8D-Bericht Charge 4711');
    expect(within(gap).getByText('Info')).toBeTruthy();
  });

  it('Filter-Chips mit Zahl; die Wahl steht in der Adresse', async () => {
    const router = renderAt('/beziehungen');
    const chips = await screen.findByRole('group', { name: 'Filter' });
    expect(
      within(chips)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Alle · 4', 'Meine · 2', 'Strategisch · 2', 'Offene Zusagen · 2', 'Mehr Filter']);
    expect(
      within(chips).getByRole('button', { name: 'Alle · 4' }).getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(within(chips).getByRole('button', { name: 'Meine · 2' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ filter: 'meine' }));
    expect(names()).toEqual(['Rheintal Elektronik', 'Silesia Guss']);
    fireEvent.click(within(chips).getByRole('button', { name: 'Offene Zusagen · 2' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ filter: 'offene-zusagen' }));
    fireEvent.click(within(chips).getByRole('button', { name: 'Alle · 4' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it('sortiert nach Aufmerksamkeit (Standard) oder nach Spend; aus der Adresse wieder hergestellt', async () => {
    const router = renderAt('/beziehungen');
    const sort = await screen.findByRole('combobox', { name: 'Sortierung' });
    expect((sort as HTMLSelectElement).value).toBe('aufmerksamkeit');
    fireEvent.change(sort, { target: { value: 'spend' } });
    await waitFor(() => expect(router.state.location.search).toEqual({ sortierung: 'spend' }));
    expect(names()).toEqual([
      'Rheintal Elektronik',
      'Silesia Guss',
      'Alpen Sensorik',
      'Kessler Präzision',
    ]);
    tearDownApp();
    setUpApp();
    renderAt('/beziehungen?sortierung=spend&filter=strategisch');
    await screen.findByText('Rheintal Elektronik');
    expect(names()).toEqual(['Rheintal Elektronik', 'Silesia Guss']);
    expect((screen.getByRole('combobox', { name: 'Sortierung' }) as HTMLSelectElement).value).toBe(
      'spend',
    );
  });

  it('ignoriert ungültige Werte in der Adresse', async () => {
    renderAt('/beziehungen?filter=keiner&sortierung=name&portfolio=ja');
    await screen.findByText('Rheintal Elektronik');
    expect(names()).toHaveLength(4);
    expect(requested('/api/beziehungen')).toEqual(['/api/beziehungen']);
  });

  it('Mehr Filter: Portfolio holt die Entwürfe (E-K2-10), „Beendete zeigen“ die beendeten (PLT-03)', async () => {
    const router = renderAt('/beziehungen');
    const more = await screen.findByRole('button', { name: 'Mehr Filter' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(
      screen.getByRole('switch', { name: 'Auch 1 importierten Lieferanten ohne Anbindung zeigen' }),
    );
    await screen.findByText('Test-Lieferant');
    expect(router.state.location.search).toEqual({ portfolio: 1 });
    expect(requested('/api/beziehungen')).toContain('/api/beziehungen?portfolio=1');
    expect(plain(line(/Test-Lieferant/).textContent)).toContain('ohne Anbindung');
    fireEvent.click(screen.getByRole('switch', { name: 'Beendete zeigen' }));
    await screen.findByText('Lombardia Fonderie');
    expect(names().at(-1)).toBe('Lombardia Fonderie');
    expect(plain(line(/Lombardia Fonderie/).textContent)).toContain('beendet');
    expect(screen.getByRole('button', { name: 'Mehr Filter · 2' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    await waitFor(() => expect(names()).toHaveLength(4));
  });

  it('Mehr Filter: Segment, Soll-Typ, Warengruppe mit Untergruppen und Business Unit (NAV-12)', async () => {
    renderAt('/beziehungen?wg=mg-gu');
    // Guss schließt Sandguss ein; mit gesetztem Filter ist „Mehr Filter“ offen
    await waitFor(() => expect(names()).toEqual(['Silesia Guss']));
    expect(screen.getByRole('button', { name: 'Mehr Filter · 1' })).toBeTruthy();
    const select = (label: string) => screen.getByRole('combobox', { name: label });
    fireEvent.change(select('Warengruppe'), { target: { value: '' } });
    fireEvent.change(select('Segment'), { target: { value: 'strittig' } });
    await waitFor(() => expect(names()).toEqual(['Kessler Präzision']));
    fireEvent.change(select('Segment'), { target: { value: 'ohne' } });
    await waitFor(() => expect(names()).toEqual(['Alpen Sensorik']));
    fireEvent.change(select('Segment'), { target: { value: '' } });
    fireEvent.change(select('Soll-Typ'), { target: { value: '3-3' } });
    await waitFor(() =>
      expect(names()).toEqual(['Rheintal Elektronik', 'Silesia Guss', 'Kessler Präzision']),
    );
    fireEvent.change(select('Business Unit'), { target: { value: 'bu-2' } });
    await screen.findByText('Kein Lieferant passt zu diesen Filtern.');
    fireEvent.change(select('Soll-Typ'), { target: { value: '' } });
    await waitFor(() => expect(names()).toEqual(['Alpen Sensorik']));
    // Die Chips zählen über die gefilterten Zeilen
    expect(screen.getByRole('button', { name: 'Alle · 1' })).toBeTruthy();
  });

  it('WG-18: mit Filter Warengruppe zeigt der Chip das Segment dort', async () => {
    renderAt('/beziehungen?wg=mg-lp');
    await waitFor(() => expect(names()).toContain('Rheintal Elektronik'));
    const rheintal = line(/Rheintal Elektronik/);
    expect(within(rheintal).getByText('Hebeln')).toBeTruthy();
    expect(within(rheintal).queryByText('Strategisch')).toBeNull();
    expect(document.body.textContent).toContain('Segment in Leiterplatten');
  });

  it('zeigt acht Zeilen und darunter „N weitere Beziehungen“; ein Klick zeigt alle', async () => {
    const base = sampleRelationships.rows[0];
    const rows = Array.from({ length: 12 }, (_, index) => ({
      ...base,
      relationshipId: `00000000-0000-7000-8000-0000000001${String(index).padStart(2, '0')}`,
      name: `Lieferant ${String(index + 1).padStart(2, '0')}`,
      reason: null,
      attention: 0,
      spend: { amountCents: (12 - index) * 10_000_000, currency: 'EUR' },
    })) as RelationshipsResponse['rows'];
    api.relationships.body = { ...sampleRelationships, rows };
    renderAt('/beziehungen');
    const more = await screen.findByRole('button', { name: /4 weitere Beziehungen/ });
    expect(names()).toHaveLength(8);
    expect(plain(more.textContent)).toContain(
      'Lieferant 09, Lieferant 10, Lieferant 11 und 1 weitere · 1 Mio. €',
    );
    fireEvent.click(more);
    await waitFor(() => expect(names()).toHaveLength(12));
  });

  it('Pflege: Importieren immer, Hinzufügen nur mit Recht (PLT-03b)', async () => {
    renderAt('/beziehungen');
    expect(
      (await screen.findByRole('link', { name: /Lieferanten importieren/ })).getAttribute('href'),
    ).toBe('/lieferanten/importieren');
    expect(screen.getByRole('link', { name: /Lieferant hinzufügen/ }).getAttribute('href')).toBe(
      '/lieferanten/neu',
    );
    tearDownApp();
    setUpApp();
    api.permissions = actionsFor.viewer;
    renderAt('/beziehungen');
    await screen.findByRole('link', { name: /Lieferanten importieren/ });
    expect(screen.queryByRole('link', { name: /Lieferant hinzufügen/ })).toBeNull();
  });

  it('Als Nächstes zeigt das Thema über alle Beziehungen (scope relationships)', async () => {
    api.handle = ({ url }) =>
      url === '/api/start/als-naechstes?bereich=beziehungen'
        ? Response.json({
            next: {
              scope: 'relationships',
              item: {
                id: 'task-1',
                kind: 'action',
                supplier: 'Rheintal Elektronik',
                detail: null,
                dueDate: '2026-11-23',
                href: '/lieferanten/00000000-0000-7000-8000-000000000001',
              },
              overdueDays: 0,
              minutes: 15,
            },
          })
        : undefined;
    renderAt('/beziehungen');
    await waitFor(() => expect(document.querySelector('[data-slot="next-card"]')).not.toBeNull());
    expect(document.querySelector('[data-slot="next-card"]')?.textContent).toContain(
      'Rheintal Elektronik',
    );
    expect(requested('/api/start/als-naechstes')).toContain(
      '/api/start/als-naechstes?bereich=beziehungen',
    );
  });

  it('leer, Fehler und ohne Recht haben eigene Zustände', { timeout: 20_000 }, async () => {
    api.relationships.body = {
      ...sampleRelationships,
      head: { active: 0, spend: [], portfolio: 0 },
      rows: [],
    };
    api.relationships.drafts = [];
    renderAt('/beziehungen');
    expect(await screen.findByText('Noch keine Lieferanten.')).toBeTruthy();
    tearDownApp();
    setUpApp();
    api.relationships = { ...api.relationships, status: 500, body: { statusCode: 500 } };
    renderAt('/beziehungen');
    // Ein Fehler des Servers wird zweimal wiederholt, bevor die Seite ihn zeigt
    expect(
      await screen.findByText(/konnten nicht geladen werden/, {}, { timeout: 8000 }),
    ).toBeTruthy();
    tearDownApp();
    setUpApp();
    api.relationships = {
      ...api.relationships,
      status: 403,
      body: { statusCode: 403, code: 'keine_berechtigung' },
    };
    renderAt('/beziehungen');
    expect(await screen.findByText('Dir fehlt eine Rolle')).toBeTruthy();
    tearDownApp();
    setUpApp();
    api.me = { ...anna, permissions: { ...anna.permissions, viewSuppliers: false } };
    renderAt('/beziehungen');
    await screen.findByRole('heading', { level: 1, name: 'Lieferanten' });
    await waitFor(() => expect(requested('/api/beziehungen')).toEqual([]));
  });
});

describe('BZ-01 Linse Segmente bis K2-b.5', () => {
  it('der Umschalter führt zur Linse Segmente; alte Adressen der Matrix öffnen sie', async () => {
    renderAt('/beziehungen?linse=segmente');
    const lenses = await screen.findByRole('navigation', { name: 'Ansicht' });
    expect(
      within(lenses).getByRole('link', { name: 'Segmente' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(requested('/api/beziehungen')).toEqual([]);
  });
});
