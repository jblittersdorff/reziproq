// @vitest-environment jsdom
import type { ReviewItem, ReviewStack } from '@reziproq/shared';
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

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

// HE-01 Kurz prüfen (K1-e.2, Vorlagen K1-Kurz-Pruefen und K1-Kurz-Pruefen-Mobil): ein Entwurf nach
// dem anderen; Übernehmen (Enter), Anpassen, Verwerfen mit Grund (V), Später; am Ende die Bilanz.
// Inventar T1-I10 (Zuordnung als Entwurf) und T1-I14 (Entwürfe der QBR-Vorbereitung).

const uuid = (n: number) => `550e8400-e29b-41d4-a716-4466554402${String(n).padStart(2, '0')}`;
const rheintal = uuid(90);

const item = (n: number, overrides: Partial<ReviewItem> = {}): ReviewItem => ({
  id: uuid(n),
  source: 'ai_draft',
  kind: 'plan_summary',
  objectType: 'supplier_plan',
  subject: null,
  counterpart: 'Rheintal Elektronik',
  relationshipId: rheintal,
  title: `Entwurf ${n}`,
  lines: [`Aussage ${n}`],
  sources: ['Gemeinsamer Plan'],
  createdAt: new Date().toISOString(),
  reviewSeconds: 60,
  adjust: 'text',
  text: `Text ${n}`,
  href: `/lieferanten/${rheintal}/strategie/lieferantenplan`,
  canAccept: true,
  inbound: null,
  ...overrides,
});

const stack = (): ReviewStack => ({
  items: [
    item(1, {
      kind: 'brief_goals',
      objectType: 'meeting',
      subject: 'JBP Rheintal',
      title: 'Briefing JBP: 3 Ziele',
      lines: ['Prognose gegen Preis als Thema', 'Musterteile LP-7 bis 15.12.'],
      sources: ['Gemeinsamer Plan', 'Zusagen', 'Scorecard'],
      adjust: 'place',
      text: null,
      href: `/lieferanten/${rheintal}/umsetzung/termine/${uuid(80)}`,
    }),
    item(2, { kind: 'qbr_topics', title: 'Zwei Themen fürs QBR', adjust: 'place', text: null }),
    item(3, {
      source: 'inbound',
      kind: 'inbound',
      objectType: 'inbound_item',
      title: 'Termin zuordnen: Abstimmung Musterteile Starrflex',
      lines: [],
      sources: [],
      adjust: 'place',
      text: null,
      href: '/mein-tag/eingang',
      inbound: {
        kind: 'meeting',
        from: null,
        startsAt: '2026-12-09T09:00:00.000Z',
        suggestionKind: 'supplier',
        suggestions: [{ relationshipId: rheintal, name: 'Rheintal Elektronik' }],
        suggestedType: 'site_visit',
        reason: 'Teilnehmer von rheintal.example',
        options: [
          { relationshipId: rheintal, name: 'Rheintal Elektronik' },
          { relationshipId: uuid(91), name: 'Silesia Guss' },
        ],
      },
    }),
    item(4),
  ],
  minutes: 5,
});

