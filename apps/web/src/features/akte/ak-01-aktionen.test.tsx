// @vitest-environment jsdom
import type { MeetingBrief } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aktePrivateSample } from '@/testing/akte-private-sample';
import {
  api,
  renderAt,
  sampleAkteHead,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';

// AK-01 (K2-c.6, KN-41): Aktionen von Reziproq im Kopf der Akte. Jede startet einen Lauf mit den
// Rechten der Person: „Wert finden“ den Wertfinder (KI-11), „Briefing JBP“ das Termin-Briefing
// (KI-07) zum nächsten wichtigen Termin, das sich danach öffnet.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const id = sampleAkteHead.relationshipId;
const meetingId = sampleAkteHead.nextMeeting?.id ?? '';
const agentId = '00000000-0000-7000-8000-000000002001';
const akte = `/beziehungen/${id}`;

let calls: { method: string; url: string }[];
let finder: () => Response;
let brief: MeetingBrief['freshness'];

const emptyPart = { draft: null, accepted: null };
const briefOf = (freshness: MeetingBrief['freshness']): MeetingBrief => ({
  canDecide: true,
  leadDays: 3,
  durationMinutes: 120,
  parts: {
    situation: emptyPart,
    goals: emptyPart,
    agenda: emptyPart,
    internalQuestions: emptyPart,
    supplierQuestions: emptyPart,
    expectedQuestions: emptyPart,
    risks: emptyPart,
    openPoints: emptyPart,
  },
  participants: [],
  sourceCounts: [],
  freshness,
  agendaShared: false,
});

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  const sample = aktePrivateSample();
  api.aktePrivate = sample;
  calls = [];
  finder = () =>
    Response.json({ ...sample.opportunities, counts: { new: 3, adopted: 1, realized: 0 } });
  brief = { runId: null, preparedAt: null, unchanged: false, running: false };
  api.handle = ({ method, url }) => {
    calls.push({ method, url });
    if (method === 'POST' && url === `/api/suppliers/${id}/wertpotenziale/lauf`) return finder();
    if (url === `/api/suppliers/${id}/termine/${meetingId}/briefing`) {
      return Response.json(briefOf(brief));
    }
    if (url === '/api/ki/agenten') {
      return Response.json({
        agents: [{ id: agentId, key: 'meeting_brief', enabled: true, version: 1, runCount: 0 }],
        recentRuns: [],
        canManage: false,
      });
    }
    if (method === 'POST' && url === `/api/ki/agenten/${agentId}/starten`) {
      return Response.json({
        run: {
          id: '00000000-0000-7000-8000-000000002002',
          agentName: 'Termin-Briefing',
          version: 1,
          status: 'running',
          isTest: false,
          isOwn: true,
          stepsUsed: 0,
          costCents: 0,
          createdAt: '2026-11-27T10:00:00.000Z',
          startedAt: '2026-11-27T10:00:00.000Z',
          finishedAt: null,
          cancellationPending: false,
          canResume: false,
          startedBy: 'Anna Schmidt',
        },
        steps: [],
        draftHref: null,
        testResult: null,
        detailsAllowed: true,
      });
    }
    return undefined;
  };
});
afterEach(tearDownApp);

const actions = async () =>
  within((await screen.findByRole('navigation', { name: 'Aktionen von Reziproq' })) as HTMLElement);

describe('AK-01 Aktionen von Reziproq (K2-c.6)', () => {
  it('„Wert finden“ startet den Wertfinder mit den Rechten der Person und sagt, was er fand', async () => {
    renderAt(akte);
    const value = await (await actions()).findByRole('button', { name: 'Wert finden' });
    fireEvent.click(value);
    const status = await screen.findByRole('status');
    expect(status.textContent).toContain(
      'Reziproq hat für Rheintal Elektronik 3 neue Wertpotenziale gefunden.',
    );
    expect(
      within(status).getByRole('link', { name: 'Wertpotenziale ansehen' }).getAttribute('href'),
    ).toBe(`/lieferanten/${id}/wirkung/wertpotenziale`);
    expect(calls).toContainEqual({
      method: 'POST',
      url: `/api/suppliers/${id}/wertpotenziale/lauf`,
    });
  });

  it('ist der Wertfinder in Mein Agent aus, sagt die Akte das und führt dorthin', async () => {
    finder = () =>
      Response.json(
        { statusCode: 409, code: 'ki_aufgabe_aus', aufgabe: 'value_finder' },
        { status: 409 },
      );
    renderAt(akte);
    fireEvent.click(await (await actions()).findByRole('button', { name: 'Wert finden' }));
    const warning = await screen.findByRole('alert');
    expect(warning.textContent).toContain('Der Wertfinder ist in Mein Agent ausgeschaltet.');
    expect(within(warning).getByRole('link', { name: 'Mein Agent' }).getAttribute('href')).toBe(
      '/mein-agent',
    );
  });

  it('wer den Wertfinder nicht starten darf, kommt zu den Wertpotenzialen', async () => {
    const sample = aktePrivateSample();
    sample.opportunities = { ...sample.opportunities, canRun: false };
    api.aktePrivate = sample;
    renderAt(akte);
    const link = await (await actions()).findByRole('link', { name: 'Wert finden' });
    expect(link.getAttribute('href')).toBe(`/lieferanten/${id}/wirkung/wertpotenziale`);
  });

  it('„Briefing JBP“ startet das Briefing, wenn es fehlt, und öffnet den Termin', async () => {
    const router = renderAt(akte);
    fireEvent.click(await (await actions()).findByRole('button', { name: 'Briefing JBP' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/lieferanten/${id}/umsetzung/termine/${meetingId}`,
      ),
    );
    expect(calls).toContainEqual({ method: 'POST', url: `/api/ki/agenten/${agentId}/starten` });
  });

  it('ein aktuelles Briefing öffnet sich ohne neuen Lauf', async () => {
    brief = {
      runId: '00000000-0000-7000-8000-000000002003',
      preparedAt: '2026-11-26T06:00:00.000Z',
      unchanged: true,
      running: false,
    };
    const router = renderAt(akte);
    fireEvent.click(await (await actions()).findByRole('button', { name: 'Briefing JBP' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/lieferanten/${id}/umsetzung/termine/${meetingId}`,
      ),
    );
    expect(calls.some((call) => call.url.endsWith('/starten'))).toBe(false);
  });
});
