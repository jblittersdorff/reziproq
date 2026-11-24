// @vitest-environment jsdom
import type { Initiative, InitiativeDetail, Initiatives, JbpTopics } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/JBP-03.md in der Oberfläche: Nutzen beider Seiten Pflicht, Roadmap mit
// Zeiträumen und Meilensteinen, nach der Freigabe nur Status und Meilensteine, Verlauf, und
// Zusammenführen von Themen beider Seiten zu einer neuen Initiative.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const uuid = (n: number) => `0190a0a0-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
const rel = uuid(1);
const supplier = {
  relationshipId: rel,
  name: 'Rheintal Elektronik GmbH (Demo)',
  organizationName: 'Rheintal Elektronik GmbH (Demo)',
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
};
const initiative = (n: number, extra: Partial<Initiative> = {}): Initiative => ({
  id: uuid(n),
  title: `Initiative ${n}`,
  goal: 'Lieferfähigkeit sichern',
  benefitBuyer: 'Weniger Ausfälle',
  benefitSupplier: 'Mehr Volumen',
  ownerBuyerName: 'Sara Ost',
  ownerSupplierName: 'Kim Kaiser',
  ownerBuyerUserId: 'sara',
  ownerSupplierUserId: null,
  startsOn: '2027-01-01',
  endsOn: '2027-12-31',
  status: 'planned',
  source: 'jbp',
  milestones: [],
  topics: [],
  ...extra,
});
const one = initiative(20, {
  milestones: [{ id: uuid(40), title: 'Muster frei', dueOn: '2027-07-02', doneOn: null }],
  topics: [{ id: uuid(50), title: 'Ausfälle senken', side: 'buyer' }],
});
const people = [
  { userId: 'mia', name: 'Mia Mitglied' },
  { userId: 'sara', name: 'Sara Ost' },
];
const list = (extra: Partial<Initiatives> = {}): Initiatives => ({
  hasPlan: true,
  approved: false,
  canEdit: true,
  ownSide: 'buyer',
  people,
  initiatives: [one],
  ...extra,
});
const topics: JbpTopics = {
  hasPlan: true,
  ownSide: 'buyer',
  buyer: [
    {
      id: uuid(50),
      side: 'buyer',
      own: true,
      title: 'Ausfälle senken',
      description: 'Weniger Bandstillstände',
      priority: 1,
      status: 'proposed',
      parkReason: null,
      origin: null,
    },
  ],
  supplier: [
    {
      id: uuid(51),
      side: 'supplier',
      own: false,
      title: 'Neues Werk',
      description: '',
      priority: 1,
      status: 'proposed',
      parkReason: null,
      origin: null,
    },
  ],
  canEditOwn: true,
  canImport: true,
};
let current: Initiatives;
let detail: InitiativeDetail;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 9, 10, 0));
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  current = list();
  detail = {
    initiative: one,
    approved: false,
    canEdit: true,
    ownSide: 'buyer',
    people,
    maturity: { level: 1, steps: [] },
    impact: null,
  };
  api.handle = (request) => {
    if (request.url === `/api/suppliers/${rel}`) return Response.json(supplier);
    if (request.url.startsWith(`/api/suppliers/${rel}/overview`)) {
      return Response.json({
        head: { segment: null, sro: null, nextMeeting: null },
        metrics: [],
        cycle: null,
        canStartCycle: false,
        canSetJbpDate: false,
      });
    }
    if (request.url.startsWith('/api/audit')) return Response.json({ entries: [] });
    if (request.url === `/api/suppliers/${rel}/jbp/themen`) return Response.json(topics);
    if (request.url.startsWith(`/api/suppliers/${rel}/jbp/initiativen`)) {
      if (request.method !== 'GET') {
        sent.push(request);
        return Response.json(detail, { status: request.method === 'POST' ? 201 : 200 });
      }
      if (request.url === `/api/suppliers/${rel}/jbp/initiativen`) return Response.json(current);
      return Response.json(detail);
    }
    return undefined;
  };
});

afterEach(() => {
  tearDownApp();
  vi.useRealTimers();
});

const base = `/lieferanten/${rel}/plan/initiativen`;

