// @vitest-environment jsdom
import type { AllTopic, FocusTopic, TodayAll, TodayPage } from '@reziproq/shared';
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
  todayAllResponse,
  todayResponse,
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

// HE-01 (K1-e.1): Heute mit den Ansichten Fokus und Alles (Vorlagen Main, A-MeinTag, Heute-Alles).
// T1-HE1, T1-HE5 und das Inventar Kapitel 1 (T1-I01 bis T1-I03, T1-I05, T1-I09, T1-I10, T1-I12,
// T1-I16) auf der Seite.

const uuid = (n: number) => `550e8400-e29b-41d4-a716-4466554401${String(n).padStart(2, '0')}`;
const rheintal = uuid(90);
const nordwerk = uuid(91);
const offset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const today = offset(0);

const topic = (n: number, overrides: Partial<FocusTopic> = {}): FocusTopic => ({
  id: uuid(n),
  level: 'focus',
  kind: 'approval',
  title: `Thema ${n}`,
  sentence: 'Wartet auf deine Freigabe.',
  facts: [],
  objectType: 'validation',
  objectId: uuid(n + 40),
  relationshipId: rheintal,
  counterpart: 'Rheintal Elektronik',
  dueDate: null,
  href: `/lieferanten/${rheintal}/wirkung/freigaben/${uuid(n + 40)}`,
  score: 400,
  item: null,
  art: 'freigabe',
  severity: null,
  materialGroup: 'Leiterplatten',
  ...overrides,
});

const validation = topic(1, {
  title: 'Preis Leiterplatten',
  dueDate: offset(-2),
  item: {
    id: uuid(41),
    kind: 'validation',
    supplier: 'Rheintal Elektronik',
    detail: 'Preis Leiterplatten',
    dueDate: offset(-2),
    href: `/lieferanten/${rheintal}/wirkung/freigaben/${uuid(41)}`,
  },
  art: 'wert',
  sentence: 'Seit 2 Tagen überfällig.',
  facts: [
    {
      key: 'overdue_days',
      value: 2,
      unit: 'd',
      source: { objectType: 'validation', label: 'Frist' },
    },
  ],
});
const signature = topic(2, {
  title: 'Scorecard 2027',
  kind: 'approval',
  relationshipId: nordwerk,
  counterpart: 'Nordwerk Guss',
  dueDate: offset(1),
  item: {
    id: uuid(42),
    kind: 'signature',
    supplier: 'Nordwerk Guss',
    detail: null,
    dueDate: offset(1),
    href: `/lieferanten/${nordwerk}/plan/scorecard`,
  },
  href: `/lieferanten/${nordwerk}/plan/scorecard`,
  art: 'unterschrift',
  materialGroup: 'Guss',
});
const hint = topic(3, {
  title: 'Liefertreue drei Monate unter Ziel',
  kind: 'decision',
  objectType: 'hint',
  art: 'hinweis',
  severity: 'high',
  href: `/hinweise/${uuid(43)}`,
  sentence: 'Hinweis mit Schwere hoch.',
});

