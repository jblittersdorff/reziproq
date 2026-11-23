// @vitest-environment jsdom
import type {
  CustomAgent,
  CustomAgentDetail,
  CustomAgentOptions,
  CustomAgentRunResults,
} from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/KI-09.md in der Oberfläche: Liste „Eure Agenten“ mit Freigaben, Anlegen in
// fünf Abschnitten mit nur sichtbaren Datenbereichen, Testlauf vor dem Aktivieren, Freigabe durch
// Admins, gesperrte Aufgabe mit Grund, Ergebnisse als Entwürfe zum Übernehmen.

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
const id = uuid(30);
const runId = uuid(40);

const agent = (patch: Partial<CustomAgentDetail> = {}): CustomAgentDetail => ({
  id,
  name: 'Verfehlte Zusagen',
  status: 'draft',
  ownerName: 'Lena Berger',
  isOwn: true,
  version: 1,
  config: {
    name: 'Verfehlte Zusagen',
    instructions: 'Finde Fokuslieferanten mit verfehlten Zusagen und schlage eine Maßnahme vor.',
    tools: ['commitments', 'actions'],
    trigger: { kind: 'schedule', schedule: { every: 'week', weekday: 1, time: '07:00' } },
    scope: { kind: 'focus' },
    output: 'action',
    reviewer: 'me',
    budgetCents: 100,
  },
  blockedReason: null,
  testPassed: false,
  lastTestRunId: null,
  needsApproval: true,
  reviewComment: null,
  pausedReason: null,
  runCount: 0,
  canEdit: true,
  canApprove: false,
  canStart: true,
  runs: [],
  ...patch,
});

const options: CustomAgentOptions = {
  tools: ['spend', 'commitments'],
  suppliers: [{ relationshipId: rel, name: 'Rheintal Elektronik' }],
  categories: [],
  maxBudgetCents: 500,
  approvalRequired: true,
  templates: [{ key: 'meeting_brief', name: 'Termin-Briefing', instructions: 'Bereite vor.' }],
};

let current: CustomAgentDetail;
let sent: { url: string; method: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  current = agent();
  sent = [];
  api.handle = (request) => {
    const base = '/api/ki/eigene-agenten';
    if (!request.url.startsWith(base)) return undefined;
    if (request.method !== 'GET') sent.push(request);
    if (request.url === `${base}/optionen`) return Response.json(options);
    if (request.url === base && request.method === 'POST') {
      const config = request.body as CustomAgent['config'];
      current = agent({ name: config.name, config });
      return Response.json(current);
    }
    if (request.url === `${base}/${id}/starten`) return Response.json({ runId });
    if (request.url === `${base}/${id}/aktivieren`) {
      current = { ...current, status: current.needsApproval ? 'pending_approval' : 'active' };
      return Response.json(current);
    }
    if (request.url === `${base}/${id}/pruefung`) {
      current = { ...current, status: 'active', canApprove: false };
      return Response.json(current);
    }
    if (request.url === `${base}/${id}`) return Response.json(current);
    return undefined;
  };
});

afterEach(tearDownApp);