describe('JBP-03 Initiativen in der Oberfläche', () => {
  it('die Liste nennt Titel, Verantwortliche beider Seiten, Zeitraum und Status', async () => {
    renderAt(base);
    const link = await screen.findByRole('link', { name: 'Initiative 20' });
    expect(link.getAttribute('href')).toBe(`${base}/${uuid(20)}`);
    const row = link.closest('tr') as HTMLElement;
    expect(within(row).getByText('Sara Ost')).toBeDefined();
    expect(within(row).getByText('Kim Kaiser')).toBeDefined();
    expect(within(row).getByText('Geplant')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Neue Initiative' })).toBeDefined();
  });

  it('die Roadmap zeigt Zeiträume und Meilensteine; ein Klick öffnet die Initiative', async () => {
    const router = renderAt(`${base}?ansicht=roadmap`);
    const roadmap = await screen.findByRole('region', { name: 'Roadmap der Initiativen' });
    // Drei Jahre ab dem laufenden: 2026 bis 2028; 2027 ist das mittlere Drittel.
    expect([...roadmap.querySelectorAll('[data-year]')].map((year) => year.textContent)).toEqual([
      '2026',
      '2027',
      '2028',
    ]);
    const bar = roadmap.querySelector('[data-slot="bar"]') as HTMLElement;
    expect(Number.parseFloat(bar.style.left)).toBeCloseTo(33.3, 0);
    expect(Number.parseFloat(bar.style.width)).toBeCloseTo(33.3, 0);
    const milestone = roadmap.querySelector('[data-slot="milestone"]') as HTMLElement;
    expect(Number.parseFloat(milestone.style.left)).toBeCloseTo(50, 0);
    expect(milestone.getAttribute('title')).toContain('Muster frei');
    fireEvent.click(within(roadmap).getByRole('link', { name: /^Initiative 20,/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${base}/${uuid(20)}`));
  });

  it('die Roadmap bleibt mit 15 Initiativen über drei Jahre lesbar', async () => {
    current = list({
      initiatives: Array.from({ length: 15 }, (_, index) =>
        initiative(60 + index, {
          startsOn: `${2026 + (index % 3)}-0${1 + (index % 6)}-01`,
          endsOn: `${2026 + (index % 3)}-12-31`,
        }),
      ),
    });
    renderAt(`${base}?ansicht=roadmap`);
    const roadmap = await screen.findByRole('region', { name: 'Roadmap der Initiativen' });
    const bars = [...roadmap.querySelectorAll<HTMLElement>('[data-slot="bar"]')];
    expect(bars).toHaveLength(15);
    for (const bar of bars) {
      const left = Number.parseFloat(bar.style.left);
      const width = Number.parseFloat(bar.style.width);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + width).toBeLessThanOrEqual(100.01);
      expect(width).toBeGreaterThan(1);
    }
    // Jede Zeile ist ein eigener Link mit Namen, Zeitraum und Status.
    expect(within(roadmap).getAllByRole('link')).toHaveLength(15);
  });

  it('ohne Nutzen für beide Seiten wird nichts gespeichert', async () => {
    renderAt(`${base}/neu`);
    fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'Neu' } });
    fireEvent.change(screen.getByLabelText('Ziel'), { target: { value: 'Ziel' } });
    fireEvent.change(screen.getByLabelText('Verantwortlich bei euch'), {
      target: { value: 'sara' },
    });
    fireEvent.change(screen.getByLabelText('Verantwortlich beim Lieferanten'), {
      target: { value: 'Kim Kaiser' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Initiative anlegen' }));
    expect(await screen.findAllByText('Bitte ausfüllen.')).toHaveLength(2);
    expect(sent).toEqual([]);
    fireEvent.change(screen.getByLabelText(/^Nutzen für den Käufer/), {
      target: { value: 'Weniger Ausfälle' },
    });
    fireEvent.change(screen.getByLabelText(/^Nutzen für den Lieferanten/), {
      target: { value: 'Mehr Volumen' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Initiative anlegen' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    // Die eigene Seite wählt eine Person; ihr Name geht mit, die andere Seite nur als Name.
    expect(sent[0]).toMatchObject({
      method: 'POST',
      body: {
        benefitBuyer: 'Weniger Ausfälle',
        benefitSupplier: 'Mehr Volumen',
        ownerUserId: 'sara',
        ownerBuyerName: 'Sara Ost',
        ownerSupplierName: 'Kim Kaiser',
      },
    });
  });

  it('nach der Freigabe gibt es kein Anlegen und Bearbeiten mehr, Status und Meilensteine schon', async () => {
    current = list({ approved: true });
    detail = {
      initiative: one,
      approved: true,
      canEdit: true,
      ownSide: 'buyer',
      people,
      maturity: { level: 1, steps: [] },
      impact: null,
    };
    renderAt(base);
    expect(await screen.findByText(/Der Plan ist freigegeben/)).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Neue Initiative' })).toBeNull();
  });

  it('die Initiative zeigt Status, Meilensteine, Herkunft und Verlauf; Status lässt sich ändern', async () => {
    detail = {
      initiative: one,
      approved: true,
      canEdit: true,
      ownSide: 'buyer',
      people,
      maturity: { level: 1, steps: [] },
      impact: null,
    };
    renderAt(`${base}/${uuid(20)}`);
    expect(await screen.findByRole('heading', { level: 2, name: 'Verlauf' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Bearbeiten' })).toBeNull();
    expect(screen.getByText('Ausfälle senken')).toBeDefined();
    expect(screen.getByText('Muster frei')).toBeDefined();
    fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), {
      target: { value: 'running' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Status speichern' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      url: `/api/suppliers/${rel}/jbp/initiativen/${uuid(20)}/status`,
      body: { status: 'running' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Muster frei erledigt' }));
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]).toMatchObject({
      method: 'PUT',
      url: `/api/suppliers/${rel}/jbp/initiativen/${uuid(20)}/meilensteine/${uuid(40)}`,
      body: { doneOn: '2026-11-09' },
    });
  });

  it('Zusammenführen wählt Themen beider Seiten und füllt die neue Initiative vor', async () => {
    const router = renderAt(`/lieferanten/${rel}/plan/themen/zusammenfuehren`);
    fireEvent.click(await screen.findByRole('button', { name: 'Weiter zur Initiative' }));
    expect(await screen.findByText('Bitte mindestens ein Thema wählen.')).toBeDefined();
    fireEvent.click(screen.getByRole('checkbox', { name: /Ausfälle senken/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Neues Werk/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter zur Initiative' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${base}/neu`));
    expect(router.state.location.search).toEqual({ themen: `${uuid(50)},${uuid(51)}` });
    expect(((await screen.findByLabelText('Titel')) as HTMLInputElement).value).toBe(
      'Ausfälle senken',
    );
    expect((screen.getByLabelText('Ziel') as HTMLTextAreaElement).value).toBe(
      'Weniger Bandstillstände',
    );
    for (const [label, value] of [
      [/^Nutzen für den Käufer/, 'A'],
      [/^Nutzen für den Lieferanten/, 'B'],
      ['Verantwortlich bei euch', 'mia'],
      ['Verantwortlich beim Lieferanten', 'Kim Kaiser'],
    ] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Initiative anlegen' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body).toMatchObject({ topicIds: [uuid(50), uuid(51)] });
  });
});