function focusPage(overrides: Partial<TodayPage> = {}): TodayPage {
  return todayResponse({
    next: validation,
    more: [signature, hint],
    openFocus: 5,
    review: { count: 2, minutes: 3 },
    summary: {
      sentence: 'Reziproq hat seit gestern 19 Vorgänge erledigt. 2 weitere Themen brauchen dich.',
      facts: [
        {
          key: 'done_since_yesterday',
          value: 19,
          source: { objectType: 'focus_item', label: 'Erledigt' },
        },
        { key: 'more_topics', value: 2, source: { objectType: 'focus_item', label: 'Fokus' } },
      ],
      sources: ['freigaben', 'hinweise', 'entwuerfe'],
    },
    drafts: [
      {
        id: uuid(10),
        title: 'Liefertreue Oktober übernehmen',
        counterpart: 'Rheintal Elektronik',
        relationshipId: rheintal,
        createdAt: new Date(`${today}T06:02:00`).toISOString(),
        href: `/lieferanten/${rheintal}/plan/scorecard`,
      },
      {
        id: uuid(11),
        title: 'Briefing JBP Rheintal',
        counterpart: 'Rheintal Elektronik',
        relationshipId: rheintal,
        createdAt: new Date(`${today}T06:10:00`).toISOString(),
        href: `/lieferanten/${rheintal}/umsetzung/termine/${uuid(80)}`,
      },
    ],
    week: [
      {
        turn: 'own',
        date: offset(2),
        topic: topic(4, {
          title: 'Bewertung Baltic Logistics',
          dueDate: offset(2),
          art: 'bewertung',
        }),
      },
      {
        turn: 'counterpart',
        date: offset(3),
        waiting: {
          id: `contribution:${uuid(12)}`,
          kind: 'contribution',
          title: 'Beitrag Machbarkeit Lieferzeit',
          owner: 'Tom Weber',
          counterpart: 'Rheintal Elektronik',
          dueDate: offset(3),
          href: `/lieferanten/${rheintal}/strategie/lieferantenplan`,
        },
      },
    ],
    waiting: [
      {
        id: `commitment:${uuid(13)}`,
        kind: 'commitment',
        title: '8D-Bericht Charge 4711',
        owner: 'Nils Ott',
        counterpart: 'Rheintal Elektronik',
        dueDate: offset(-5),
        href: `/lieferanten/${rheintal}/plan/zusagen#${uuid(13)}`,
      },
    ],
    waitingTotal: 4,
    counts: { forYou: 9, others: 4, hints: 4, commitments: 6 },
    ...overrides,
  });
}

const ranked = (base: FocusTopic, rank: number, overrides: Partial<AllTopic> = {}): AllTopic => ({
  ...base,
  rank,
  snoozed: false,
  ...overrides,
});

function allView(overrides: Partial<TodayAll> = {}): TodayAll {
  return todayAllResponse({
    forYou: [
      ranked(validation, 1),
      ranked(signature, 2),
      ranked(hint, 3),
      ranked(
        topic(4, {
          title: 'Bewertung Baltic Logistics',
          dueDate: offset(2),
          art: 'bewertung',
          relationshipId: nordwerk,
          counterpart: 'Nordwerk Guss',
          materialGroup: 'Guss',
        }),
        4,
      ),
      ranked(topic(5, { title: 'Zusage Prognose Q1', dueDate: offset(-9), art: 'zusage' }), 5),
      ranked(
        topic(6, { title: 'Morgen wieder', dueDate: null, art: 'gespraech', kind: 'conversation' }),
        6,
        { snoozed: true },
      ),
    ],
    drafts: {
      rows: focusPage().drafts,
      minutes: 3,
    },
    others: [
      {
        id: `commitment:${uuid(13)}`,
        kind: 'commitment',
        title: '8D-Bericht Charge 4711',
        owner: 'Nils Ott',
        counterpart: 'Rheintal Elektronik',
        dueDate: offset(-5),
        href: `/lieferanten/${rheintal}/plan/zusagen#${uuid(13)}`,
        relationshipId: rheintal,
        materialGroup: 'Leiterplatten',
        inFocus: true,
      },
      {
        id: `action:${uuid(14)}`,
        kind: 'action',
        title: 'Musterteile bis 15.12.',
        owner: '',
        counterpart: 'Rheintal Elektronik',
        dueDate: offset(20),
        href: `/lieferanten/${rheintal}/umsetzung/massnahmen#${uuid(14)}`,
        relationshipId: rheintal,
        materialGroup: 'Leiterplatten',
        inFocus: false,
      },
    ],
    hints: [
      {
        id: uuid(20),
        title: '72 % der Elektronik ohne Zweitlieferant',
        ruleKey: 'dependency',
        supplier: 'Pearl River',
        relationshipId: uuid(92),
        severity: 'high',
        materialGroup: 'Elektronik',
        openSince: new Date(`${offset(-12)}T08:00:00Z`).toISOString(),
        suggestedAction: null,
        href: `/hinweise/${uuid(20)}`,
      },
      {
        id: uuid(21),
        title: 'Seit 12 Monaten kein Feedback',
        ruleKey: 'no_feedback',
        supplier: 'Moravia Plast',
        relationshipId: uuid(93),
        severity: 'low',
        materialGroup: 'Kunststoff',
        openSince: new Date(`${offset(-40)}T08:00:00Z`).toISOString(),
        suggestedAction: null,
        href: `/hinweise/${uuid(21)}`,
      },
    ],
    assign: [
      {
        id: uuid(30),
        kind: 'meeting',
        subject: 'Abstimmung Musterteile Starrflex',
        startsAt: new Date(`${offset(14)}T09:00:00`).toISOString(),
        suggestionKind: 'supplier',
        suggestions: [{ relationshipId: rheintal, name: 'Rheintal Elektronik' }],
        href: '/mein-tag/eingang',
      },
      {
        id: uuid(31),
        kind: 'meeting',
        subject: 'Lieferantentag 2027',
        startsAt: new Date(`${offset(60)}T09:00:00`).toISOString(),
        suggestionKind: 'event',
        suggestions: [],
        href: '/mein-tag/eingang',
      },
    ],
    commitments: {
      open: 6,
      relationships: 4,
      next: {
        title: 'Transparenzbericht',
        counterpart: 'Alpen Kunststofftechnik',
        dueDate: offset(30),
      },
    },
    doneCount: 19,
    relationships: [
      { id: nordwerk, name: 'Nordwerk Guss' },
      { id: rheintal, name: 'Rheintal Elektronik' },
    ],
    materialGroups: ['Elektronik', 'Guss', 'Kunststoff', 'Leiterplatten'],
    ...overrides,
  });
}

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  api.today = focusPage();
  api.todayAll = allView();
});