describe('KI-09 Eigene Agenten', () => {
  it('zeigt „Eure Agenten“ mit Stand und Admins die wartenden Freigaben', async () => {
    const handle = api.handle;
    api.handle = (request) => {
      if (request.url === '/api/ki/agenten') {
        return Response.json({ agents: [], recentRuns: [], canManage: true });
      }
      if (request.url === '/api/ki/eigene-agenten') {
        return Response.json({
          agents: [agent({ status: 'active', runCount: 3 })],
          canCreate: true,
          pendingApproval: [
            agent({ id: uuid(31), name: 'Spend-Abweichungen Q4', status: 'pending_approval' }),
          ],
        });
      }
      return handle?.(request);
    };
    renderAt('/einstellungen/ki/agenten');
    const own = await screen.findByRole('region', { name: 'Eure Agenten' });
    expect(within(own).getByRole('heading', { name: 'Eure Agenten · 1' })).toBeTruthy();
    expect(within(own).getByText('Verfehlte Zusagen')).toBeTruthy();
    expect(within(own).getByText('aktiv')).toBeTruthy();
    expect(within(own).getByText(/Montags 07:00 · Lena Berger · 3 Läufe/)).toBeTruthy();
    expect(within(own).getByRole('link', { name: 'Agent anlegen' })).toBeTruthy();
    const pending = screen.getByRole('region', { name: 'Wartet auf eure Freigabe' });
    expect(within(pending).getByText('Spend-Abweichungen Q4')).toBeTruthy();
  });

  it('Anlegen: nur sichtbare Datenbereiche, Frage als Aufgabe, danach Testlauf', async () => {
    renderAt(
      `/einstellungen/ki/agenten/neu?aufgabe=${encodeURIComponent('Welche Zusagen sind offen?')}`,
    );
    const data = await screen.findByRole('group', { name: 'Datenbereiche' });
    expect(within(data).getAllByRole('checkbox')).toHaveLength(2);
    expect(within(data).getByLabelText('Spend je Jahr')).toBeTruthy();
    expect(within(data).queryByLabelText('Segmentierung')).toBeNull();
    for (const title of [
      'Was soll der Agent tun',
      'Welche Daten darf er lesen',
      'Wann läuft er',
      'Was kommt heraus',
      'Wer prüft und was darf es kosten',
    ]) {
      expect(screen.getByRole('heading', { name: new RegExp(title) })).toBeTruthy();
    }
    expect((screen.getByLabelText('Aufgabe') as HTMLTextAreaElement).value).toBe(
      'Welche Zusagen sind offen?',
    );
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Offene Zusagen' } });
    fireEvent.click(screen.getByLabelText('Zeitplan'));
    expect(
      await screen.findByText(
        'Mit Zeitplan oder Ereignis gibt ein Admin den Agenten frei, bevor er läuft.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern und Testlauf starten' }));
    await waitFor(() =>
      expect(sent.map((entry) => entry.url)).toContain(`/api/ki/eigene-agenten/${id}/starten`),
    );
    expect(sent[0]?.body).toMatchObject({
      name: 'Offene Zusagen',
      instructions: 'Welche Zusagen sind offen?',
      tools: ['spend'],
      trigger: { kind: 'schedule', schedule: { every: 'week', weekday: 1, time: '07:00' } },
      budgetCents: 100,
    });
    expect(sent[1]?.body).toEqual({ isTest: true });
    expect(await screen.findByRole('heading', { level: 1, name: 'Offene Zusagen' })).toBeTruthy();
  });

  it('ohne bestandenen Testlauf heißt der nächste Schritt „Testlauf starten“', async () => {
    renderAt(`/einstellungen/ki/agenten/eigene/${id}`);
    expect(await screen.findByRole('heading', { name: 'Testlauf starten' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Agent aktivieren|Zur Freigabe senden/ }),
    ).toBeNull();
    expect(screen.getByText('Noch kein Testlauf für diese Version.')).toBeTruthy();
  });

  it('nach dem Testlauf: mit Zeitplan zur Freigabe senden', async () => {
    current = agent({ testPassed: true, lastTestRunId: runId });
    const handle = api.handle;
    api.handle = (request) => {
      if (request.url === `/api/ki/agenten/laeufe/${runId}`) {
        return Response.json({
          run: {
            id: runId,
            agentName: 'Verfehlte Zusagen',
            custom: true,
            version: 1,
            status: 'done',
            isTest: true,
            isOwn: true,
            stepsUsed: 5,
            costCents: 2,
            createdAt: '2026-11-23T07:00:00.000Z',
            startedAt: '2026-11-23T07:00:00.000Z',
            finishedAt: '2026-11-23T07:00:05.000Z',
            cancellationPending: false,
            canResume: false,
            startedBy: 'Lena Berger',
          },
          steps: [],
          draftHref: null,
          testResult: null,
          detailsAllowed: true,
          customAgentId: id,
        });
      }
      if (request.url === `/api/ki/eigene-agenten/laeufe/${runId}/ergebnisse`) {
        return Response.json({
          output: 'action',
          canAccept: false,
          results: [
            {
              relationshipId: rel,
              supplier: 'Rheintal Elektronik',
              title: 'Zwei Zusagen überfällig',
              text: 'Lieferplan und Prüfbericht nachfassen.',
              draftId: null,
              status: null,
            },
          ],
        } satisfies CustomAgentRunResults);
      }
      return handle?.(request);
    };
    current = {
      ...current,
      runs: [
        {
          id: runId,
          version: 1,
          status: 'done',
          isTest: true,
          createdAt: '2026-11-23T07:00:00.000Z',
          startedBy: 'Lena Berger',
        },
      ],
    };
    renderAt(`/einstellungen/ki/agenten/eigene/${id}`);
    const test = await screen.findByRole('region', { name: 'Testlauf' });
    expect(await within(test).findByText('Zwei Zusagen überfällig')).toBeTruthy();
    expect(within(test).queryByRole('button', { name: 'Übernehmen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Zur Freigabe senden/ }));
    await waitFor(() => expect(sent.at(-1)?.url).toBe(`/api/ki/eigene-agenten/${id}/aktivieren`));
    expect(
      await screen.findByRole('heading', { name: 'Wartet auf Freigabe durch einen Admin' }),
    ).toBeTruthy();
  });

  it('eine Aufgabe, die Personen bewertet, nennt den Grund und lässt sich nicht aktivieren', async () => {
    current = agent({
      blockedReason: 'Agenten bewerten Lieferanten und Beziehungen, nie einzelne Personen.',
    });
    renderAt(`/einstellungen/ki/agenten/eigene/${id}`);
    expect(
      await screen.findByText(
        'Nicht aktivierbar: Agenten bewerten Lieferanten und Beziehungen, nie einzelne Personen.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Aufgabe ändern' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Agent aktivieren|Testlauf starten/ })).toBeNull();
  });

  it('Admins geben frei oder geben mit Kommentar zurück', async () => {
    current = agent({
      status: 'pending_approval',
      isOwn: false,
      canEdit: false,
      canApprove: true,
      testPassed: true,
    });
    renderAt(`/einstellungen/ki/agenten/eigene/${id}`);
    expect(
      await screen.findByText('Lena Berger hat den Agenten zur Freigabe gesendet.'),
    ).toBeTruthy();
    const back = screen.getByRole('region', { name: 'Zurückgeben' });
    const giveBack = within(back).getByRole('button', { name: 'Zurückgeben' }) as HTMLButtonElement;
    expect(giveBack.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Freigeben/ }));
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        url: `/api/ki/eigene-agenten/${id}/pruefung`,
        body: { decision: 'approve' },
      }),
    );
  });

  it('Ergebnisse eines echten Laufs lassen sich übernehmen', async () => {
    const handle = api.handle;
    api.handle = (request) => {
      if (request.url === `/api/ki/agenten/laeufe/${runId}`) {
        return Response.json({
          run: {
            id: runId,
            agentName: 'Verfehlte Zusagen',
            custom: true,
            version: 1,
            status: 'done',
            isTest: false,
            isOwn: true,
            stepsUsed: 5,
            costCents: 2,
            createdAt: '2026-11-23T07:00:00.000Z',
            startedAt: null,
            finishedAt: null,
            cancellationPending: false,
            canResume: false,
            startedBy: 'Lena Berger',
          },
          steps: [{ seq: 2, key: 'read', status: 'done', finishedAt: null }],
          draftHref: null,
          testResult: null,
          detailsAllowed: true,
          customAgentId: id,
        });
      }
      if (request.url === `/api/ki/eigene-agenten/laeufe/${runId}/ergebnisse`) {
        return Response.json({
          output: 'action',
          canAccept: true,
          results: [
            {
              relationshipId: rel,
              supplier: 'Rheintal Elektronik',
              title: 'Zwei Zusagen überfällig',
              text: 'Lieferplan nachfassen.',
              draftId: uuid(50),
              status: 'draft',
            },
          ],
        } satisfies CustomAgentRunResults);
      }
      if (request.url.endsWith('/uebernehmen')) {
        sent.push(request);
        return new Response(null, { status: 204 });
      }
      return handle?.(request);
    };
    renderAt(`/einstellungen/ki/agenten/laeufe/${runId}`);
    expect(await screen.findByText('Verfehlte Zusagen')).toBeTruthy();
    expect(screen.getByText('Daten lesen')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Zum Agenten' }).getAttribute('href')).toBe(
      `/einstellungen/ki/agenten/eigene/${id}`,
    );
    expect(await screen.findByText('Entwurf von Reziproq · Rheintal Elektronik')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    await waitFor(() =>
      expect(sent.at(-1)?.url).toBe(`/api/ki/eigene-agenten/entwuerfe/${uuid(50)}/uebernehmen`),
    );
  });
});
