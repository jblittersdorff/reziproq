// @vitest-environment jsdom

import type { ValueOpportunities } from '@reziproq/shared';
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

// Tests zu docs/specs/KI-11.md in der Oberfläche: Entwurfskarte mit Wert für beide Seiten,
// Sicherheit, Rechenweg; Summen ohne low; ohne Recherche sagt die Seite das; Übernehmen zeigt erst,
// was der Lieferant sieht; Verwerfen braucht einen Grund.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const id = '0190a0a0-0000-7000-8000-000000000001';
const oppId = '0190a0a0-0000-7000-8000-0000000000aa';
const base = `/api/suppliers/${id}/wertpotenziale`;
let data: ValueOpportunities;
let sent: { url: string; body: unknown }[];

const opportunity: ValueOpportunities['opportunities'][number] = {
  id: oppId,
  templateKey: 'index_clause',
  title: 'Preisgleitklausel nach Index',
  reason: 'Der Kupferindex liegt unter dem Stand bei Preisfestlegung.',
  impactType: 'ebit',
  buyer: { low: 10_800_000, high: 18_000_000 },
  supplier: null,
  supplierEffect: 'Absicherung gegen Anstieg des Index',
  currency: 'EUR',
  confidence: 'medium',
  confidenceReason: 'template_assumption',
  fromMarket: true,
  steps: [
    {
      key: 'current_index',
      unit: 'index',
      low: '88',
      high: '88',
      source: 'public_source',
      citations: [
        {
          url: 'https://index-one.example.test/kupfer',
          publisher: 'Index One',
          publishedOn: '2026-10-22',
        },
      ],
      editable: true,
    },
    {
      key: 'material_share',
      unit: 'rate',
      low: '0.3',
      high: '0.5',
      source: 'template_assumption',
      citations: [],
      editable: true,
    },
  ],
  status: 'new',
  createdAt: '2026-11-22T10:00:00Z',
};

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sent = [];
  api.me = { ...anna, orgRole: 'admin' };
  api.permissions = actionsFor.admin;
  data = {
    researchEnabled: true,
    canRun: true,
    canDecide: true,
    lastRun: {
      id: '0190a0a0-0000-7000-8000-0000000000bb',
      status: 'done',
      finishedAt: '2026-11-22T10:00:00Z',
    },
    counts: { new: 2, adopted: 0, realized: 0 },
    totals: [
      {
        impactType: 'ebit',
        new: { low: 10_800_000, high: 18_000_000 },
        adopted: { low: 0, high: 0 },
        realized: { low: 0, high: 0 },
      },
      {
        impactType: 'cash',
        new: { low: 2_000_000, high: 2_000_000 },
        adopted: { low: 0, high: 0 },
        realized: { low: 0, high: 0 },
      },
    ],
    opportunities: [opportunity],
    checked: {
      templates: 9,
      checkable: 1,
      withOpportunity: 1,
      withoutOpportunity: [],
      notCheckable: 8,
      signals: 1,
    },
    signals: [
      {
        id: '0190a0a0-0000-7000-8000-0000000000cc',
        kind: 'raw_material',
        title: 'Kupferindex gesunken',
        summary: 'Der Kupferindex liegt unter dem Stand bei Preisfestlegung.',
        direction: 'relief',
        sources: [
          {
            title: 'Kupferindex Monatsstand',
            url: 'https://index-one.example.test/kupfer',
            publishedOn: '2026-10-22',
            excerpt: 'Index 88',
          },
        ],
        outcome: 'opportunity',
        outcomeReason: 'Fließt in ein Potenzial nach Vorlage.',
      },
    ],
    dataGaps: [
      {
        id: '0190a0a0-0000-7000-8000-0000000000dd',
        dataKey: 'capacity_shortfall_risk',
        description: 'Wahrscheinlichkeit und Dauer eines Lieferausfalls',
        templatesBlocked: ['capacity_shortage'],
        status: 'open',
      },
    ],
    outbound: [{ text: 'Leiterplatten Rohstoffpreise Index', sentAt: '2026-11-22T10:00:00Z' }],
  };
  api.handle = (request) => {
    if (request.url === base && request.method === 'GET') return Response.json(data);
    if (request.url === `${base}/${oppId}/vorschlag`) {
      return Response.json({
        title: 'Preisgleitklausel nach Index',
        description: 'Wir möchten den Materialanteil im Preis an einen öffentlichen Index koppeln.',
      });
    }
    if (request.url.startsWith(`${base}/${oppId}/`)) {
      sent.push({ url: request.url, body: request.body });
      return Response.json({ ...data, opportunities: [{ ...opportunity, status: 'adopted' }] });
    }
    if (request.url === `/api/suppliers/${id}`) {
      return Response.json({
        relationshipId: id,
        name: 'Rheintal',
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
});

afterEach(tearDownApp);

const page = `/lieferanten/${id}/wirkung/wertpotenziale`;

describe('KI-11 Wertpotenziale', () => {
  it('zeigt Wert für beide Seiten, Sicherheit mit Grund, Rechenweg und Quellen', async () => {
    renderAt(page);
    const card = (
      await screen.findByRole('heading', { name: 'Preisgleitklausel nach Index' })
    ).closest('[data-slot="ai-draft"]') as HTMLElement;
    expect(within(card).getByText(/Entwurf von Reziproq · aus dem Marktumfeld/)).toBeTruthy();
    expect(within(card).getByText('Für Rheintal')).toBeTruthy();
    expect(within(card).getByText('Absicherung gegen Anstieg des Index')).toBeTruthy();
    expect(within(card).getByText('Sicherheit mittel')).toBeTruthy();
    expect(
      within(card).getByText('Mindestens eine Eingabe ist eine Annahme der Vorlage.'),
    ).toBeTruthy();
    expect(
      within(card).getByText('Rechenweg · Vorlage „Preisgleitklausel nach Index“, Version 1'),
    ).toBeTruthy();
    expect(within(card).getAllByText('Annahme der Vorlage').length).toBeGreaterThan(0);
    expect(within(card).getByRole('link', { name: /Index One/ })).toBeTruthy();
  });

  it('die Summen stehen je Wirkungsart getrennt', async () => {
    renderAt(page);
    const totals = await screen.findByRole('region', { name: 'Wertpotenziale' });
    expect(within(totals).getAllByText(/EBIT$/).length).toBeGreaterThan(0);
    expect(within(totals).getAllByText(/Cash$/).length).toBeGreaterThan(0);
    expect(
      within(totals).getByText(
        'Wirkungsarten werden nie addiert. Summen nur mit Sicherheit hoch und mittel.',
      ),
    ).toBeTruthy();
    expectPageLimits();
  });

  it('ohne öffentliche Recherche sagt die Seite das', async () => {
    data = { ...data, researchEnabled: false, signals: [], outbound: [] };
    renderAt(page);
    expect(
      (
        await screen.findAllByText(
          /Öffentliche Recherche ist aus\. Das Marktumfeld wurde nicht geprüft/,
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Nach außen ging nichts.')).toBeTruthy();
  });

  it('Übernehmen zeigt erst, was der Lieferant sieht, und legt das Thema erst nach Bestätigung an', async () => {
    renderAt(page);
    fireEvent.click(await screen.findByRole('button', { name: 'Als Thema ins JBP übernehmen' }));
    const form = await screen.findByRole('form', { name: 'So sieht der Lieferant das Thema' });
    expect(sent).toHaveLength(0);
    const description = within(form).getByRole('textbox', {
      name: 'Beschreibung',
    }) as HTMLTextAreaElement;
    expect(description.value).not.toMatch(/\d/);
    fireEvent.click(within(form).getByRole('button', { name: 'Thema anlegen' }));
    await waitFor(() => expect(sent[0]?.url).toBe(`${base}/${oppId}/uebernehmen`));
    expect(sent[0]?.body).toEqual({
      title: 'Preisgleitklausel nach Index',
      description: 'Wir möchten den Materialanteil im Preis an einen öffentlichen Index koppeln.',
    });
  });

  it('Verwerfen braucht einen Grund; ohne Recht keine Knöpfe', async () => {
    renderAt(page);
    fireEvent.click(await screen.findByRole('button', { name: 'Verwerfen' }));
    const confirm = screen.getByRole('button', {
      name: 'Verwerfen bestätigen',
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Grund' }), {
      target: { value: 'Laufender Rahmenvertrag' },
    });
    fireEvent.click(confirm);
    await waitFor(() => expect(sent[0]?.body).toEqual({ reason: 'Laufender Rahmenvertrag' }));
  });

  it('die Anfrage zur Datenlücke ist ein Entwurf und wird erst mit „Anfrage senden“ gesendet', async () => {
    const gapId = '0190a0a0-0000-7000-8000-0000000000dd';
    const handle = api.handle;
    const drafted = {
      ...data,
      dataGaps: data.dataGaps.map((gap) => ({
        ...gap,
        draft: {
          id: '0190a0a0-0000-7000-8000-0000000000ee',
          title: 'Daten bereitstellen: Wahrscheinlichkeit und Dauer eines Lieferausfalls',
          description: 'Liebes Team von Rheintal, bitte um diese Angabe.',
        },
      })),
    };
    api.handle = (request) => {
      if (request.url.startsWith(`${base}/luecken/${gapId}/anfrage`)) {
        sent.push({ url: request.url, body: request.body });
        return Response.json(drafted);
      }
      return handle?.(request);
    };
    renderAt(page);
    fireEvent.click(await screen.findByRole('button', { name: 'Anfrage an Rheintal entwerfen' }));
    const form = await screen.findByRole('form', { name: 'Anfrage an den Lieferanten' });
    expect(sent.map((entry) => entry.url)).toEqual([`${base}/luecken/${gapId}/anfrage`]);
    fireEvent.click(within(form).getByRole('button', { name: 'Anfrage senden' }));
    await waitFor(() => expect(sent[1]?.url).toBe(`${base}/luecken/${gapId}/anfrage/senden`));
    expect(sent[1]?.body).toMatchObject({
      title: 'Daten bereitstellen: Wahrscheinlichkeit und Dauer eines Lieferausfalls',
    });
  });

  it('wer nicht entscheiden darf, sieht keine Knöpfe', async () => {
    data = { ...data, canRun: false, canDecide: false };
    renderAt(page);
    await screen.findByRole('heading', { name: 'Preisgleitklausel nach Index' });
    expect(screen.queryByRole('button', { name: 'Als Thema ins JBP übernehmen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Erneut prüfen' })).toBeNull();
  });
});

describe('KI-11 Wertpotenziale über alle Lieferanten', () => {
  it('zeigt Summen getrennt, das größte Potenzial und eine Zeile je Lieferant', async () => {
    const handle = api.handle;
    api.handle = (request) => {
      if (request.url === '/api/uebersicht/wertpotenziale') {
        return Response.json({
          counts: { new: 3, adopted: 1, realized: 0, lowExcluded: 1 },
          totals: [
            {
              impactType: 'ebit',
              new: { low: 18_000_000, high: 30_000_000 },
              adopted: { low: 0, high: 0 },
              realized: { low: 0, high: 0 },
            },
            {
              impactType: 'cash',
              new: { low: 2_000_000, high: 2_000_000 },
              adopted: { low: 0, high: 0 },
              realized: { low: 0, high: 0 },
            },
          ],
          biggest: {
            relationshipId: id,
            supplierName: 'Rheintal',
            templateKey: 'index_clause',
            impactType: 'ebit',
            buyer: { low: 18_000_000, high: 30_000_000 },
            confidence: 'medium',
          },
          suppliers: [
            {
              relationshipId: id,
              name: 'Rheintal',
              newCount: 1,
              adoptedCount: 1,
              ebitNew: { low: 18_000_000, high: 30_000_000 },
              cashNew: null,
              confidence: 'medium',
              nextStep: 'review',
            },
          ],
          levers: [{ templateKey: 'index_clause', count: 1 }],
          signals: [{ title: 'Kupferindex gesunken', suppliers: 2 }],
          dataGaps: [
            {
              dataKey: 'capacity_shortfall_risk',
              description: 'Wahrscheinlichkeit und Dauer eines Lieferausfalls',
              suppliers: 2,
            },
          ],
        });
      }
      return handle?.(request);
    };
    renderAt('/uebersicht/wertpotenziale');
    expect(
      await screen.findByRole('heading', { name: 'Rheintal: Preisgleitklausel nach Index' }),
    ).toBeTruthy();
    expect(screen.getByText(/1 mit Sicherheit niedrig nicht eingerechnet/)).toBeTruthy();
    expectPageLimits();
    const link = screen.getByRole('link', { name: 'Rheintal' });
    expect(link.getAttribute('href')).toBe(`/lieferanten/${id}/wirkung/wertpotenziale`);
    expect(screen.getByText('Kupferindex gesunken')).toBeTruthy();
    expect(screen.getAllByText('2 Lieferanten').length).toBe(2);
  });
});
