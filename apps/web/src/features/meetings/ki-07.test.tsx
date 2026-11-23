// @vitest-environment jsdom
import type { MeetingDetail, QbrPrep } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/KI-07.md in der Oberfläche: interne Vorbereitung mit Themen, Risiken und
// offenen Punkten als Entwürfe mit Quelle; ein übernommenes Thema geht nur ausdrücklich in die Agenda.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
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
const source = {
  id: uuid(80),
  kind: 'own_data' as const,
  title: 'Liefertreue',
  objectType: 'scorecard_kpi',
  objectId: uuid(81),
  url: null,
  publishedAt: '2026-10-01',
  excerpt: null,
};
const claimDraft = (id: number, status: 'draft' | 'accepted', text: string) => ({
  id: uuid(id),
  status,
  content: `- ${text}`,
  model: 'reziproq',
  createdAt: '2099-03-08T05:00:00Z',
  decidedAt: status === 'accepted' ? '2099-03-08T06:00:00Z' : null,
  claims: [{ key: '1', text, sources: [source], thinlySupported: false }],
});
let prep: QbrPrep;
let sent: { url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  current = open();
  sent = [];
  prep = {
    canDraft: true,
    topics: {
      draft: claimDraft(
        71,
        'draft',
        '„Liefertreue“ wieder auf Kurs bringen — liegt bei 82 %, Ziel 95 %.',
      ),
      accepted: null,
    },
    risks: {
      draft: claimDraft(72, 'draft', '„Liefertreue“ liegt bei 82 %, Ziel 95 %.'),
      accepted: null,
    },
    openPoints: { draft: null, accepted: null },
  };
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
    if (request.url.startsWith(`/api/suppliers/${rel}/termine/${mid}/zusammenfassung`)) {
      return Response.json({ canDraft: true, draft: null, accepted: null });
    }
    const prepPath = `/api/suppliers/${rel}/termine/${mid}/vorbereitung`;
    if (request.url.startsWith(prepPath)) {
      if (request.method === 'POST') {
        sent.push({ url: request.url.slice(prepPath.length), body: request.body });
        if (request.url.endsWith('/uebernehmen')) {
          prep = {
            ...prep,
            topics: {
              draft: null,
              accepted: {
                ...(prep.topics.draft as NonNullable<QbrPrep['topics']['draft']>),
                status: 'accepted',
                decidedAt: '2099-03-08T06:00:00Z',
              },
            },
          };
        }
      }
      return Response.json(prep);
    }
    if (request.url === '/api/ki/agenten') {
      return Response.json({
        agents: [{ id: uuid(90), key: 'qbr_prep', enabled: true, version: 1, runCount: 0 }],
        recentRuns: [],
        canManage: false,
      });
    }
    if (request.url === `/api/suppliers/${rel}/termine/${mid}`) return Response.json(current);
    return undefined;
  };
});

afterEach(tearDownApp);

const page = `/lieferanten/${rel}/umsetzung/termine/${mid}`;

describe('KI-07 QBR-Vorbereitung', () => {
  it('zeigt Themen und Risiken als Entwürfe mit Quelle; ein Thema geht erst nach Übernahme in die Agenda', async () => {
    renderAt(page);
    const section = await screen.findByRole('region', {
      name: 'Interne Vorbereitung von Reziproq',
    });
    expect(within(section).getByText(/Risiken · Entwurf vom/)).toBeTruthy();
    expect(within(section).getAllByText(/Liefertreue/).length).toBeGreaterThan(0);
    expect(within(section).queryByRole('button', { name: /In die Agenda/ })).toBeNull();
    fireEvent.click(
      within(section).getAllByRole('button', { name: 'Übernehmen' })[0] as HTMLElement,
    );
    await waitFor(() => expect(sent[0]?.url).toBe(`/${uuid(71)}/uebernehmen`));
    fireEvent.click(
      await within(section).findByRole('button', {
        name: 'In die Agenda: „Liefertreue“ wieder auf Kurs bringen',
      }),
    );
    await waitFor(() =>
      expect(sent[1]).toEqual({ url: `/${uuid(71)}/agenda`, body: { claimKey: '1' } }),
    );
  });

  it('ohne Recht keine Knöpfe; ohne Entwürfe der Hinweis auf den Lauf sieben Tage vorher', async () => {
    prep = {
      canDraft: false,
      topics: { draft: null, accepted: null },
      risks: { draft: null, accepted: null },
      openPoints: { draft: null, accepted: null },
    };
    renderAt(page);
    const section = await screen.findByRole('region', {
      name: 'Interne Vorbereitung von Reziproq',
    });
    expect(
      within(section).getByText(
        'Noch keine Vorbereitung. Sieben Tage vor dem Termin bereitet Reziproq ihn vor.',
      ),
    ).toBeTruthy();
    expect(within(section).queryByRole('button', { name: 'Neu vorbereiten' })).toBeNull();
  });
});
