// @vitest-environment jsdom
import type { MeetingDetail, MeetingList, SupplierDetail } from '@reziproq/shared';
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

// Oberflächentests zu docs/specs/QBR-01.md, Teil a: Termine beim Käufer und beim Lieferanten.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const rel = '0190a0a0-0000-7000-8000-000000000001';
const mid = '0190a0a0-0000-7000-8000-000000000099';
const uuid = (n: number) => `0190a0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const detail: SupplierDetail = {
  relationshipId: rel,
  name: 'Rheintal Elektronik GmbH (Demo)',
  organizationName: 'Rheintal Elektronik GmbH (Demo)',
  country: 'DE',
  vatId: null,
  duns: null,
  externalRef: 'L-10001',
  notes: null,
  status: 'active',
  createdAt: '2026-10-01T08:00:00Z',
  endedAt: null,
  spend: [],
  permissions: { edit: true, editTeam: true },
};
const summary = {
  id: mid,
  type: 'quarterly_review' as const,
  title: 'Quartalsreview Q1',
  startsAt: '2099-03-15T09:00:00.000Z',
  location: 'Werk Nord',
  status: 'planned' as const,
  ownerSide: 'buyer' as const,
};
const meeting = (own: boolean): MeetingDetail => ({
  meeting: { ...summary, protocol: 'Liefertreue bei 97 %.', createdByName: 'Sara Ost' },
  participants: [{ id: uuid(1), side: 'buyer', own, name: 'Sara Ost' }],
  agenda: [
    { id: uuid(2), side: 'buyer', own, title: 'Rückblick auf das Quartal', position: 1 },
    { id: uuid(3), side: 'supplier', own: !own, title: 'Neue Kapazitäten', position: 1 },
  ],
  decisions: [
    { id: uuid(4), side: 'buyer', own, text: 'Kapazität bis April abstimmen', position: 1 },
  ],
  note: own ? 'Preisdruck ansprechen' : 'Kapazität ist knapp',
  canEditMeeting: own,
  canContribute: true,
  live: { sections: [], frozenAt: null },
  canClose: own,
});

let list: MeetingList;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  list = {
    upcoming: [summary],
    past: [],
    canCreate: true,
    formats: [{ id: uuid(20), title: { de: 'Innovationstag', en: 'Innovation day' } }],
  };
  api.handle = (request) => {
    if (request.url === `/api/suppliers/${rel}`) return Response.json(detail);
    if (request.url.startsWith(`/api/suppliers/${rel}/overview`)) {
      return Response.json({ head: { segment: null, sro: null, nextMeeting: null }, metrics: [] });
    }
    if (request.url === `/api/suppliers/${rel}/termine`) {
      if (request.method === 'POST') {
        sent.push(request);
        return Response.json(meeting(true), { status: 201 });
      }
      return Response.json(list);
    }
    if (request.url.startsWith(`/api/suppliers/${rel}/termine/${mid}`)) {
      if (request.method !== 'GET') sent.push(request);
      return Response.json(meeting(true));
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const buyerBase = `/lieferanten/${rel}/umsetzung/termine`;

describe('QBR-01a beim Käufer', () => {
  it('die Liste zeigt kommende Termine mit Art und Seite', async () => {
    renderAt(buyerBase);
    const upcoming = await screen.findByRole('region', { name: 'Kommende Termine' });
    expect(within(upcoming).getByText('Quartalsreview Q1')).toBeDefined();
    // Eigene Termine tragen kein Kennzeichen, nur die der anderen Seite.
    expect(within(upcoming).queryByText('Wir')).toBeNull();
    expect(screen.getByText('Noch kein vergangener Termin.')).toBeDefined();
  });

  it('ein neuer Termin nimmt Art, Datum, Ort und Teilnehmende; Formate aus den Spielregeln stehen zur Wahl', async () => {
    const router = renderAt(`${buyerBase}/neu`);
    const type = (await screen.findByLabelText('Art')) as HTMLSelectElement;
    expect([...type.options].map((option) => option.textContent)).toContain('Innovationstag');
    fireEvent.change(type, { target: { value: uuid(20) } });
    expect((screen.getByLabelText('Titel') as HTMLInputElement).value).toBe('Innovationstag');
    fireEvent.change(screen.getByLabelText('Datum und Uhrzeit'), {
      target: { value: '2099-05-01T10:00' },
    });
    fireEvent.change(screen.getByLabelText('Teilnehmende'), {
      target: { value: 'Sara Ost\n\nTom Krüger' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Termin anlegen' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${buyerBase}/${mid}`));
    expect(sent[0]?.body).toMatchObject({
      type: 'format',
      ruleSetItemId: uuid(20),
      title: 'Innovationstag',
      participants: ['Sara Ost', 'Tom Krüger'],
      locale: 'de',
    });
  });

  it('ohne Datum wird kein Termin angelegt', async () => {
    renderAt(`${buyerBase}/neu`);
    fireEvent.click(await screen.findByRole('button', { name: 'Termin anlegen' }));
    expect(await screen.findByText('Bitte ausfüllen.')).toBeDefined();
    expect(sent).toEqual([]);
  });

  it('die Termin-Seite zeigt Agenda, Protokoll und Beschlüsse und die interne Notiz mit Kennzeichen', async () => {
    renderAt(`${buyerBase}/${mid}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Quartalsreview Q1' }),
    ).toBeDefined();
    const agenda = screen.getByRole('region', { name: 'Agenda' });
    expect(within(agenda).getByText('Neue Kapazitäten')).toBeDefined();
    expect(within(agenda).getByText('Lieferant')).toBeDefined();
    expect(screen.getByText('Liefertreue bei 97 %.')).toBeDefined();
    const note = screen.getByRole('region', { name: /Interne Notizen/ });
    expect(within(note).getByText('Intern')).toBeDefined();
    expect(within(note).getByText('Preisdruck ansprechen')).toBeDefined();
  });

  it('die Agenda bearbeitet nur die eigenen Punkte', async () => {
    const router = renderAt(`${buyerBase}/${mid}/agenda`);
    const first = await screen.findByLabelText('Punkt 1');
    expect((first as HTMLInputElement).value).toBe('Rückblick auf das Quartal');
    expect(screen.getByText('Neue Kapazitäten')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Punkt hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Punkt 2'), { target: { value: 'Preise 2027' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${buyerBase}/${mid}`));
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      url: `/api/suppliers/${rel}/termine/${mid}/agenda`,
      body: { items: ['Rückblick auf das Quartal', 'Preise 2027'] },
    });
  });

  it('wer den Termin angelegt hat, schreibt Protokoll und eigene Beschlüsse', async () => {
    renderAt(`${buyerBase}/${mid}/protokoll`);
    fireEvent.change(await screen.findByLabelText('Protokoll'), { target: { value: 'Neu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body).toEqual({
      protocol: 'Neu',
      decisions: ['Kapazität bis April abstimmen'],
    });
  });
});

