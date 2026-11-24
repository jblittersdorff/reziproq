// @vitest-environment jsdom

import type { OverviewInsight, SupplierRings } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  actionsFor,
  anna,
  api,
  renderAt,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';
import { expectPageLimits } from '@/testing/page-limits';

// Tests zu docs/specs/AW-01.md und NAV-10 in der Oberfläche: Übersicht mit einem Ringpaar, zwei
// Zeilen und drei Fragevorschlägen; ohne Jahresziel kein äußerer Ring; Ringpaar des Lieferanten.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

let overview: OverviewInsight;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sent = [];
  api.me = { ...anna, orgRole: 'admin' };
  api.permissions = actionsFor.admin;
  overview = {
    fiscalYear: 2026,
    currency: 'EUR',
    securedEbitCents: 41_200_000,
    goalEbitCents: 60_000_000,
    canSetGoal: true,
    focusTotal: 12,
    focusWithApprovedJbp: 9,
    inProgress: { lowCents: 12_000_000, highCents: 31_000_000 },
    cashCents: 8_000_000,
  };
  api.handle = (request) => {
    if (request.url === '/api/uebersicht') return Response.json(overview);
    if (request.url === '/api/uebersicht/ziel') {
      sent.push(request);
      return new Response(null, { status: 204 });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const outerRing = () => document.querySelector('[data-slot="goal-rings"] circle.stroke-petrol');
const todayIso = () => new Date().toISOString().slice(0, 10);
const inDays = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const railItem = (index: number) => ({
  id: `meeting:${index}`,
  date: inDays(index + 1),
  kind: 'meeting' as const,
  source: 'meeting' as const,
  title: `Termin ${index}`,
  counterpart: 'Rheintal',
  detail: null,
  startsAt: null,
  progress: null,
  href: `/lieferanten/0190a0a0-0000-7000-8000-00000000000${index % 10}/umsetzung/termine/x${index}`,
  relationshipId: null,
  categoryId: null,
});

// NAV-10 1.1 (Vorlagen Uebersicht.dc.html, A-Uebersicht.dc.html): Lagebild mit Ergebnissen,
// „Als Nächstes“, Zusammenfassung, Terminschiene und je Bereich mit Daten einer Diagrammkarte.
describe('NAV-10 1.1 Übersicht', () => {
  beforeEach(() => {
    overview = {
      ...overview,
      quarters: [
        { quarter: 1, securedCents: 6_400_000, state: 'past' },
        { quarter: 2, securedCents: 9_800_000, state: 'past' },
        { quarter: 3, securedCents: 14_100_000, state: 'past' },
        { quarter: 4, securedCents: 10_900_000, state: 'current' },
      ],
      sinceStartSecuredCents: 52_000_000,
    };
  });

  it('Ring nur mit Jahresziel, daneben Zahl, Ziel und was fehlt; Säulen je Quartal; Cash getrennt', async () => {
    renderAt('/wert');
    expect(
      await screen.findByText(/von 600.000 € Jahresziel\. Es fehlen 188.000 €\./),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Wert' })).toBeTruthy();
    expect(outerRing()).not.toBeNull();
    const columns = screen.getByRole('list', { name: 'EBIT gesichert je Quartal' });
    expect(within(columns).getAllByRole('listitem')).toHaveLength(4);
    expect(within(columns).getByText('Q4 bis heute')).toBeTruthy();
    // EBIT und Cash nie addiert: 412.000 € + 80.000 € ergäben 492.000 €
    expect(screen.queryByText(/492/)).toBeNull();
    expect(
      screen.getByText('Cash 80.000 € wird getrennt gezählt und nie zum EBIT addiert.'),
    ).toBeTruthy();
    expectPageLimits();
  });

  it('der Zeitraum Quartal zeigt das laufende Quartal ohne Ring, Seit Start die ganze Summe', async () => {
    renderAt('/wert');
    fireEvent.click(await screen.findByRole('radio', { name: 'Quartal' }));
    expect(await screen.findByText('Ergebnisse Q4 · nur vom Controlling bestätigt')).toBeTruthy();
    expect(outerRing()).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Seit Start' }));
    expect(await screen.findByText(/520.000 € EBIT/)).toBeTruthy();
  });

  it('ohne Jahresziel kein Ring; Admin oder Lead legt es fest', async () => {
    overview = { ...overview, goalEbitCents: null };
    renderAt('/wert');
    expect(await screen.findByText('Ohne Jahresziel gibt es keinen Ring.')).toBeTruthy();
    expect(outerRing()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ziel festlegen' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Jahresziel EBIT 2026 in Euro' }), {
      target: { value: '600000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ziel speichern' }));
    await waitFor(() => expect(sent[0]?.body).toEqual({ year: 2026, amountCents: 60_000_000 }));
  });

  it('ohne Recht kein Knopf „Ziel festlegen“', async () => {
    overview = { ...overview, goalEbitCents: null, canSetGoal: false };
    renderAt('/wert');
    expect(await screen.findByText('Ohne Jahresziel gibt es keinen Ring.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ziel festlegen' })).toBeNull();
  });

  it('Zusammengefasst von Reziproq: ein Satz, drei Punkte mit Läuft, Hakt, Offen und Quellen', async () => {
    const reports: string[] = [];
    const handle = api.handle;
    overview = {
      ...overview,
      statement: {
        id: '0190a0a0-0000-7000-8000-0000000000ff',
        headline: 'Gesichert sind 69 % des Jahresziels.',
        body: 'Bis zum Ende des Geschäftsjahrs fehlen 188.000 €.',
        sources: [{ key: 'ledger', label: 'Impact-Ledger, vom Controlling bestätigt' }],
      },
      sentences: [
        {
          kind: 'good',
          text: 'Rheintal trägt 120.000 € bei.',
          href: '/lieferanten/x/wirkung/bruecke',
        },
        {
          kind: 'stuck',
          text: 'Bei Kessler wartet ein Potenzial.',
          href: '/lieferanten/y/wirkung/wertpotenziale',
        },
        { kind: 'todo', text: 'Als Nächstes: den JBP mit Kessler freigeben.', href: '/mein-tag' },
      ],
    };
    api.handle = (request) => {
      if (request.url.endsWith('/stimmt-nicht')) {
        reports.push(request.url);
        return new Response(null, { status: 204 });
      }
      return handle?.(request);
    };
    renderAt('/wert');
    const box = (await screen.findByText('Gesichert sind 69 % des Jahresziels.')).closest(
      '[data-slot="so-what"]',
    ) as HTMLElement;
    expect(within(box).getByText('Zusammengefasst von Reziproq')).toBeTruthy();
    expect(
      within(box)
        .getAllByRole('listitem')
        .map((item) => item.textContent?.split(' ')[0]),
    ).toEqual(['LäuftRheintal', 'HaktBei', 'OffenAls']);
    expect(
      within(box).getByText(/^Quellen: Impact-Ledger, vom Controlling bestätigt · Stand/),
    ).toBeTruthy();
    fireEvent.click(within(box).getByRole('button', { name: 'Stimmt nicht' }));
    await waitFor(() =>
      expect(reports).toEqual(['/api/aussagen/0190a0a0-0000-7000-8000-0000000000ff/stimmt-nicht']),
    );
  });

  it('ein Satz mit einer Zahl, die nicht in den Fakten steht, fehlt: es steht der neutrale Titel', async () => {
    overview = {
      ...overview,
      statement: null,
      sentences: [
        { kind: 'todo', text: 'Als Nächstes: das Jahresziel festlegen.', href: '/mein-tag' },
      ],
    };
    renderAt('/wert');
    expect(await screen.findByText('Ergebnisse, Hinweise und Fristen im Überblick')).toBeTruthy();
    expect(screen.queryByText(/Stimmt nicht/)).toBeNull();
  });

  it('genau eine Karte „Als Nächstes“; die Terminschiene zeigt Heute und höchstens acht Einträge', async () => {
    const handle = api.handle;
    api.handle = (request) => {
      if (request.url === '/api/start/als-naechstes') {
        return Response.json({
          next: {
            scope: 'global',
            item: {
              id: 'v1',
              kind: 'validation',
              supplier: 'Rheintal',
              detail: 'Preis Leiterplatten',
              dueDate: todayIso(),
              href: '/wirkung/freigaben',
            },
            overdueDays: 0,
            minutes: 2,
          },
        });
      }
      if (request.url.startsWith('/api/start/termine')) {
        return Response.json({
          from: todayIso(),
          to: inDays(27),
          items: Array.from({ length: 10 }, (_, index) => railItem(index)),
        });
      }
      return handle?.(request);
    };
    renderAt('/wert');
    await screen.findByText('Als Nächstes · heute fällig · 2 Min.');
    expect(document.querySelectorAll('[data-slot="next-card"]')).toHaveLength(1);
    const rail = screen.getByRole('list', { name: 'Termine und Fristen der nächsten vier Wochen' });
    const entries = within(rail).getAllByRole('listitem');
    expect(entries).toHaveLength(1 + 8);
    expect(entries[0]?.getAttribute('data-now')).toBe('true');
    // jeder Eintrag öffnet sein Objekt
    for (const [index, entry] of entries.slice(1).entries()) {
      expect(within(entry).getByRole('link').getAttribute('href')).toBe(railItem(index).href);
    }
    // auf dem Telefon steht „Als Nächstes“ vor den Ergebnissen
    const next = document.querySelector('[data-slot="next-card"]')?.parentElement as HTMLElement;
    expect(next.className).toContain('order-1');
  });

  it('je Bereich mit Daten eine Diagrammkarte; ohne Module keine Karte zu Risiko oder Claims', async () => {
    api.permissions = [...actionsFor.admin, 'portfolio.sehen'];
    const handle = api.handle;
    api.handle = (request) => {
      if (request.url === '/api/warengruppen/strategien') {
        return Response.json({
          year: 2026,
          next: null,
          approvedCount: 1,
          groups: [
            {
              id: '0190a0a0-0000-7000-8000-0000000000a1',
              name: 'Gussteile',
              code: 'G',
              lead: null,
              spend: null,
              supplierCount: 3,
              strategy: {
                id: '0190a0a0-0000-7000-8000-0000000000b1',
                year: 2026,
                status: 'approved',
                version: 1,
                steps: Array(10).fill('done'),
              },
              hidden: false,
              canCreate: false,
            },
            {
              id: '0190a0a0-0000-7000-8000-0000000000a2',
              name: 'Leiterplatten',
              code: 'L',
              lead: null,
              spend: null,
              supplierCount: 2,
              strategy: null,
              hidden: false,
              canCreate: true,
            },
          ],
        });
      }
      if (request.url.startsWith('/api/portfolio/matrix')) {
        const point = (n: number, typeName: string, spendCents: number) => ({
          relationshipId: `0190a0a0-0000-7000-8000-0000000000c${n}`,
          name: `L${n}`,
          spendCents,
          currency: 'EUR',
          businessUnit: null,
          materialGroup: null,
          ist: { impactLevel: 1, qualityLevel: 1, typeName },
          soll: { impactLevel: 1, qualityLevel: 1, typeName },
        });
        return Response.json({
          spendYear: 2025,
          businessUnits: [],
          materialGroups: [],
          points: [point(1, 'Strategisch', 600_000_00), point(2, 'Hebeln', 400_000_00)],
        });
      }
      if (request.url === '/api/start/brauchen-dich') {
        return Response.json({
          items: [
            { relationshipId: '0190a0a0-0000-7000-8000-0000000000c1', reason: 'hint', title: 'x' },
          ],
        });
      }
      return handle?.(request);
    };
    renderAt('/wert');
    expect(await screen.findByText('1 von 2 Strategien sind freigegeben')).toBeTruthy();
    expect(await screen.findByText('Strategisch trägt 60 % des Spend')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /1 Lieferant braucht dich/ }).getAttribute('href'),
    ).toBe('/beziehungen');
    const cards = [...document.querySelectorAll('[data-slot="chart-card"]')].map(
      (card) => card.querySelector('span')?.textContent,
    );
    expect(cards).not.toContain('Risiko');
    expect(cards).not.toContain('Claims');
    expect(document.body.textContent).not.toMatch(/Claims|Risikobild/);
  });
});

