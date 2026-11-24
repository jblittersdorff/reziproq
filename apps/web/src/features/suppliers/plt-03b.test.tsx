// @vitest-environment jsdom
import type { SupplierDetail } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Oberflächentests zu docs/specs/PLT-03.md, Teil b: anlegen, bearbeiten, Spend, beenden.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const detail: SupplierDetail = {
  relationshipId: '0190a0a0-0000-7000-8000-000000000001',
  name: 'Rheintal Elektronik GmbH (Demo)',
  organizationName: 'Rheintal Elektronik GmbH (Demo)',
  country: 'DE',
  vatId: 'DE910000001',
  duns: null,
  externalRef: 'L-10001',
  notes: null,
  status: 'active',
  createdAt: '2026-10-01T08:00:00Z',
  endedAt: null,
  spend: [
    { year: 2025, amount: { amountCents: 482_000_000, currency: 'EUR' } },
    { year: 2024, amount: { amountCents: 430_000_000, currency: 'EUR' } },
  ],
  permissions: { edit: true, editTeam: false },
};
const profile = `/lieferanten/${detail.relationshipId}/strategie/profil`;

let requests: { method: string; url: string; body: unknown }[] = [];

const entryId = (year: number) => `0190a0a0-0000-7000-8000-00000000${year}`;
const spend = {
  currency: 'EUR',
  otherCurrencies: [],
  years: [2024, 2025].map((year) => ({
    year,
    kind: 'actual',
    amountCents: year === 2025 ? 482_000_000 : 430_000_000,
    byBusinessUnit: [],
    byMaterialGroup: [],
  })),
  kpis: null,
  entries: [2025, 2024].map((year) => ({
    id: entryId(year),
    year,
    kind: 'actual',
    businessUnit: null,
    materialGroup: null,
    amount: { amountCents: year === 2025 ? 482_000_000 : 430_000_000, currency: 'EUR' },
  })),
  options: { businessUnits: [], materialGroups: [] },
  canEdit: true,
};

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  requests = [];
  api.handle = (request) => {
    requests.push(request);
    const { method, url } = request;
    if (url.startsWith('/api/suppliers/lookup')) {
      return Response.json({ known: url.includes('DE910000001') });
    }
    if (method === 'POST' && url === '/api/suppliers') {
      return Response.json(
        { relationshipId: detail.relationshipId, linked: false },
        { status: 201 },
      );
    }
    if (url === `/api/suppliers/${detail.relationshipId}`) return Response.json(detail);
    // SPL-04: die Spend-Seite liest Einträge und Summen.
    if (url.startsWith(`/api/suppliers/${detail.relationshipId}/spend`))
      return Response.json(spend);
    if (url.startsWith('/api/suppliers/') && method !== 'GET') return Response.json(detail);
    if (url.startsWith('/api/audit')) return Response.json({ entries: [] });
    return undefined;
  };
});

afterEach(tearDownApp);

const field = (label: string) => screen.getByLabelText(label, { exact: false });