describe('QBR-01a beim Lieferanten', () => {
  beforeEach(() => {
    api.me = {
      ...anna,
      organization: { id: 'org-lieferant', name: 'Test-Lieferant (Demo)' },
      orgRole: 'admin',
      permissions: {
        viewOrganizationSettings: true,
        viewBuyerAreas: false,
        viewSuppliers: false,
        viewCustomers: true,
        switchCustomer: false,
      },
    };
    api.permissions = [
      'organisation.sehen',
      'start.sehen',
      'kunden.sehen',
      'termine.sehen',
      'termine.bearbeiten',
    ];
    api.handle = (request) => {
      if (request.url === `/api/kunden/${rel}`) {
        return Response.json({
          relationshipId: rel,
          name: 'Test-OEM (Demo)',
          relationshipType: null,
          nextMeeting: null,
        });
      }
      if (request.url === `/api/kunden/${rel}/termine`) return Response.json(list);
      if (request.url.startsWith(`/api/kunden/${rel}/termine/${mid}`)) {
        if (request.method !== 'GET') sent.push(request);
        return Response.json(meeting(false));
      }
      return undefined;
    };
  });

  it('Umsetzung führt zu den Terminen; ein Termin des Kunden ist als solcher erkennbar', async () => {
    const router = renderAt(`/kunden/${rel}/umsetzung`);
    fireEvent.click(await screen.findByRole('link', { name: /Termine/ }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/kunden/${rel}/umsetzung/termine`),
    );
    expect(await screen.findByText('Quartalsreview Q1')).toBeDefined();
    expect(screen.getByText('Kunde')).toBeDefined();
  });

  it('beim Termin des Kunden schreibt der Lieferant kein Protokoll, aber eigene Beschlüsse', async () => {
    renderAt(`/kunden/${rel}/umsetzung/termine/${mid}/protokoll`);
    expect(
      await screen.findByText('Das Protokoll schreibt die Seite, die den Termin angelegt hat.'),
    ).toBeDefined();
    expect(screen.queryByLabelText('Protokoll')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Beschluss hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Beschluss 1'), {
      target: { value: 'Angebot bis 15. April' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body).toEqual({ protocol: null, decisions: ['Angebot bis 15. April'] });
  });

  it('die eigene interne Notiz steht beim Lieferanten, Termin bearbeiten fehlt', async () => {
    renderAt(`/kunden/${rel}/umsetzung/termine/${mid}`);
    expect(await screen.findByText('Kapazität ist knapp')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Termin bearbeiten' })).toBeNull();
  });
});
