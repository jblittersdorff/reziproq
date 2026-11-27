// @vitest-environment jsdom
import type { ActivityFeed, ReviewStack, SupplierDetail } from '@reziproq/shared';
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

// Tests zu docs/specs/IN-04.md in der Oberfläche: Mail im Verlauf der Akte mit Zusammenfassung,
// Anhängen, Text zum Aufklappen und Filter „Mails“; weitergeleitete Mail in „Neu eingegangen“
// ohne Termintyp; Outlook-Add-in legt eine gelesene Mail mit Sichtbarkeit ab.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
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
    if (request.url === `/api/beziehungen/${rel}`) {
      return Response.json({
        relationshipId: rel,
        name: 'Rheintal Elektronik GmbH',
        status: 'active',
        segment: null,
        isFocus: false,
        materialGroups: [],
        lead: null,
        year: 2026,
        spend: null,
        nextMeeting: null,
      });
    }
    if (request.url.startsWith(`/api/suppliers/${rel}/aktivitaeten`)) {
      sent.push(request);
      return Response.json(feed);
    }
    if (request.url === `/api/suppliers/${rel}/mails/${mailId}` && request.method === 'GET') {
      return Response.json({
        id: mailId,
        subject: 'Kapazitätsplanung 2028',
        toEmails: ['sara@hollmann.example'],
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

// K2-c.7: Die Seite Aktivitäten leitet in den Verlauf der Akte (Nur für dich); dort klappt die Mail
// auf und zeigt, was bisher in ihrer Zeile stand
describe('IN-04 Mails im Verlauf der Akte', () => {
  const openMail = async () => {
    renderAt(`/beziehungen/${rel}?sicht=privat`);
    const history = await screen.findByRole('region', { name: 'Verlauf · nur euer Team' });
    const button = await within(history).findByRole('button', { name: /Mail von Tom Weber/ });
    fireEvent.click(button);
    return button.closest('[data-slot="disclosure-row"]') as HTMLElement;
  };

  it('zeigt die Mail mit Absender, Herkunft, Zusammenfassung von Reziproq und Anhängen', async () => {
    const entry = await openMail();
    expect(within(entry).getByText('abgelegt mit dem Add-in · 2 Anhänge')).toBeTruthy();
    const draft = entry.querySelector('[data-slot="ai-draft"]') as HTMLElement;
    expect(within(draft).getByText('Zusammengefasst von Reziproq')).toBeTruthy();
    expect(within(draft).getByText(/zweite Linie/)).toBeTruthy();
    expect(within(entry).getByRole('button', { name: 'plan.pdf · 20 KB' })).toBeTruthy();
    expect(within(entry).getByText('video.mp4 · über 25 MB, nicht gespeichert')).toBeTruthy();
  });

  it('der Text kommt erst beim Aufklappen; der Filter „Mails“ fragt nur Mails ab', async () => {
    const entry = await openMail();
    expect(within(entry).queryByText(/wir planen 2028/)).toBeNull();
    fireEvent.click(within(entry).getByRole('button', { name: 'Text anzeigen' }));
    expect(await within(entry).findByText(/wir planen 2028 eine zweite Linie/)).toBeTruthy();
    expect(within(entry).getByText('An: sara@hollmann.example')).toBeTruthy();
    const history = screen.getByRole('region', { name: 'Verlauf · nur euer Team' });
    fireEvent.click(within(history).getByRole('button', { name: 'Mails' }));
    await waitFor(() =>
      expect(sent.some((request) => request.url.endsWith('/aktivitaeten?filter=mails'))).toBe(true),
    );
  });

  it('eigene Mail löschen nach Bestätigung auf der Seite', async () => {
    const entry = await openMail();
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

describe('IN-04 Weitergeleitete Mail in Kurz prüfen (K1-e.3)', () => {
  it('zeigt den Absender ohne Termintyp und legt beim gewählten Lieferanten ab', async () => {
    const stack: ReviewStack = {
      items: [
        {
          id: uuid(10),
          source: 'inbound',
          kind: 'inbound',
          objectType: 'inbound_item',
          subject: 'Messe Hannover',
          counterpart: null,
          relationshipId: null,
          title: 'Mail zuordnen: Messe Hannover',
          lines: [],
          sources: [],
          createdAt: '2026-11-23T08:00:00Z',
          reviewSeconds: 20,
          adjust: 'place',
          text: null,
          href: '/kurz-pruefen',
          canAccept: true,
          inbound: {
            kind: 'mail',
            from: 'info@unbekannt.example',
            startsAt: '2026-11-22T15:00:00Z',
            suggestionKind: 'none',
            suggestions: [],
            suggestedType: 'other',
            reason:
              'Absender und Empfänger von unbekannt.example sind noch keinem Lieferanten zugeordnet.',
            options: [{ relationshipId: rel, name: 'Rheintal Elektronik' }],
          },
        },
      ],
      minutes: 1,
    };
    api.handle = (request) => {
      if (/^\/api\/kurz-pruefen(\?|$)/.test(request.url)) return Response.json(stack);
      if (request.method === 'POST' && request.url.startsWith('/api/kurz-pruefen/')) {
        sent.push(request);
        return Response.json({ state: 'accepted' });
      }
      return undefined;
    };
    renderAt('/kurz-pruefen');
    expect(await screen.findByText('Mail von info@unbekannt.example')).toBeTruthy();
    expect(screen.getByText(/Postfach · Mail zuordnen/)).toBeTruthy();
    expect(screen.queryByText(/Termin am/)).toBeNull();
    const select = screen.getByLabelText('Ablegen bei') as HTMLSelectElement;
    // Eine Mail gehört zu genau einem Lieferanten, nie zu einem Ereignis
    expect([...select.options].map((option) => option.value)).toEqual(['', rel]);
    fireEvent.change(select, { target: { value: rel } });
    fireEvent.click(screen.getByRole('button', { name: 'Ablegen' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        url: `/api/kurz-pruefen/${uuid(10)}`,
        body: { decision: 'uebernehmen', relationshipIds: [rel] },
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
        to: ['sara@hollmann.example'],
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
          href: `/beziehungen/${rel}?sicht=privat#mail-${mailId}`,
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
      `/beziehungen/${rel}?sicht=privat#mail-${mailId}`,
    );
  });
});