describe('AW-01 Lieferant · Überblick', () => {
  const id = '0190a0a0-0000-7000-8000-000000000001';
  const rings = (target: SupplierRings['target'], canApprove = false): SupplierRings => ({
    fiscalYear: 2026,
    currency: 'EUR',
    securedEbitCents: 3_000_000,
    target,
    commitments: { due: 2, keptOnTime: 1 },
    canPropose: true,
    canApprove,
  });

  it('das Ringpaar zeigt Zusagen im Zeitraum; ein vorgeschlagenes Ziel wartet auf Freigabe', async () => {
    const posted: string[] = [];
    let data = rings({ ebitTargetCents: 5_000_000, approved: false, proposedBy: 'sara' }, true);
    api.handle = (request) => {
      if (request.url === `/api/suppliers/${id}/ergebnisse/ringe`) return Response.json(data);
      if (request.url.endsWith('/ziel/freigeben')) {
        posted.push(request.url);
        data = rings({ ebitTargetCents: 5_000_000, approved: true, proposedBy: 'sara' });
        return new Response(null, { status: 204 });
      }
      if (request.url === `/api/suppliers/${id}`) {
        return Response.json({
          relationshipId: id,
          name: 'Rheintal Elektronik GmbH',
          organizationName: 'Rheintal Elektronik GmbH',
          country: 'DE',
          vatId: null,
          duns: null,
          externalRef: null,
          notes: null,
          status: 'active',
          createdAt: '2026-10-01T08:00:00Z',
          endedAt: null,
          spend: [],
          permissions: { edit: true, editTeam: true },
        });
      }
      return undefined;
    };
    renderAt(`/lieferanten/${id}`);
    expect(await screen.findByText('1 von 2 fälligen rechtzeitig')).toBeTruthy();
    // Unbestätigtes Ziel: kein äußerer Ring, nur die Zahl
    expect(outerRing()).toBeNull();
    expect(screen.getByText(/Ziel .+ vorgeschlagen, Freigabe offen\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ziel freigeben' }));
    await waitFor(() => expect(posted).toHaveLength(1));
    await waitFor(() => expect(outerRing()).not.toBeNull());
    // Ohne Kandidat fehlt die Karte „Größte Chance“
    expect(screen.queryByText('Größte Chance')).toBeNull();
    expectPageLimits(
      document.querySelector('[data-slot="goal-rings"]')?.closest('section') ?? document,
    );
  });

  it('die Karte „Größte Chance“ zeigt das Potenzial und führt zu den Wertpotenzialen', async () => {
    const data = {
      ...rings(null),
      chance: {
        opportunityId: '0190a0a0-0000-7000-8000-0000000000aa',
        templateKey: 'index_clause',
        impactType: 'ebit' as const,
        low: 10_800_000,
        high: 18_000_000,
        confidence: 'medium' as const,
      },
    };
    api.handle = (request) => {
      if (request.url === `/api/suppliers/${id}/ergebnisse/ringe`) return Response.json(data);
      if (request.url === `/api/suppliers/${id}`) {
        return Response.json({
          relationshipId: id,
          name: 'Rheintal Elektronik GmbH',
          organizationName: 'Rheintal Elektronik GmbH',
          country: 'DE',
          vatId: null,
          duns: null,
          externalRef: null,
          notes: null,
          status: 'active',
          createdAt: '2026-10-01T08:00:00Z',
          endedAt: null,
          spend: [],
          permissions: { edit: true, editTeam: true },
        });
      }
      return undefined;
    };
    renderAt(`/lieferanten/${id}`);
    // NAV-10 1.1: als Punkt „Chance“ in „Zusammengefasst von Reziproq“
    const chance = await screen.findByRole('link', { name: /Preisgleitklausel nach Index/ });
    expect(chance.textContent).toMatch(/^Chance/);
    expect(chance.textContent).toMatch(/108.+bis.+180/);
    expect(chance.getAttribute('href')).toBe(
      `/lieferanten/${id}/wirkung/wertpotenziale#potenzial-0190a0a0-0000-7000-8000-0000000000aa`,
    );
  });

  it('die Karte „Größtes Risiko“ zeigt den Hinweis mit Schwere und führt zu ihm (KI-16)', async () => {
    const data = {
      ...rings(null),
      risk: {
        hintId: '0190a0a0-0000-7000-8000-0000000000bb',
        ruleKey: 'performance_drop' as const,
        detail: { kpi: 'Liefertreue', months: 3 },
        severity: 'high' as const,
      },
    };
    api.handle = (request) => {
      if (request.url === `/api/suppliers/${id}/ergebnisse/ringe`) return Response.json(data);
      if (request.url === `/api/suppliers/${id}`) {
        return Response.json({
          relationshipId: id,
          name: 'Rheintal Elektronik GmbH',
          organizationName: 'Rheintal Elektronik GmbH',
          country: 'DE',
          vatId: null,
          duns: null,
          externalRef: null,
          notes: null,
          status: 'active',
          createdAt: '2026-10-01T08:00:00Z',
          endedAt: null,
          spend: [],
          permissions: { edit: true, editTeam: true },
        });
      }
      return undefined;
    };
    renderAt(`/lieferanten/${id}`);
    expect(
      await screen.findByRole('heading', {
        name: '„Liefertreue“ seit 3 Monaten unter Ziel und schlechter werdend',
      }),
    ).toBeTruthy();
    // NAV-10 1.1: Ein Hinweis hoher Schwere ist „Als Nächstes“, mit Schwere als Text; dazu der
    // Punkt „Risiko“ in der Zusammenfassung.
    const card = document.querySelector('[data-slot="next-card"]') as HTMLElement;
    expect(card.textContent).toContain('hoch');
    expect(within(card).getByRole('link', { name: 'Hinweis ansehen' }).getAttribute('href')).toBe(
      '/hinweise?hinweis=0190a0a0-0000-7000-8000-0000000000bb',
    );
    const point = screen.getByRole('link', { name: /^Risiko/ });
    expect(point.getAttribute('href')).toBe(
      '/hinweise?hinweis=0190a0a0-0000-7000-8000-0000000000bb',
    );
  });
});
