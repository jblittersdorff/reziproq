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

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
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

describe('AW-01 Übersicht', () => {
  it('zeigt ein Ringpaar, zwei Zeilen und drei Fragevorschläge; EBIT und Cash getrennt', async () => {
    renderAt('/uebersicht');
    expect(await screen.findByText(/Gesichert sind .+ von .+ EBIT\./)).toBeTruthy();
    expect(document.querySelectorAll('[data-slot="goal-rings"]')).toHaveLength(1);
    expect(outerRing()).not.toBeNull();
    expect(screen.getByText('9 von 12')).toBeTruthy();
    expect(screen.getByText('Fokuslieferanten mit freigegebenem JBP')).toBeTruthy();
    const rows = screen.getByRole('region', { name: 'Was dahinter steht' });
    expect(within(rows).getAllByRole('link')).toHaveLength(2);
    expect(within(rows).getByText('In Umsetzung')).toBeTruthy();
    expect(within(rows).getByText('Cash')).toBeTruthy();
    const questions = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/fragen?q='));
    expect(questions).toHaveLength(3);
    expectPageLimits();
  });

  it('zeigt die Aussage von Reziproq mit Quellen und drei Sätze; „Stimmt nicht“ meldet sie', async () => {
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
          text: 'Rheintal trägt 120.000 € bei, 20 % des Jahresziels.',
          href: '/lieferanten/x/wirkung/bruecke',
        },
        {
          kind: 'stuck',
          text: 'Bei Kessler wartet ein Potenzial von 210.000 € bis 320.000 € EBIT.',
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
    renderAt('/uebersicht');
    expect(
      await screen.findByRole('heading', { name: 'Gesichert sind 69 % des Jahresziels.' }),
    ).toBeTruthy();
    expect(screen.getByText('Zusammengefasst von Reziproq')).toBeTruthy();
    const cards = screen.getByRole('region', { name: 'Drei Sätze von Reziproq' });
    expect(within(cards).getByText('Was gut läuft')).toBeTruthy();
    expect(within(cards).getByText('Was hakt')).toBeTruthy();
    expect(within(cards).getByRole('link', { name: 'Zu Mein Tag' }).getAttribute('href')).toBe(
      '/mein-tag',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Stimmt nicht' }));
    await waitFor(() =>
      expect(reports).toEqual(['/api/aussagen/0190a0a0-0000-7000-8000-0000000000ff/stimmt-nicht']),
    );
    expect(await screen.findByText('Danke, gemeldet.')).toBeTruthy();
  });

  it('ohne Jahresziel erscheint kein äußerer Ring; Admin oder Lead legt es fest', async () => {
    overview = { ...overview, goalEbitCents: null };
    renderAt('/uebersicht');
    expect(await screen.findByText('Noch kein Jahresziel.')).toBeTruthy();
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
    renderAt('/uebersicht');
    expect(await screen.findByText('Noch kein Jahresziel.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ziel festlegen' })).toBeNull();
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
    expect(
      await screen.findByRole('heading', { name: 'Preisgleitklausel nach Index' }),
    ).toBeTruthy();
    expect(screen.getByText('Größte Chance')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Wertpotenzial ansehen' }).getAttribute('href')).toBe(
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
    expect(screen.getByText('Größtes Risiko')).toBeTruthy();
    expect(screen.getByText('hoch')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Zum Hinweis' }).getAttribute('href')).toBe(
      '/hinweise?hinweis=0190a0a0-0000-7000-8000-0000000000bb',
    );
  });
});
