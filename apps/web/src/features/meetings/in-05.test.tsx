// @vitest-environment jsdom
import type {
  MeetingDetail,
  MeetingTranscriptState,
  TranscriptSettings,
  TranscriptText,
} from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/IN-05.md in der Oberfläche: Schalter „Transkript übernehmen“, Stand nach dem
// Termin mit Dauer, Sprechern und Löschdatum, Grund mit Upload, Rohtext mit Fundstellen;
// Einstellungen › Anbindungen mit Betriebsvereinbarung vor dem Einschalten.

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
const mid = uuid(10);
const detail: MeetingDetail = {
  meeting: {
    id: mid,
    type: 'jbp',
    title: 'JBP mit Rheintal',
    startsAt: '2020-12-04T09:00:00Z',
    durationMinutes: 60,
    location: 'Teams',
    status: 'planned',
    ownerSide: 'buyer',
    protocol: null,
    createdByName: 'Sara Ost',
  },
  participants: [],
  agenda: [],
  decisions: [],
  note: null,
  canEditMeeting: true,
  canContribute: true,
  live: { sections: [], frozenAt: null },
  canClose: true,
};
const fetched: MeetingTranscriptState = {
  orgEnabled: true,
  optIn: true,
  canManage: true,
  canUpload: true,
  canRead: true,
  transcript: {
    id: uuid(20),
    source: 'teams',
    status: 'fetched',
    unavailableReason: null,
    durationS: 3120,
    speakers: [
      { label: 'Sara Ost', name: 'Sara Ost', side: 'buyer' },
      { label: 'Tom', name: 'Teilnehmer 1', side: 'unknown' },
    ],
    fetchedAt: '2020-12-04T10:30:00Z',
    deleteAfter: '2021-03-04T10:30:00Z',
    released: false,
  },
};
const text: TranscriptText = {
  entries: [
    { at: 5, speaker: 'Sara Ost', text: 'Wir verlängern den Rahmenvertrag bis Ende März.' },
    { at: 70, speaker: 'Tom', text: 'Den Kapazitätsplan schicke ich bis Freitag.' },
  ],
  quotes: ['Den Kapazitätsplan schicke ich bis Freitag.'],
};
let state: MeetingTranscriptState;
let sent: { url: string; method: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  state = fetched;
  sent = [];
  api.handle = (request) => {
    const base = `/api/suppliers/${rel}/termine/${mid}`;
    if (request.url === `/api/suppliers/${rel}`) {
      return Response.json({
        relationshipId: rel,
        name: 'Rheintal Elektronik',
        organizationName: 'Rheintal Elektronik',
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
    if (request.url === `${base}/transkript/text`) return Response.json(text);
    if (request.url.startsWith(`${base}/transkript`)) {
      if (request.method !== 'GET') sent.push(request);
      if (request.url.endsWith('/opt-in'))
        state = { ...state, optIn: (request.body as { optIn: boolean }).optIn };
      return Response.json(state);
    }
    if (request.url === base) return Response.json(detail);
    return undefined;
  };
});

afterEach(tearDownApp);

describe('IN-05 Transkript am Termin', () => {
  it('zeigt Quelle, Dauer, Sprecher und Löschdatum; der Rohtext markiert Fundstellen', async () => {
    renderAt(`/lieferanten/${rel}/umsetzung/termine/${mid}?reiter=ergebnisse`);
    expect(await screen.findByText('Transkript aus Teams übernommen.')).toBeTruthy();
    expect(screen.getByText(/52 Minuten · 2 Sprecher · wird am/)).toBeTruthy();
    expect(screen.getByText('Sara Ost, Teilnehmer 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Transkript ansehen' }));
    const mark = await screen.findByText('Den Kapazitätsplan schicke ich bis Freitag.', {
      selector: 'mark',
    });
    expect(within(mark).getByText(/Fundstelle in einem Entwurf/)).toBeTruthy();
    expect(screen.getByText('01:10')).toBeTruthy();
    // Für Teilnehmer freigeben
    fireEvent.click(screen.getByRole('button', { name: 'Für Teilnehmer freigeben' }));
    await waitFor(() => expect(sent[0]).toMatchObject({ method: 'PUT', body: { released: true } }));
  });

  it('ohne Transkript: Grund in einem Satz, Upload und Notizen', async () => {
    state = {
      ...fetched,
      transcript: {
        ...(fetched.transcript as NonNullable<MeetingTranscriptState['transcript']>),
        status: 'unavailable',
        unavailableReason: 'Euer Microsoft-365-Mandant erlaubt den Zugriff auf Transkripte nicht.',
      },
    };
    renderAt(`/lieferanten/${rel}/umsetzung/termine/${mid}?reiter=ergebnisse`);
    expect(
      await screen.findByText(
        'Euer Microsoft-365-Mandant erlaubt den Zugriff auf Transkripte nicht.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Datei hochladen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Notizen erfassen' })).toBeTruthy();
    const input = screen.getByLabelText('Datei hochladen') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['Tom: Lieferplan'], 'mitschrift.txt')] },
    });
    await waitFor(() => expect(sent[0]?.url).toMatch(/\/transkript\/upload$/));
  });

  it('der Schalter „Transkript übernehmen“ steht im Reiter Vorbereitung', async () => {
    state = { ...fetched, optIn: false, transcript: null };
    renderAt(`/lieferanten/${rel}/umsetzung/termine/${mid}?reiter=vorbereitung`);
    const toggle = await screen.findByRole('switch', { name: 'Transkript übernehmen' });
    fireEvent.click(toggle);
    await waitFor(() => expect(sent[0]).toMatchObject({ method: 'PUT', body: { optIn: true } }));
  });
});

describe('IN-05 Einstellungen › Anbindungen › Transkripte', () => {
  it('ohne Betriebsvereinbarung ist Einschalten gesperrt; Bestätigen schickt das Datum', async () => {
    let settings: TranscriptSettings = {
      enabled: false,
      worksAgreement: null,
      retentionDays: 90,
      teamsMode: 'meeting',
      inviteNotice: 'Hinweis: Transkript',
      canManage: true,
    };
    api.handle = (request) => {
      if (request.url === '/api/einstellungen/anbindungen') {
        return Response.json({ connectors: [], events: [], issue: null });
      }
      if (request.url.startsWith('/api/einstellungen/transkripte')) {
        if (request.method !== 'GET') {
          sent.push(request);
          settings = {
            ...settings,
            worksAgreement: {
              confirmedAt: '2026-11-20',
              confirmedBy: 'Lena Berger',
              hasFile: false,
            },
          };
        }
        return Response.json(settings);
      }
      return undefined;
    };
    renderAt('/einstellungen/anbindungen');
    const enabled = (await screen.findByRole('switch', {
      name: 'Transkripte übernehmen',
    })) as HTMLButtonElement;
    expect(enabled.disabled).toBe(true);
    expect(screen.getByText('Noch nicht bestätigt.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Vorlage herunterladen' }).getAttribute('href')).toBe(
      '/vorlagen/betriebsvereinbarung-transkripte.txt',
    );
    fireEvent.change(screen.getByLabelText('Datum der Vereinbarung'), {
      target: { value: '2026-11-20' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }));
    await waitFor(() =>
      expect(sent[0]?.url).toBe('/api/einstellungen/transkripte/betriebsvereinbarung'),
    );
    expect(await screen.findByText(/Bestätigt am .* von Lena Berger\./)).toBeTruthy();
    expect(
      ((await screen.findByRole('switch', { name: 'Transkripte übernehmen' })) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});
