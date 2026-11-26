// @vitest-environment jsdom
import type { MeetingDetail } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/QBR-01.md, Teil b, in der Oberfläche: Live-Abschnitte, Abschließen mit
// Bestätigung auf der Seite, eingefrorener Stand.

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
const detail = {
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

let current: MeetingDetail;
const open = (): MeetingDetail => ({
  meeting: {
    id: mid,
    type: 'quarterly_review',
    title: 'Quartalsreview Q1',
    startsAt: '2099-03-15T09:00:00Z',
    durationMinutes: 60,
    location: 'Werk Nord',
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
  live: {
    sections: [
      {
        key: 'actions',
        items: [{ id: 'a1', title: 'Zweitquelle Gehäuse', status: 'offen', dueDate: null }],
      },
    ],
    frozenAt: null,
  },
  canClose: true,
});
const closed = (): MeetingDetail => ({
  ...open(),
  meeting: { ...open().meeting, status: 'closed' },
  canEditMeeting: false,
  canContribute: false,
  canClose: false,
  live: { ...open().live, frozenAt: '2099-03-15T11:00:00Z' },
});
let posted: string[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  current = open();
  posted = [];
  api.handle = (request) => {
    if (request.url === `/api/suppliers/${rel}`) return Response.json(detail);
    if (request.url.startsWith(`/api/suppliers/${rel}/overview`)) {
      return Response.json({
        head: { segment: null, sro: null, nextMeeting: null },
        metrics: [],
        cycle: null,
        canStartCycle: false,
        canSetJbpDate: false,
      });
    }
    if (request.url === `/api/suppliers/${rel}/termine/${mid}/abschliessen`) {
      posted.push(request.method);
      current = closed();
      return Response.json(current, { status: 201 });
    }
    if (request.url === `/api/suppliers/${rel}/termine/${mid}`) return Response.json(current);
    return undefined;
  };
});

afterEach(tearDownApp);

const page = `/lieferanten/${rel}/umsetzung/termine/${mid}`;

describe('QBR-01b Termin abschließen', () => {
  it('die Live-Abschnitte zeigen den Stand aus ihrem Ort', async () => {
    renderAt(page);
    const live = await screen.findByRole('region', { name: 'Aktueller Stand' });
    expect(within(live).getByText('Offene Zusagen und Aufgaben')).toBeDefined();
    expect(within(live).getByText('Zweitquelle Gehäuse')).toBeDefined();
    expect(within(live).getByText('offen')).toBeDefined();
  });

  it('Abschließen fragt auf der Seite nach und zeigt danach den eingefrorenen Stand', async () => {
    renderAt(page);
    fireEvent.click(await screen.findByRole('button', { name: 'Termin abschließen' }));
    const row = screen.getByRole('group', {
      name: 'Protokoll und Beschlüsse sperren und den Stand einfrieren?',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: 'Abschließen' }));
    await waitFor(() => expect(posted).toEqual(['POST']));
    expect(await screen.findByText('Termin abgeschlossen.')).toBeDefined();
    expect(await screen.findByRole('region', { name: /^Stand zum Abschluss am/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Termin abschließen' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Bearbeiten/ })).toBeNull();
  });

  it('ohne Live-Quelle erscheint kein leerer Abschnitt, und wer nicht angelegt hat, schließt nicht ab', async () => {
    current = { ...open(), live: { sections: [], frozenAt: null }, canClose: false };
    renderAt(page);
    await screen.findByRole('heading', { level: 1, name: 'Quartalsreview Q1' });
    expect(screen.queryByRole('region', { name: 'Aktueller Stand' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Termin abschließen' })).toBeNull();
  });
});
