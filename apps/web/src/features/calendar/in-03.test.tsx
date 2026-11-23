// @vitest-environment jsdom
import type { InboundItemView, Inbox, Integrations } from '@reziproq/shared';
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
import type { OutlookAdapter } from './outlook-adapter';

// Tests zu docs/specs/IN-03.md in der Oberfläche: Neu eingegangen mit Vorschlag und Grund,
// Zuordnen, Bei beiden, Als Ereignis, Ignorieren; Kachel in Mein Tag; Eingangsadresse mit
// zugelassenen Absendern; Outlook-Add-in speichert mit Typ und Schaltern.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
const outlook = vi.hoisted(() => ({ adapter: null as unknown }));
vi.mock('./outlook-adapter', () => ({ outlookAdapter: async () => outlook.adapter }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const uuid = (n: number) => `0190a0a0-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
const item = (n: number, overrides: Partial<InboundItemView>): InboundItemView => ({
  id: uuid(n),
  source: 'inbound_mail',
  receivedAt: '2026-11-23T08:00:00Z',
  subject: 'Termin',
  startsAt: '2026-12-09T13:00:00Z',
  organizer: 'Ida Roth',
  attendees: 3,
  suggestionKind: 'supplier',
  suggestions: [{ relationshipId: uuid(50), name: 'Rheintal Elektronik' }],
  suggestionReason: 'Rheintal Elektronik: Teilnehmer von rheintal-elektronik.de.',
  suggestedType: 'other',
  status: 'needs_review',
  objectType: null,
  assigned: [],
  ...overrides,
});
const inbox = (): Inbox => ({
  open: [
    item(1, { subject: 'Abstimmung Musterteile Starrflex', suggestedType: 'site_visit' }),
    item(2, {
      subject: 'Call Guss Q1',
      source: 'calendar_sync',
      suggestionKind: 'several',
      suggestionReason: 'Teilnehmer von beiden Lieferanten.',
      suggestions: [
        { relationshipId: uuid(51), name: 'Silesia Guss' },
        { relationshipId: uuid(52), name: 'Lombardia Fonderie' },
      ],
    }),
    item(3, {
      subject: 'Lieferantentag 2027',
      suggestionKind: 'event',
      suggestions: [],
      suggestionReason: 'Teilnehmer von mehr als 5 Lieferanten.',
    }),
  ],
  today: [
    item(4, {
      suggestionReason: null,
      subject: 'QBR Nordwerk Guss',
      status: 'auto_assigned',
      objectType: 'meeting',
      suggestedType: 'quarterly_review',
      assigned: [{ relationshipId: uuid(53), name: 'Nordwerk Guss', meetingId: uuid(60) }],
    }),
  ],
  suppliers: [
    { relationshipId: uuid(50), name: 'Rheintal Elektronik' },
    { relationshipId: uuid(51), name: 'Silesia Guss' },
    { relationshipId: uuid(52), name: 'Lombardia Fonderie' },
  ],
  active: true,
});

let sent: { url: string; method: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'admin' };
  api.permissions = [...actionsFor.admin, 'termine.sehen', 'termine.bearbeiten'];
  sent = [];
  api.handle = (request) => {
    if (request.url.startsWith('/api/mein-tag/eingang')) {
      if (request.method !== 'GET') sent.push(request);
      return Response.json(inbox());
    }
    if (request.url === '/api/start') {
      return Response.json({
        due: { items: [], total: 0 },
        relationships: { items: [], total: 0 },
        nextMeeting: null,
        portfolio: null,
        openActions: 0,
      });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('IN-03 Neu eingegangen', () => {
  it('zeigt die Zahl, Vorschlag mit Grund und was heute selbst zugeordnet wurde', async () => {
    renderAt('/mein-tag/eingang');
    expect(await screen.findByText('3 Termine warten auf eine Zuordnung')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Zuordnen · 3' })).toBeTruthy();
    expect(screen.getByText(/Teilnehmer von rheintal-elektronik\.de/)).toBeTruthy();
    expect(screen.getByText('Silesia Guss oder Lombardia Fonderie')).toBeTruthy();
    expect(screen.getByText('Kein einzelner Lieferant')).toBeTruthy();
    const today = screen
      .getByRole('heading', { level: 2, name: 'Heute selbst zugeordnet · 1' })
      .closest('section') as HTMLElement;
    expect(within(today).getByText('QBR Nordwerk Guss')).toBeTruthy();
    expect(within(today).getByText(/Quartalsreview · Einladung an die Eingangsadresse/)).toBeTruthy();
  });

  it('Speichern ordnet mit Typ zu; Bei beiden legt beide an; Ereignis und Ignorieren', async () => {
    renderAt('/mein-tag/eingang');
    const first = (await screen.findByText('Abstimmung Musterteile Starrflex')).closest('li') as HTMLElement;
    expect(((await within(first).findByLabelText('Termintyp')) as HTMLSelectElement).value).toBe(
      'site_visit',
    );
    fireEvent.click(within(first).getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        url: `/api/mein-tag/eingang/${uuid(1)}/entscheiden`,
        body: { action: 'assign', relationshipIds: [uuid(50)], type: 'site_visit' },
      }),
    );
    const second = screen.getByText('Call Guss Q1').closest('li') as HTMLElement;
    fireEvent.click(within(second).getByRole('button', { name: 'Bei beiden' }));
    await waitFor(() =>
      expect(sent[1]).toMatchObject({ body: { action: 'assign', relationshipIds: [uuid(51), uuid(52)] } }),
    );
    const third = screen.getByText('Lieferantentag 2027').closest('li') as HTMLElement;
    fireEvent.click(within(third).getByRole('button', { name: 'Als Ereignis speichern' }));
    await waitFor(() => expect(sent[2]).toMatchObject({ body: { action: 'event' } }));
    fireEvent.click(within(third).getByRole('button', { name: 'Ignorieren' }));
    await waitFor(() => expect(sent[3]).toMatchObject({ body: { action: 'ignore' } }));
  });

  it('Mein Tag zeigt rechts „Neu eingegangen“ mit der Zahl', async () => {
    renderAt('/start');
    const tile = (await screen.findByRole('heading', { name: 'Neu eingegangen' })).closest(
      '[data-slot="list-card"], section',
    ) as HTMLElement;
    expect(within(tile).getByText('3 Termine warten auf dich')).toBeTruthy();
    expect(within(tile).getByRole('link', { name: 'Zuordnen' }).getAttribute('href')).toBe(
      '/mein-tag/eingang',
    );
  });
});

describe('IN-03 Eingangsadresse', () => {
  it('zeigt die Adresse und speichert die zugelassenen Absender-Domains', async () => {
    const overview: Integrations = {
      connectors: [
        {
          key: 'inbound_mail',
          group: 'workplace',
          stage: 1,
          parts: ['meetings', 'notes'],
          personal: false,
          provider: 'fake',
          connection: {
            id: uuid(70),
            scope: 'org',
            status: 'active',
            parts: ['meetings', 'notes'],
            connectedByName: 'Anna',
            connectedAt: '2026-11-18T08:00:00Z',
            hookPath: '/api/anbindungen/eingang/abc',
            inboundAddress: 'termine@nordwind.reziproq.de',
            allowedDomains: ['nordwind-antriebe.de'],
            lastJob: null,
          },
        },
      ],
      events: [],
      issue: null,
    };
    api.handle = (request) => {
      if (request.url.startsWith('/api/einstellungen/anbindungen')) {
        if (request.method !== 'GET') sent.push(request);
        return Response.json(overview);
      }
      return undefined;
    };
    renderAt('/einstellungen/anbindungen');
    const row = (await screen.findByText('Eingangsadresse')).closest('li') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Verwalten' }));
    expect(await within(row).findByText('termine@nordwind.reziproq.de')).toBeTruthy();
    fireEvent.change(within(row).getByLabelText('Zugelassene Absender-Domains'), {
      target: { value: 'nordwind-antriebe.de\nNordwind-Service.at' },
    });
    fireEvent.click(within(row).getByRole('button', { name: 'Absender speichern' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        url: `/api/einstellungen/anbindungen/${uuid(70)}/einstellungen`,
        body: { allowedDomains: ['nordwind-antriebe.de', 'nordwind-service.at'] },
      }),
    );
  });
});

describe('IN-03 Outlook-Add-in', () => {
  it('erkennt den Lieferanten und speichert mit Typ und Schaltern; setzt die Eingangsadresse', async () => {
    const adapter: OutlookAdapter = {
      preview: false,
      read: async () => ({
        organizerEmail: 'anna@nordwind.de',
        subject: 'JBP Rheintal Planung 2027',
        startAt: '2026-12-09T13:00:00.000Z',
        attendees: ['tom@rheintal-elektronik.de'],
      }),
      addAttendeeAndSave: vi.fn(async () => 'evt-1'),
      prependBody: vi.fn(async () => undefined),
    };
    api.handle = (request) => {
      if (request.url === '/api/termine/addin/erkennen') {
        return Response.json({
          supplier: { relationshipId: uuid(50), name: 'Rheintal Elektronik' },
          candidates: [{ relationshipId: uuid(50), name: 'Rheintal Elektronik' }],
          reason: 'Rheintal Elektronik: Teilnehmer von rheintal-elektronik.de.',
          suggestedType: 'jbp',
        });
      }
      if (request.url === '/api/termine/addin') {
        sent.push(request);
        return Response.json(
          {
            registrationId: uuid(80),
            inboundAddress: 'termine@nordwind.reziproq.de',
            transcriptNotice: 'Hinweis: Transkript',
          },
          { status: 201 },
        );
      }
      return undefined;
    };
    outlook.adapter = adapter;
    renderAt('/addin/outlook');
    expect(await screen.findByText('Erkannter Lieferant')).toBeTruthy();
    expect((screen.getByLabelText('Termintyp') as HTMLSelectElement).value).toBe('jbp');
    fireEvent.click(screen.getByRole('switch', { name: 'Transkript übernehmen' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Agenda einfügen, sobald das Briefing steht' }));
    fireEvent.click(screen.getByRole('button', { name: 'Als Aktivität speichern' }));
    await waitFor(() =>
      expect(sent[0]?.body).toMatchObject({
        relationshipId: uuid(50),
        type: 'jbp',
        briefOptIn: true,
        transcriptOptIn: true,
        insertAgenda: true,
        organizerEmail: 'anna@nordwind.de',
      }),
    );
    await waitFor(() =>
      expect(adapter.addAttendeeAndSave).toHaveBeenCalledWith('termine@nordwind.reziproq.de'),
    );
    expect(adapter.prependBody).toHaveBeenCalledWith('Hinweis: Transkript');
    expect(await screen.findByText(/Gespeichert\. Sende jetzt die Einladung/)).toBeTruthy();
  });
});