afterEach(tearDownApp);

describe('HE-01 Heute, Ansicht Fokus (Vorlage Main)', () => {
  it('Kopf: Titel, Datum mit Gruß und der Umschalter Fokus | Alles', async () => {
    renderAt('/heute');
    expect(await screen.findByRole('heading', { level: 1, name: 'Heute' })).toBeTruthy();
    expect(screen.getByText(/· Guten (Morgen|Tag|Abend), Anna\.$/)).toBeTruthy();
    const views = screen.getByRole('navigation', { name: 'Ansicht' });
    expect(within(views).getByRole('link', { name: 'Fokus' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(within(views).getByRole('link', { name: 'Alles' }).getAttribute('href')).toBe(
      '/heute?ansicht=alles',
    );
  });

  it('T1-HE1: genau eine Karte „Als Nächstes“ und zusammen höchstens drei Fokus-Themen; die Zahl an Heute gleicht den offenen', async () => {
    renderAt('/heute');
    const kicker = await screen.findByText('Als Nächstes · Fokus 1 von 3 · Rheintal Elektronik');
    const card = kicker.closest('[data-slot="next-card"]') as HTMLElement;
    expect(document.querySelectorAll('[data-slot="next-card"]')).toHaveLength(1);
    expect(
      within(card).getByRole('heading', { name: 'Wirkung freigeben · Preis Leiterplatten' }),
    ).toBeTruthy();
    const open = within(card).getByRole('link', { name: /öffnen/ });
    expect(open.getAttribute('href')).toBe(validation.href);
    expect(within(card).getByRole('button', { name: 'Morgen erinnern' })).toBeTruthy();
    // „Das Wichtigste“ zeigt die übrigen zwei, zusammen mit der Karte drei
    const important = screen.getByRole('region', { name: 'Das Wichtigste' });
    expect(within(important).getAllByRole('link')).toHaveLength(2);
    // Seitenleiste: Zahl an Heute = offene Fokus-Themen
    const nav = screen.getAllByRole('navigation', { name: 'Hauptnavigation' })[0] as HTMLElement;
    expect(within(nav).getByRole('link', { name: /Heute/ }).textContent).toContain('5');
  });

  it('„Morgen erinnern“ stellt das Thema zurück und lädt Heute neu', async () => {
    const posted: string[] = [];
    api.handle = (request) => {
      if (request.method === 'POST' && request.url.startsWith('/api/heute/')) {
        posted.push(request.url);
        api.today = focusPage({ next: signature, more: [hint], openFocus: 4 });
        return Response.json({ snoozedUntil: new Date().toISOString() });
      }
      return undefined;
    };
    renderAt('/heute');
    fireEvent.click(await screen.findByRole('button', { name: 'Morgen erinnern' }));
    await waitFor(() => expect(posted).toEqual([`/api/heute/${validation.id}/morgen`]));
    expect(await screen.findByText('Als Nächstes · Fokus 1 von 2 · Nordwerk Guss')).toBeTruthy();
  });

  it('„Das Wichtigste“: Zusammengefasst von Reziproq mit Quellen, belegtem Satz und Art je Thema', async () => {
    renderAt('/heute');
    const important = await screen.findByRole('region', { name: 'Das Wichtigste' });
    expect(within(important).getByText('Zusammengefasst von Reziproq')).toBeTruthy();
    for (const source of ['Freigaben', 'Hinweise', 'Entwürfe']) {
      expect(within(important).getByText(source)).toBeTruthy();
    }
    expect(
      within(important).getByText(
        'Reziproq hat seit gestern 19 Vorgänge erledigt. 2 weitere Themen brauchen dich.',
      ),
    ).toBeTruthy();
    const row = within(important).getByRole('link', { name: /Scorecard unterschreiben/ });
    expect(row.getAttribute('href')).toBe(signature.href);
    expect(within(row).getByText('Unterschrift')).toBeTruthy();
    expect(within(row).getByText('Nordwerk Guss · Unterschrift')).toBeTruthy();
    const hintRow = within(important).getByRole('link', { name: /Liefertreue drei Monate/ });
    expect(within(hintRow).getByText('Rheintal Elektronik · Hinweis hoch')).toBeTruthy();
  });

  it('Kurz prüfen: Zahl, Minuten und die Entwürfe als Zeilen mit Kennzeichnung', async () => {
    renderAt('/heute');
    const group = await screen.findByRole('region', {
      name: 'Kurz prüfen · 2 Entwürfe · ca. 3 Min.',
    });
    const rows = within(group).getAllByRole('link');
    expect(rows.map((row) => row.getAttribute('href'))).toEqual(
      focusPage().drafts.map((draft) => draft.href),
    );
    expect(within(rows[0] as HTMLElement).getByText('Entwurf')).toBeTruthy();
    expect(rows[0]?.querySelector('[data-slot="brand-mark"]')).toBeTruthy();
  });

  it('Erledigt im Hintergrund ist eine Zeile ohne Pfeil, bis die Seite Erledigt kommt', async () => {
    renderAt('/heute');
    const row = (await screen.findByText('Erledigt im Hintergrund · 0')).closest(
      '[data-slot="row"]',
    );
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain('Seit gestern 18:00 hat Reziproq nichts für dich erledigt.');
  });

  it('Rechts: „Diese Woche“ mit Datumskreis (Petrol, wenn andere am Zug sind), „Wartet auf andere“ und „Alles anzeigen“', async () => {
    renderAt('/heute');
    const week = await screen.findByRole('region', { name: 'Diese Woche' });
    const entries = within(week).getAllByRole('link');
    expect(entries).toHaveLength(2);
    const circles = week.querySelectorAll('[data-slot="date-circle"]');
    expect(circles[0]?.getAttribute('data-next')).toBe('true');
    expect(circles[1]?.className).toContain('bg-petrol');
    expect(entries[1]?.textContent).toContain('Tom Weber ist am Zug');
    const waiting = screen.getByRole('region', { name: 'Wartet auf andere · 4' });
    const row = within(waiting).getByRole('link', { name: /8D-Bericht Charge 4711/ });
    expect(row.textContent).toContain('Nils Ott, Rheintal Elektronik · seit 5 Tagen überfällig');
    const all = screen.getByRole('link', { name: /Alles anzeigen/ });
    expect(all.getAttribute('href')).toBe('/heute?ansicht=alles');
    expect(all.textContent).toContain(
      '9 für dich · 4 bei anderen · 4 weitere Hinweise · 6 offene Zusagen und Aufgaben',
    );
  });

  it('Leer: keine Karte, „Nichts braucht dich gerade.“ und die Zeile Erledigt', async () => {
    api.today = todayResponse();
    renderAt('/heute');
    expect(await screen.findByText('Nichts braucht dich gerade.')).toBeTruthy();
    expect(document.querySelector('[data-slot="next-card"]')).toBeNull();
    expect(screen.getByText('Erledigt im Hintergrund · 0')).toBeTruthy();
  });

  it('T1-I16: die Teile von Mein Tag stehen an ihrem neuen Ort', async () => {
    renderAt('/heute');
    await screen.findByRole('region', { name: 'Das Wichtigste' });
    // Fortschritt „n von m für heute erledigt“ entfällt; „Alle n Aufgaben“ wird „Alles anzeigen“.
    expect(screen.queryByText(/für heute erledigt/)).toBeNull();
    expect(screen.queryByText(/^Alle \d+ Aufgaben$/)).toBeNull();
    // „Von Reziproq vorbereitet“ wird Kurz prüfen, „Nächste 14 Tage“ entfällt auf Heute.
    expect(screen.queryByText(/Von Reziproq vorbereitet/)).toBeNull();
    expect(screen.queryByText('Termine und Fristen')).toBeNull();
    expect(screen.getByText(/^Kurz prüfen · 2 Entwürfe/)).toBeTruthy();
    // „Diese Woche“ höchstens drei, „Wartet auf andere“ rechts
    expect(screen.getByRole('region', { name: 'Diese Woche' })).toBeTruthy();
    expect(screen.getByRole('region', { name: /^Wartet auf andere/ })).toBeTruthy();
  });

  it('Auf dem Telefon führt die Person zu den Einstellungen', async () => {
    renderAt('/heute');
    await screen.findByRole('region', { name: 'Das Wichtigste' });
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: 'Einstellungen' }).getAttribute('href')).toBe(
      '/einstellungen',
    );
  });
});

