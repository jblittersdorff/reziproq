// @vitest-environment jsdom
import type { ActivityFeed, Inbox, SupplierDetail } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutlookAdapter } from '@/features/calendar/outlook-adapter';
import {
  actionsFor,
  anna,
  api,
  renderAt,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';

// Tests zu docs/specs/IN-04.md in der Oberfläche: Mail in den Aktivitäten mit Zusammenfassung,
// Anhängen, Text zum Aufklappen und Filter „Mails“; weitergeleitete Mail in „Neu eingegangen“
// ohne Termintyp; Outlook-Add-in legt eine gelesene Mail mit Sichtbarkeit ab.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
const outlook = vi.hoisted(() => ({ adapter: null as unknown }));
vi.mock('@/features/calendar/outlook-adapter', () => ({
  outlookAdapter: async () => outlook.adapter,
}));
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
const mailId = uuid(2);
const detail: SupplierDetail = {
  relationshipId: rel,
  name: 'Rheintal Elektronik GmbH',
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
};
const feed: ActivityFeed = {
  canWrite: true,
  items: [
    {
      id: `mail:${mailId}`,
      kind: 'mail',
      occurredAt: '2026-11-20T09:30:00Z',
      actor: { type: 'person', name: 'Sara Ost' },
      title: 'Kapazitätsplanung 2028',
      code: 'addin',
      meta: 'Tom Weber',
      href: null,
      visibility: 'team',
      pinned: false,
      mine: true,
      mail: {
        id: mailId,
        fromEmail: 'tom@rheintal.example',
        fromName: 'Tom Weber',
        sentAt: '2026-11-20T09:30:00Z',
        summary: 'Rheintal plant 2028 eine zweite Linie. Die Kapazität steigt um 30 Prozent.',
        source: 'addin',
        attachments: [
          {
            id: uuid(3),
            fileName: 'plan.pdf',
            mime: 'application/pdf',
            size: 20_480,
            stored: true,
          },
          {
            id: uuid(4),
            fileName: 'video.mp4',
            mime: 'video/mp4',
            size: 90_000_000,
            stored: false,
          },
        ],
      },
    },
  ],
};
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sent = [];
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = [...actionsFor.member, 'termine.sehen', 'notizen.schreiben'];
  api.handle = (request) => {
    if (request.url === `/api/suppliers/${rel}`) return Response.json(detail);
    if (request.url.startsWith(`/api/suppliers/${rel}/aktivitaeten`)) {
      sent.push(request);
      return Response.json(feed);
    }
    if (request.url === `/api/suppliers/${rel}/mails/${mailId}` && request.method === 'GET') {
      return Response.json({
        id: mailId,
        subject: 'Kapazitätsplanung 2028',
        toEmails: ['sara@nordwind.example'],
        bodyText: 'Hallo Sara,\nwir planen 2028 eine zweite Linie.',
      });
    }
    if (request.url === `/api/suppliers/${rel}/mails/${mailId}` && request.method === 'DELETE') {
      sent.push(request);
      return new Response(null, { status: 204 });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('IN-04 Mails in den Aktivitäten', () => {
  it('zeigt die Mail mit Absender, Herkunft, Zusammenfassung von Reziproq und Anhängen', async () => {
    renderAt(`/lieferanten/${rel}/aktivitaeten`);
    const entry = (await screen.findByText('Mail „Kapazitätsplanung 2028“ von Tom Weber')).closest(
      'li',
    ) as HTMLElement;
    expect(within(entry).getByText('abgelegt mit dem Add-in · 2 Anhänge')).toBeTruthy();
    const draft = entry.querySelector('[data-slot="ai-draft"]') as HTMLElement;
    expect(within(draft).getByText('Zusammengefasst von Reziproq')).toBeTruthy();
    expect(within(draft).getByText(/zweite Linie/)).toBeTruthy();
    expect(within(entry).getByRole('button', { name: 'plan.pdf · 20 KB' })).toBeTruthy();
    expect(within(entry).getByText('video.mp4 · über 25 MB, nicht gespeichert')).toBeTruthy();
  });

  it('der Text kommt erst beim Aufklappen; der Filter „Mails“ fragt nur Mails ab', async () => {
    renderAt(`/lieferanten/${rel}/aktivitaeten`);
    const entry = (await screen.findByText(/Kapazitätsplanung 2028/)).closest('li') as HTMLElement;
    expect(within(entry).queryByText(/wir planen 2028/)).toBeNull();
    fireEvent.click(within(entry).getByRole('button', { name: 'Text anzeigen' }));
    expect(await within(entry).findByText(/wir planen 2028 eine zweite Linie/)).toBeTruthy();
    expect(within(entry).getByText('An: sara@nordwind.example')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Mails' }));
    await waitFor(() =>
      expect(sent.some((request) => request.url.endsWith('/aktivitaeten?filter=mails'))).toBe(true),
    );
  });

  it('eigene Mail löschen nach Bestätigung auf der Seite', async () => {
    renderAt(`/lieferanten/${rel}/aktivitaeten`);
    const entry = (await screen.findByText(/Kapazitätsplanung 2028/)).closest('li') as HTMLElement;
    fireEvent.click(within(entry).getByRole('button', { name: 'Löschen' }));
    expect(within(entry).getByText('Mail mit Text und Anhängen löschen?')).toBeTruthy();
    const row = entry.querySelector('[data-slot="confirm-row"]') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Löschen' }));
    await waitFor(() =>
      expect(sent.find((request) => request.method === 'DELETE')?.url).toBe(
        `/api/suppliers/${rel}/mails/${mailId}`,
      ),
    );
  });
});

describe('IN-04 Weitergeleitete Mail in „Neu eingegangen“', () => {
  it('zeigt Absender ohne Termintyp und legt beim gewählten Lieferanten ab', async () => {
    const inbox: Inbox = {
      open: [
        {
          id: uuid(10),
          kind: 'mail',
          source: 'inbound_mail',
          receivedAt: '2026-11-23T08:00:00Z',
          subject: 'Messe Hannover',
          startsAt: '2026-11-22T15:00:00Z',
          organizer: 'info@unbekannt.example',
          attendees: 1,
          suggestionKind: 'none',
          suggestions: [],
          suggestionReason:
            'Absender und Empfänger von unbekannt.example sind noch keinem Lieferanten zugeordnet.',
          suggestedType: 'other',
          status: 'needs_review',
          objectType: null,
          assigned: [],
        },
      ],
      today: [],
      suppliers: [{ relationshipId: rel, name: 'Rheintal Elektronik' }],
      active: true,
    };
    api.handle = (request) => {
      if (request.url.startsWith('/api/mein-tag/eingang')) {
        if (request.method !== 'GET') sent.push(request);
        return Response.json(inbox);
      }
      return undefined;
    };
    renderAt('/mein-tag/eingang');
    const item = (await screen.findByText('Messe Hannover')).closest('li') as HTMLElement;
    expect(within(item).getByText('Weitergeleitete Mail')).toBeTruthy();
    expect(within(item).getByText(/Mail von info@unbekannt\.example/)).toBeTruthy();
    expect(within(item).queryByLabelText('Termintyp')).toBeNull();
    expect(within(item).queryByRole('button', { name: 'Als Ereignis speichern' })).toBeNull();
    fireEvent.click(await within(item).findByRole('button', { name: 'Ablegen' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        url: `/api/mein-tag/eingang/${uuid(10)}/entscheiden`,
        body: { action: 'assign', relationshipIds: [rel] },
      }),
    );
  });
});

describe('IN-04 Outlook-Add-in in einer gelesenen Mail', () => {
  it('erkennt den Lieferanten und legt die Mail erst nach dem Klick mit „Nur ich“ ab', async () => {
    const adapter: OutlookAdapter = {
      preview: false,
      read: async () => ({
        mode: 'message',
        subject: 'Kapazitätsplanung 2028',
        from: 'tom@rheintal.example',
        to: ['sara@nordwind.example'],
        cc: [],
        itemId: 'AAMk-rest-id',
      }),
      addAttendeeAndSave: vi.fn(async () => null),
      prependBody: vi.fn(async () => undefined),
    };
    api.handle = (request) => {
      if (request.url === '/api/mails/addin/erkennen') {
        sent.push(request);
        return Response.json({
          supplier: { relationshipId: rel, name: 'Rheintal Elektronik' },
          candidates: [{ relationshipId: rel, name: 'Rheintal Elektronik' }],
          reason: 'Rheintal Elektronik: Teilnehmer von rheintal.example.',
          suggestedType: 'other',
        });
      }
      if (request.url === '/api/mails/addin/ablegen') {
        sent.push(request);
        return Response.json({
          created: true,
          mailId,
          href: `/lieferanten/${rel}/aktivitaeten?filter=mails#mail-${mailId}`,
        });
      }
      return undefined;
    };
    outlook.adapter = adapter;
    renderAt('/addin/outlook');
    expect(await screen.findByText('Erkannter Lieferant')).toBeTruthy();
    expect(screen.getByText('Mail von tom@rheintal.example')).toBeTruthy();
    expect(screen.queryByLabelText('Termintyp')).toBeNull();
    // Bis zum Klick nur die Erkennung über Adressen, keine Übertragung der Mail
    expect(sent.map((request) => request.url)).toEqual(['/api/mails/addin/erkennen']);
    fireEvent.click(screen.getByRole('radio', { name: 'Nur ich' }));
    fireEvent.click(screen.getByRole('button', { name: 'In Reziproq ablegen' }));
    await waitFor(() =>
      expect(sent[1]).toMatchObject({
        url: '/api/mails/addin/ablegen',
        body: { itemId: 'AAMk-rest-id', relationshipId: rel, visibility: 'private' },
      }),
    );
    expect(
      await screen.findByText('Abgelegt. Die Mail steht in den Aktivitäten des Lieferanten.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'In Reziproq öffnen' }).getAttribute('href')).toBe(
      `/lieferanten/${rel}/aktivitaeten?filter=mails#mail-${mailId}`,
    );
  });
});