let decisions: { url: string; body: unknown }[];
let stackUrls: string[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  decisions = [];
  const current = stack();
  stackUrls = [];
  api.handle = (request) => {
    if (/^\/api\/kurz-pruefen(\?|$)/.test(request.url)) {
      stackUrls.push(request.url);
      return Response.json(current);
    }
    if (request.method === 'POST' && request.url.startsWith('/api/kurz-pruefen/')) {
      decisions.push({ url: request.url, body: request.body });
      const decision = (request.body as { decision: string }).decision;
      return Response.json({
        state:
          decision === 'uebernehmen'
            ? 'accepted'
            : decision === 'spaeter'
              ? 'snoozed'
              : 'discarded',
      });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const card = () => document.querySelector('[data-slot="ai-draft"]') as HTMLElement;

describe('HE-01 Kurz prüfen', () => {
  it('Kopf, Fortschritt und der erste Entwurf mit Kontext, Aussagen und Quellen', async () => {
    renderAt('/kurz-pruefen');
    expect(await screen.findByRole('heading', { level: 1, name: 'Kurz prüfen' })).toBeTruthy();
    expect(
      await screen.findByText('4 Entwürfe von Reziproq · ca. 5 Minuten · ein Klick je Entwurf'),
    ).toBeTruthy();
    // Zurück-Link im Inhalt (die Seitenleiste hat ebenfalls „Heute“)
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: 'Heute' }).getAttribute('href'),
    ).toBe('/heute');
    expect(screen.getByText('Entwurf 1 von 4')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Fortschritt' })).toBeTruthy();
    const draft = card();
    expect(within(draft).getByText(/^Entwurf von Reziproq · heute \d\d:\d\d$/)).toBeTruthy();
    expect(
      within(draft).getByText('Rheintal Elektronik · Briefing · Ziele · JBP Rheintal'),
    ).toBeTruthy();
    expect(within(draft).getByRole('heading', { name: 'Briefing JBP: 3 Ziele' })).toBeTruthy();
    expect(within(draft).getByText('Musterteile LP-7 bis 15.12.')).toBeTruthy();
    expect(within(draft).getByText('Scorecard')).toBeTruthy();
    // Ein Briefing passt man am Termin an
    expect(screen.getByRole('link', { name: 'Am Ort anpassen' }).getAttribute('href')).toBe(
      `/lieferanten/${rheintal}/umsetzung/termine/${uuid(80)}`,
    );
    // Rechts: was Übernehmen bewirkt, und was nie hierher kommt
    expect(screen.getByRole('region', { name: 'Was übernehmen bewirkt' })).toBeTruthy();
    expect(screen.getByText('Nie aus Kurz prüfen')).toBeTruthy();
  });

  it('Enter übernimmt und zeigt den nächsten Entwurf; T1-I14: Entwürfe der QBR-Vorbereitung stehen hier', async () => {
    renderAt('/kurz-pruefen');
    await screen.findByText('Entwurf 1 von 4');
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() =>
      expect(decisions).toEqual([
        { url: `/api/kurz-pruefen/${uuid(1)}`, body: { decision: 'uebernehmen' } },
      ]),
    );
    expect(await screen.findByText('Entwurf 2 von 4')).toBeTruthy();
    expect(
      within(card()).getByText('Rheintal Elektronik · QBR-Vorbereitung · Themen'),
    ).toBeTruthy();
  });

  it('V öffnet Verwerfen; ohne Grund geht es nicht, mit Grund schon', async () => {
    renderAt('/kurz-pruefen');
    await screen.findByText('Entwurf 1 von 4');
    fireEvent.keyDown(window, { key: 'v' });
    const field = await screen.findByLabelText('Warum passt der Entwurf nicht?');
    const submit = screen.getByRole('button', { name: 'Verwerfen' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(field, { target: { value: 'Ziele stimmen nicht' } });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() =>
      expect(decisions).toEqual([
        {
          url: `/api/kurz-pruefen/${uuid(1)}`,
          body: { decision: 'verwerfen', reason: 'Ziele stimmen nicht' },
        },
      ]),
    );
    expect(await screen.findByText('Entwurf 2 von 4')).toBeTruthy();
  });

  it('T1-I10: Eine Zuordnung zeigt Termin, Vorschlag und Begründung; Später stellt sie zurück', async () => {
    renderAt(`/kurz-pruefen?entwurf=${uuid(3)}`);
    expect(await screen.findByText('Entwurf 1 von 4')).toBeTruthy();
    // MA-01 (K1-f): Der Stapel lädt den Eintrag mit, auch einen Vorschlag außerhalb des Stapels
    expect(stackUrls).toContain(`/api/kurz-pruefen?entwurf=${uuid(3)}`);
    const draft = card();
    expect(
      within(draft).getByRole('heading', { name: /Abstimmung Musterteile Starrflex/ }),
    ).toBeTruthy();
    expect(within(draft).getByText(/^Termin am Mi 09\.12\. 10:00$/)).toBeTruthy();
    expect(
      within(draft).getByText('Vorschlag: Rheintal Elektronik, Werksbesuch oder Audit'),
    ).toBeTruthy();
    expect(within(draft).getByText('Begründung: Teilnehmer von rheintal.example')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Später' }));
    await waitFor(() =>
      expect(decisions).toEqual([
        { url: `/api/kurz-pruefen/${uuid(3)}`, body: { decision: 'spaeter' } },
      ]),
    );
  });

  it('Anpassen: Text ändern und angepasst übernehmen; am Ende „Alles geprüft. x von y übernommen.“', async () => {
    renderAt(`/kurz-pruefen?entwurf=${uuid(4)}`);
    await screen.findByText('Entwurf 1 von 4');
    fireEvent.click(screen.getByRole('button', { name: 'Anpassen' }));
    const field = screen.getByLabelText('Text anpassen') as HTMLTextAreaElement;
    expect(field.value).toBe('Text 4');
    fireEvent.change(field, { target: { value: 'Angepasster Text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Angepasst übernehmen' }));
    await screen.findByText('Entwurf 2 von 4');
    // die übrigen drei: verwerfen, später, später
    fireEvent.keyDown(window, { key: 'v' });
    fireEvent.change(await screen.findByLabelText('Warum passt der Entwurf nicht?'), {
      target: { value: 'passt nicht' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
    await screen.findByText('Entwurf 3 von 4');
    fireEvent.click(screen.getByRole('button', { name: 'Später' }));
    await screen.findByText('Entwurf 4 von 4');
    fireEvent.click(screen.getByRole('button', { name: 'Später' }));
    expect(await screen.findByText('Alles geprüft. 1 von 4 übernommen.')).toBeTruthy();
    expect(screen.getByText('Fertig')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Zurück zu Heute' }).getAttribute('href')).toBe(
      '/heute',
    );
    expect(decisions[0]).toEqual({
      url: `/api/kurz-pruefen/${uuid(4)}`,
      body: { decision: 'uebernehmen', text: 'Angepasster Text' },
    });
  });

  it('Mehrere Vorschläge: die Wahl steht gleich offen; Zuordnen schickt die gewählte Beziehung, auch als Ereignis', async () => {
    const several = stack();
    const inbound = several.items[2];
    if (!inbound?.inbound) throw new Error('Fixture');
    inbound.inbound = {
      ...inbound.inbound,
      suggestionKind: 'several',
      suggestions: [
        { relationshipId: rheintal, name: 'Rheintal Elektronik' },
        { relationshipId: uuid(91), name: 'Silesia Guss' },
      ],
    };
    api.handle = (request) => {
      if (/^\/api\/kurz-pruefen(\?|$)/.test(request.url)) return Response.json(several);
      if (request.method === 'POST' && request.url.startsWith('/api/kurz-pruefen/')) {
        decisions.push({ url: request.url, body: request.body });
        return Response.json({ state: 'accepted' });
      }
      return undefined;
    };
    renderAt(`/kurz-pruefen?entwurf=${uuid(3)}`);
    const select = (await screen.findByLabelText('Zuordnen zu')) as HTMLSelectElement;
    const submit = screen.getByRole('button', { name: 'Zuordnen' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(select, { target: { value: uuid(91) } });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(decisions).toEqual([
        {
          url: `/api/kurz-pruefen/${uuid(3)}`,
          body: { decision: 'uebernehmen', relationshipIds: [uuid(91)] },
        },
      ]),
    );
    // der nächste Entwurf ist ein Briefing; danach kommt der Eingang nicht wieder
    expect(await screen.findByText('Entwurf 2 von 4')).toBeTruthy();
  });

  it('Ein klarer Vorschlag lässt sich über Anpassen ändern, etwa als Ereignis ohne Lieferant', async () => {
    renderAt(`/kurz-pruefen?entwurf=${uuid(3)}`);
    await screen.findByText('Entwurf 1 von 4');
    fireEvent.click(screen.getByRole('button', { name: 'Anpassen' }));
    fireEvent.change(screen.getByLabelText('Zuordnen zu'), { target: { value: 'event' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zuordnen' }));
    await waitFor(() =>
      expect(decisions).toEqual([
        { url: `/api/kurz-pruefen/${uuid(3)}`, body: { decision: 'uebernehmen', asEvent: true } },
      ]),
    );
  });

  it('Ohne Entwürfe: nichts zu prüfen, zurück zu Heute', async () => {
    api.handle = (request) =>
      /^\/api\/kurz-pruefen(\?|$)/.test(request.url)
        ? Response.json({ items: [], minutes: 0 })
        : undefined;
    renderAt('/kurz-pruefen');
    expect(await screen.findByRole('link', { name: /Nichts zu prüfen/ })).toBeTruthy();
  });
});