describe('HE-01 Heute, Ansicht Alles (Vorlage Heute-Alles)', () => {
  const groupOf = (name: RegExp) => screen.getByRole('region', { name });

  it('T1-HE5, T1-I01: Gruppen Für dich, Entwürfe, Bei anderen, Hinweise, Zuordnen, Zusagen und Aufgaben', async () => {
    renderAt('/heute?ansicht=alles');
    expect(await screen.findByRole('region', { name: 'Für dich · 6' })).toBeTruthy();
    expect(groupOf(/^Entwürfe · 2$/)).toBeTruthy();
    expect(groupOf(/^Bei anderen · 2$/)).toBeTruthy();
    expect(groupOf(/^Hinweise · 2$/)).toBeTruthy();
    expect(groupOf(/^Zuordnen · 2$/)).toBeTruthy();
    const commitments = groupOf(/^Zusagen und Aufgaben · 6$/);
    const row = within(commitments).getByRole('link');
    expect(row.getAttribute('href')).toBe('/beziehungen');
    expect(row.textContent).toContain('6 offene Zusagen und Aufgaben bei 4 Beziehungen');
    expect(row.textContent).toContain('nächste Frist: Transparenzbericht, Alpen Kunststofftechnik');
    expect(
      within(screen.getByRole('navigation', { name: 'Ansicht' }))
        .getByRole('link', { name: 'Alles' })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(
      screen.getByText(
        'Alles, was offen ist. Reziproq sortiert nach Wirkung und Frist, nichts wird ausgeblendet.',
      ),
    ).toBeTruthy();
  });

  it('T1-I02, T1-I03: Platz nach Triage, Gegenüber und Art in der Zeile, Frist als Chip', async () => {
    renderAt('/heute?ansicht=alles');
    const group = await screen.findByRole('region', { name: 'Für dich · 6' });
    const rows = within(group).getAllByRole('link');
    expect(rows.map((row) => row.textContent?.match(/Platz (\d)/)?.[1])).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
    ]);
    expect(within(rows[0] as HTMLElement).getByText('Fokus')).toBeTruthy();
    expect(within(rows[3] as HTMLElement).getByText('rückt nach')).toBeTruthy();
    expect(within(rows[3] as HTMLElement).getByText('Nordwerk Guss · Bewertung')).toBeTruthy();
    expect(within(rows[4] as HTMLElement).getByText('überfällig')).toBeTruthy();
    expect(within(rows[5] as HTMLElement).getByText('morgen')).toBeTruthy();
  });

  it('T1-I02: Filter Frist zeigt nur Überfälliges; „Alle“ hebt ihn auf', async () => {
    renderAt('/heute?ansicht=alles');
    await screen.findByRole('region', { name: 'Für dich · 6' });
    fireEvent.click(screen.getByRole('button', { name: 'Frist' }));
    const options = screen.getByRole('group', { name: 'Auswahl Frist' });
    fireEvent.click(within(options).getByRole('button', { name: 'Überfällig' }));
    const group = await screen.findByRole('region', { name: 'Für dich · 2' });
    expect(
      within(group)
        .getAllByRole('link')
        .map((row) => row.textContent),
    ).toEqual([
      expect.stringContaining('Preis Leiterplatten'),
      expect.stringContaining('Zusage Prognose Q1'),
    ]);
    // Überfälliges bei anderen bleibt, Hinweise ohne Frist und Entwürfe nicht
    expect(within(groupOf(/^Bei anderen · 1$/)).getByText('8D-Bericht Charge 4711')).toBeTruthy();
    expect(screen.queryByRole('region', { name: /^Hinweise/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Frist: Überfällig' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
    expect(await screen.findByRole('region', { name: 'Für dich · 6' })).toBeTruthy();
  });

  it('T1-I03: Filter Art', async () => {
    renderAt('/heute?ansicht=alles&art=unterschrift');
    const group = await screen.findByRole('region', { name: 'Für dich · 1' });
    expect(within(group).getByRole('link').textContent).toContain('Scorecard unterschreiben');
  });

  it('Filter Beziehung', async () => {
    renderAt(`/heute?ansicht=alles&beziehung=${nordwerk}`);
    expect(await screen.findByRole('region', { name: 'Für dich · 2' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: /^Bei anderen/ })).toBeNull();
  });

  it('T1-I05: Hinweise mit Schwere, Regel, Warengruppe und „offen seit“', async () => {
    renderAt('/heute?ansicht=alles');
    const hints = await screen.findByRole('region', { name: 'Hinweise · 2' });
    const row = within(hints).getByRole('link', { name: /72 % der Elektronik/ });
    expect(row.getAttribute('href')).toBe(`/hinweise/${uuid(20)}`);
    expect(within(row).getByText('hoch')).toBeTruthy();
    expect(row.textContent).toContain('Pearl River · Abhängigkeit');
    expect(row.textContent).toContain('Elektronik · offen seit');
  });

  it('T1-I05: Filter Schwere', async () => {
    renderAt('/heute?ansicht=alles&schwere=low');
    const low = await screen.findByRole('region', { name: 'Hinweise · 1' });
    expect(within(low).getByText('Seit 12 Monaten kein Feedback')).toBeTruthy();
  });

  it('T1-I05: Filter Warengruppe', async () => {
    renderAt('/heute?ansicht=alles&warengruppe=Elektronik');
    const group = await screen.findByRole('region', { name: 'Hinweise · 1' });
    expect(within(group).getByText('72 % der Elektronik ohne Zweitlieferant')).toBeTruthy();
  });

  it('T1-I09: Fußzeile zur Regel der Hinweise', async () => {
    renderAt('/heute?ansicht=alles');
    expect(
      await screen.findByText(
        'Jeder Hinweis kommt aus einer festen Regel, Reziproq schreibt nur die Begründung. Verworfene Hinweise bleiben 90 Tage still, außer die Lage wird schlimmer.',
      ),
    ).toBeTruthy();
  });

  it('T1-I10: nicht zugeordnete Termine mit Vorschlag unter Zuordnen', async () => {
    renderAt('/heute?ansicht=alles');
    const assign = await screen.findByRole('region', { name: 'Zuordnen · 2' });
    expect(
      within(assign).getByRole('link', { name: /Abstimmung Musterteile Starrflex/ }).textContent,
    ).toContain('Vorschlag: Rheintal Elektronik');
    expect(within(assign).getByRole('link', { name: /Lieferantentag 2027/ }).textContent).toContain(
      'Vorschlag: Ereignis ohne Lieferant',
    );
  });

  it('T1-I12, Platz 4: rechts „Warum nicht im Fokus?“ und der Link „Wie Termine ankommen“', async () => {
    renderAt('/heute?ansicht=alles');
    expect(await screen.findByText('„Bewertung Baltic Logistics“ steht auf Platz 4.')).toBeTruthy();
    const more = screen.getByRole('region', { name: 'Was sonst noch hierher gehört' });
    expect(
      within(more)
        .getByRole('link', { name: /Wie Termine ankommen/ })
        .getAttribute('href'),
    ).toBe('/einstellungen/anbindungen');
    expect(within(more).getByText('19 seit gestern 18:00')).toBeTruthy();
  });

  it('Ein Filter ohne Treffer sagt es, statt leere Gruppen zu zeigen', async () => {
    renderAt(`/heute?ansicht=alles&schwere=medium&frist=heute`);
    expect(await screen.findByText('Nichts passt zu diesem Filter.')).toBeTruthy();
  });
});