describe('Anlegen, Bearbeiten und Spend-Erfassung laufen über eigene Seiten. Speichern und Abbrechen führen zurück.', () => {
  it('der Knopf „Lieferant hinzufügen“ öffnet /lieferanten/neu, Abbrechen führt zurück', async () => {
    const router = renderAt('/beziehungen');
    fireEvent.click(await screen.findByRole('link', { name: 'Lieferant hinzufügen' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Lieferant hinzufügen' }),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe('/lieferanten/neu');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/beziehungen'));
  });

  it('Speichern legt an und führt zum neuen Lieferanten, mit Rückmeldung', async () => {
    const router = renderAt('/lieferanten/neu');
    await screen.findByRole('heading', { level: 1, name: 'Lieferant hinzufügen' });
    fireEvent.change(field('Name'), { target: { value: 'Neu GmbH (Demo)' } });
    fireEvent.change(field('Land'), { target: { value: 'PL' } });
    fireEvent.change(field('Eigene Nummer'), { target: { value: 'L-2' } });
    fireEvent.change(field('Spend in Euro'), { target: { value: '1.250.000,50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(profile));
    expect(requests.find((r) => r.method === 'POST')?.body).toEqual({
      name: 'Neu GmbH (Demo)',
      country: 'PL',
      externalRef: 'L-2',
      spend: { year: 2025, amountCents: 125_000_050 },
    });
    expect(await screen.findByText('Gespeichert.')).toBeDefined();
  });

  it('Bearbeiten und Spend ändern führen über eigene Seiten zurück zur vorigen Ansicht', async () => {
    const router = renderAt(profile);
    // NAV-10 1.1 (L-Profil): „Profil bearbeiten“ als Zweitknopf im Kopf der Seite
    fireEvent.click(await screen.findByRole('link', { name: 'Profil bearbeiten' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Deine Werte bearbeiten' }),
    ).toBeDefined();
    fireEvent.change(field('Notizen'), { target: { value: 'Rahmenvertrag bis 2027' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(profile));
    expect(requests.find((r) => r.method === 'PATCH')?.body).toEqual({
      displayName: 'Rheintal Elektronik GmbH (Demo)',
      externalRef: 'L-10001',
      notes: 'Rahmenvertrag bis 2027',
    });

    // Die Karte „Spend je Jahr“ führt zu allen Einträgen.
    fireEvent.click(await screen.findByRole('link', { name: 'Alle Einträge' }));
    const table = await screen.findByRole('table', { name: 'Einträge' });
    expect(
      within(table)
        .getAllByRole('row')
        .map((row) => row.textContent?.replaceAll('\u00a0', ' ')),
    ).toEqual([
      'JahrArtBusiness UnitWarengruppeBetragÄndern',
      '2025IstGanzer LieferantGanzer Lieferant4.820.000,00 €Ändern',
      '2024IstGanzer LieferantGanzer Lieferant4.300.000,00 €Ändern',
    ]);
    fireEvent.click(screen.getByRole('link', { name: 'Eintrag 2025 ändern' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Eintrag ändern' })).toBeDefined();
    expect(field('Spend in Euro')).toHaveProperty('value', '4.820.000');
    fireEvent.change(field('Spend in Euro'), { target: { value: '5.000.000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/lieferanten/${detail.relationshipId}/strategie/spend`,
      ),
    );
    expect(requests.find((r) => r.method === 'PUT')).toMatchObject({
      url: `/api/suppliers/${detail.relationshipId}/spend/eintraege/${entryId(2025)}`,
      body: {
        year: 2025,
        kind: 'actual',
        businessUnitId: null,
        materialGroupId: null,
        amountCents: 500_000_000,
        currency: 'EUR',
      },
    });
  });
});

describe('Pflichtfelder und Formate werden auf der Seite und in der API geprüft (zod in packages/shared)', () => {
  it('zeigt Fehler am Feld und schickt nichts ab', async () => {
    renderAt('/lieferanten/neu');
    await screen.findByRole('heading', { level: 1, name: 'Lieferant hinzufügen' });
    fireEvent.change(field('USt-IdNr.'), { target: { value: '12345' } });
    fireEvent.change(field('D-U-N-S'), { target: { value: '123' } });
    fireEvent.change(field('Spend in Euro'), { target: { value: 'viel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Bitte ausfüllen.')).toBeDefined();
    expect(screen.getByText('Bitte ein Land wählen.')).toBeDefined();
    expect(
      screen.getByText('Zwei Buchstaben und 2 bis 12 Zeichen, z. B. DE123456789.'),
    ).toBeDefined();
    expect(screen.getByText('Genau neun Ziffern.')).toBeDefined();
    expect(screen.getByText('Betrag in Euro, z. B. 1.250.000 oder 1.250.000,50.')).toBeDefined();
    expect(field('Name').getAttribute('aria-invalid')).toBe('true');
    expect(requests.some((r) => r.method === 'POST')).toBe(false);
  });

  it('zeigt Feldfehler aus der API an derselben Stelle', async () => {
    const handle = api.handle;
    api.handle = (request) =>
      request.method === 'POST'
        ? Response.json({ errors: { vatId: ['invalid_vat_id'] } }, { status: 400 })
        : handle?.(request);
    renderAt('/lieferanten/neu');
    await screen.findByRole('heading', { level: 1, name: 'Lieferant hinzufügen' });
    fireEvent.change(field('Name'), { target: { value: 'X' } });
    fireEvent.change(field('Land'), { target: { value: 'DE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(
      await screen.findByText('Zwei Buchstaben und 2 bis 12 Zeichen, z. B. DE123456789.'),
    ).toBeDefined();
  });
});

describe('Ohne USt-IdNr. und D-U-N-S entsteht eine neue Organisation, und keine Seite nennt fremde Organisationen', () => {
  it('nennt bei bekannter USt-IdNr. nur die Verknüpfung, keinen Namen', async () => {
    renderAt('/lieferanten/neu');
    await screen.findByRole('heading', { level: 1, name: 'Lieferant hinzufügen' });
    fireEvent.change(field('USt-IdNr.'), { target: { value: 'de 910000001' } });
    fireEvent.blur(field('USt-IdNr.'));
    const hint = await screen.findByText('Lieferant ist bereits in Reziproq und wird verknüpft.');
    expect(hint.closest('[role="status"]')?.textContent).toBe(
      'Lieferant ist bereits in Reziproq und wird verknüpft.',
    );
    expect(requests.find((r) => r.url.startsWith('/api/suppliers/lookup'))?.url).toBe(
      '/api/suppliers/lookup?ust=DE910000001',
    );
  });

  it('fragt ohne USt-IdNr. und D-U-N-S nichts nach', async () => {
    renderAt('/lieferanten/neu');
    await screen.findByRole('heading', { level: 1, name: 'Lieferant hinzufügen' });
    fireEvent.blur(field('USt-IdNr.'));
    fireEvent.blur(field('D-U-N-S'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requests.some((r) => r.url.startsWith('/api/suppliers/lookup'))).toBe(false);
    expect(screen.queryByText(/wird verknüpft/)).toBeNull();
  });
});

describe('Beenden und Rechte', () => {
  it('beendet mit Bestätigung auf der Seite, ohne Fenster', async () => {
    renderAt(profile);
    fireEvent.click(await screen.findByRole('button', { name: 'Beziehung beenden' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const question = screen.getByRole('group', { name: /Beziehung wirklich beenden/ });
    fireEvent.click(within(question).getByRole('button', { name: 'Beenden' }));
    expect(await screen.findByText('Die Beziehung ist beendet.')).toBeDefined();
    expect(requests.find((r) => r.method === 'POST')?.url).toBe(
      `/api/suppliers/${detail.relationshipId}/beenden`,
    );
  });

  it('zeigt ohne Recht weder Hinzufügen noch Bearbeiten, Beenden oder Jahr hinzufügen', async () => {
    api.permissions = actionsFor.viewer;
    renderAt('/beziehungen');
    await screen.findByText(/^4 Lieferanten/);
    expect(screen.queryByRole('link', { name: 'Lieferant hinzufügen' })).toBeNull();
    tearDownApp();
    setUpApp();
    api.permissions = actionsFor.viewer;
    const handle = (await import('@/testing/app-harness')).api;
    handle.handle = (request) =>
      request.url === `/api/suppliers/${detail.relationshipId}`
        ? Response.json({ ...detail, permissions: { edit: false, editTeam: false } })
        : request.url.startsWith('/api/audit')
          ? Response.json({ entries: [] })
          : undefined;
    renderAt(profile);
    await screen.findByRole('heading', { level: 1, name: 'Profil und Spend' });
    expect(screen.queryByRole('link', { name: 'Profil bearbeiten' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Jahr erfassen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Beziehung beenden' })).toBeNull();
  });

  it('zeigt für eine fremde oder unbekannte Beziehung „Diesen Lieferanten gibt es nicht“', async () => {
    renderAt('/lieferanten/0190a0a0-0000-7000-8000-00000000ffff/strategie/profil');
    expect(
      await screen.findByText('Diesen Lieferanten gibt es nicht', { selector: 'p' }),
    ).toBeDefined();
  });

  it('die Zeilen der Liste führen über die Detailleiste in den Arbeitsbereich (LS-01)', async () => {
    const router = renderAt('/beziehungen');
    const list = await screen.findByRole('list', { name: 'Lieferanten' });
    fireEvent.click(within(list).getAllByRole('button')[0] as HTMLElement);
    fireEvent.click(await screen.findByRole('link', { name: 'Lieferant öffnen' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/lieferanten/rel-Rheintal Elektronik GmbH (Demo)',
      ),
    );
  });
});
