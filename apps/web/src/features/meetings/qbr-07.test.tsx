// @vitest-environment jsdom
import type { MeetingDetail, PreReadDraft } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/QBR-07.md in der Oberfläche: Entwurf als KI-Entwurf, vor dem Übernehmen
// bearbeitbar, höchstens 200 Wörter; übernommen fest mit dem Hinweis, dass nur die eigene Seite ihn
// sieht.

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
const draftId = uuid(70);
const draftText =
  'Stand: Die Zusammenarbeit läuft stabil. Offen bleibt die Zweitquelle für Gehäuse.';
let summary: PreReadDraft;
let sent: { url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  current = open();
  sent = [];
  summary = { canDraft: true, draft: null, accepted: null };
  const draft = {
    id: draftId,
    status: 'draft' as const,
    content: draftText,
    model: 'test',
    createdAt: '2099-03-01T09:00:00Z',
    decidedAt: null,
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
    const summaryPath = `/api/suppliers/${rel}/termine/${mid}/zusammenfassung`;
    if (request.url.startsWith(summaryPath)) {
      if (request.method === 'POST') {
        sent.push({ url: request.url.slice(summaryPath.length), body: request.body });
        if (request.url === summaryPath) summary = { ...summary, draft };
        if (request.url.endsWith('/uebernehmen')) {
          summary = {
            ...summary,
            draft: null,
            accepted: {
              ...draft,
              status: 'accepted',
              content: (request.body as { content: string }).content,
              decidedAt: '2099-03-01T10:00:00Z',
            },
          };
        }
      }
      return Response.json(summary);
    }
    if (request.url === `/api/suppliers/${rel}/termine/${mid}`) return Response.json(current);
    return undefined;
  };
});

afterEach(tearDownApp);

const page = `/lieferanten/${rel}/umsetzung/termine/${mid}`;

describe('QBR-07 KI-Entwurf für den Pre-Read', () => {
  it('der Entwurf lässt sich bearbeiten und übernehmen; übernommen ist er fest', async () => {
    renderAt(page);
    const section = await screen.findByRole('region', { name: 'Zusammenfassung für den Pre-Read' });
    fireEvent.click(
      await within(section).findByRole('button', { name: 'Zusammenfassung vorschlagen' }),
    );
    expect(await within(section).findByText('KI-Entwurf, bitte prüfen')).toBeTruthy();
    expect(section.querySelector('[data-slot="ai-draft"]:not([data-confirmed])')).toBeTruthy();
    const field = within(section).getByLabelText('Text bearbeiten') as HTMLTextAreaElement;
    expect(field.value).toBe(draftText);
    // Interne Quellen nennt der Käufer-Entwurf als Quellen
    expect(within(section).getByText('Lieferantenplan')).toBeTruthy();

    fireEvent.change(field, { target: { value: `${draftText} Ergänzt.` } });
    fireEvent.click(within(section).getByRole('button', { name: 'Übernehmen' }));
    await waitFor(() =>
      expect(sent.at(-1)).toEqual({
        url: `/${draftId}/uebernehmen`,
        body: { content: `${draftText} Ergänzt.` },
      }),
    );
    expect(await within(section).findByText(/Zusammenfassung · übernommen am/)).toBeTruthy();
    expect(section.querySelector('[data-slot="ai-draft"][data-confirmed]')).toBeTruthy();
    expect(within(section).getByText(/die andere Seite sieht ihn nie/)).toBeTruthy();
  });

  it('über 200 Wörtern lässt sich der Entwurf nicht übernehmen', async () => {
    renderAt(page);
    const section = await screen.findByRole('region', { name: 'Zusammenfassung für den Pre-Read' });
    fireEvent.click(
      await within(section).findByRole('button', { name: 'Zusammenfassung vorschlagen' }),
    );
    const field = (await within(section).findByLabelText('Text bearbeiten')) as HTMLTextAreaElement;
    fireEvent.change(field, {
      target: { value: Array.from({ length: 201 }, () => 'Wort').join(' ') },
    });
    expect(within(section).getByText('201 von höchstens 200 Wörtern')).toBeTruthy();
    expect(
      (within(section).getByRole('button', { name: 'Übernehmen' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('ohne Recht und ohne übernommene Zusammenfassung erscheint der Bereich nicht', async () => {
    summary = { canDraft: false, draft: null, accepted: null };
    renderAt(page);
    expect(await screen.findByText('Zweitquelle Gehäuse')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Zusammenfassung für den Pre-Read' })).toBeNull();
  });
});
