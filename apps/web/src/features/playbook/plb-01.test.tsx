// @vitest-environment jsdom
import type { FormatItem, PlaybookCatalog, PlaybookPreview, RuleItem } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Oberflächentests zu docs/specs/PLB-01.md: Kataloge für Spielregeln und Formate.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const id = (n: number) => `0190a0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const text = (de: string) => ({ de, en: `${de} EN` });
const rule = (n: number, overrides: Partial<RuleItem>): RuleItem => ({
  id: id(n),
  kind: 'right',
  group: 'cost',
  title: text(`Eintrag ${n}`),
  description: text('Beschreibung'),
  counterpartId: null,
  minImpactLevel: 1,
  ...overrides,
});
const rules: RuleItem[] = [
  rule(1, {
    title: text('Mehrjährige Preisvereinbarung'),
    counterpartId: id(2),
    minImpactLevel: 3,
  }),
  rule(2, {
    kind: 'obligation',
    title: text('Offene Kostenstruktur'),
    counterpartId: id(1),
    minImpactLevel: 3,
  }),
  rule(3, { group: 'growth', title: text('Gemeinsames Dashboard') }),
];
const formats: FormatItem[] = [
  {
    id: id(10),
    name: text('Neustart der Beziehung'),
    purpose: text('Klären'),
    level: 'management',
    cadence: 'on_demand',
    minImpactLevel: 1,
    forQualityLevels: [1],
  },
];

let catalog: PlaybookCatalog;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  catalog = { rules, formats, canManage: true };
  sent = [];
  api.handle = (request) => {
    if (request.url === '/api/playbook') {
      if (request.method !== 'GET') return undefined;
      return Response.json(catalog);
    }
    if (
      request.url.startsWith('/api/playbook/rules') ||
      request.url.startsWith('/api/playbook/formats')
    ) {
      sent.push(request);
      return Response.json(catalog, { status: request.method === 'POST' ? 201 : 200 });
    }
    if (request.url === '/api/playbook/preview/1/1') {
      const preview: PlaybookPreview = {
        impactLevel: 1,
        qualityLevel: 1,
        typeName: 'Problemlieferant',
        rules: [rules[2] as RuleItem],
        formats,
      };
      return Response.json(preview);
    }
    if (request.url === '/api/segment-model') return Response.json({ active: null, draft: null });
    return undefined;
  };
});

afterEach(tearDownApp);

describe('PLB-01 Kataloge', () => {
  it('die Übersicht zeigt beide Kacheln, die Warnung und die Vorschau für alle neun Typen', async () => {
    renderAt('/einstellungen/spielregeln');
    expect(await screen.findByText('1 Paar')).toBeDefined();
    expect(screen.getByText('1 Recht ohne Gegenpflicht')).toBeDefined();
    expect(screen.getByText('1 Format')).toBeDefined();
    const preview = screen.getByRole('region', { name: 'Vorschau je Typ' });
    expect(within(preview).getAllByRole('link')).toHaveLength(9);
    expect(within(preview).getAllByText('Impact hoch · Qualität schwach').length).toBeGreaterThan(
      0,
    );
  });

  it('Rechte stehen nach Gruppe neben ihrer Gegenpflicht; ein Recht ohne Gegenpflicht ist markiert', async () => {
    renderAt('/einstellungen/spielregeln/rechte');
    const cost = await screen.findByRole('table', { name: 'Kosten' });
    expect(within(cost).getAllByRole('row')[1]?.textContent).toBe(
      'Mehrjährige PreisvereinbarungOffene Kostenstrukturhoch',
    );
    const growth = screen.getByRole('table', { name: 'Wachstum' });
    expect(within(growth).getByText('Ohne Gegenpflicht')).toBeDefined();
    expect(screen.getAllByText('Keine Einträge in dieser Gruppe.')).toHaveLength(2);
  });

  it('ein neues Recht ohne Gegenpflicht zeigt eine Warnung und lässt sich speichern', async () => {
    const router = renderAt('/einstellungen/spielregeln/rechte/neu');
    fireEvent.change(await screen.findByLabelText('Titel (Deutsch)'), {
      target: { value: 'Gemeinsame Messe' },
    });
    fireEvent.change(screen.getByLabelText('Titel (Englisch)'), {
      target: { value: 'Joint fair' },
    });
    fireEvent.change(screen.getByLabelText('Beschreibung (Deutsch)'), {
      target: { value: 'Beide stellen gemeinsam aus.' },
    });
    fireEvent.change(screen.getByLabelText('Beschreibung (Englisch)'), {
      target: { value: 'Both exhibit together.' },
    });
    expect(
      screen.getByText('Dieses Recht hat noch keine Gegenpflicht. Du kannst trotzdem speichern.'),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/einstellungen/spielregeln/rechte'),
    );
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: '/api/playbook/rules',
      body: {
        kind: 'right',
        group: 'cost',
        title: { de: 'Gemeinsame Messe', en: 'Joint fair' },
        counterpartId: null,
        minImpactLevel: 1,
      },
    });
    expect(await screen.findByText('Gespeichert.')).toBeDefined();
  });

  it('ohne Text in beiden Sprachen wird nicht gespeichert', async () => {
    renderAt('/einstellungen/spielregeln/rechte/neu');
    fireEvent.change(await screen.findByLabelText('Titel (Deutsch)'), {
      target: { value: 'Nur Deutsch' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect((await screen.findAllByText('Bitte ausfüllen.')).length).toBeGreaterThan(0);
    expect(sent).toEqual([]);
  });

  it('als Gegenseite stehen nur Einträge der anderen Art zur Wahl', async () => {
    renderAt(`/einstellungen/spielregeln/rechte/${id(3)}`);
    const select = (await screen.findByLabelText('Gegenseite')) as HTMLSelectElement;
    expect([...select.options].map((option) => option.textContent)).toEqual([
      'Keine',
      'Kosten · Offene Kostenstruktur',
    ]);
  });

  it('Formate zeigen, für welche Typen sie gelten; Qualitätsstufen werden mitgeschickt', async () => {
    renderAt('/einstellungen/spielregeln/formate');
    expect(
      (await screen.findAllByText('Impact ab niedrig · nur Qualität schwach')).length,
    ).toBeGreaterThan(0);
    renderAt(`/einstellungen/spielregeln/formate/${id(10)}`);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'stark' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      url: `/api/playbook/formats/${id(10)}`,
      body: { forQualityLevels: [1, 3] },
    });
  });

  it('die Vorschau zeigt Rechte, Pflichten und Formate des Typs', async () => {
    renderAt('/einstellungen/spielregeln/typ/1-1');
    expect(await screen.findByText('Gemeinsames Dashboard')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Formate' })).toBeDefined();
    expect(screen.getByText('Neustart der Beziehung')).toBeDefined();
  });

  it('ohne Admin-Recht gibt es kein Neu und das Formular bleibt zu', async () => {
    catalog = { ...catalog, canManage: false };
    api.permissions = actionsFor.member;
    renderAt('/einstellungen/spielregeln/rechte');
    await screen.findByRole('table', { name: 'Kosten' });
    expect(screen.queryByRole('link', { name: 'Neu' })).toBeNull();
    renderAt('/einstellungen/spielregeln/rechte/neu');
    expect(await screen.findByText('Ändern dürfen nur Admins.')).toBeDefined();
  });
});
