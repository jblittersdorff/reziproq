import type { Page } from '@playwright/test';

// HE-01 (K1-e): Antworten von /api/heute und /api/heute/alles mit den Texten der Vorlagen Main und
// Heute-Alles, soweit es die Arten schon gibt. Die Zahlen sind Testdaten.

export const rheintal = '550e8400-e29b-41d4-a716-446655440010';
const nordwerk = '550e8400-e29b-41d4-a716-446655440011';
const silesia = '550e8400-e29b-41d4-a716-446655440012';
const baltic = '550e8400-e29b-41d4-a716-446655440013';
const alpen = '550e8400-e29b-41d4-a716-446655440014';
const id = (n: number) => `550e8400-e29b-41d4-a716-4466554405${String(n).padStart(2, '0')}`;

export const day = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const at = (offset: number, time: string) => new Date(`${day(offset)}T${time}:00`).toISOString();

const item = (
  n: number,
  kind: string,
  supplier: string,
  detail: string | null,
  offset: number,
) => ({
  id: id(n),
  kind,
  supplier,
  detail,
  dueDate: day(offset),
  href: `/lieferanten/${rheintal}/plan`,
});

const topic = (
  n: number,
  fields: {
    title: string;
    kind: string;
    art: string;
    counterpart: string;
    relationshipId: string;
    sentence: string;
    dueOffset?: number;
    item?: ReturnType<typeof item>;
    objectType?: string;
    severity?: 'high' | 'medium' | 'low';
    materialGroup?: string;
    score: number;
  },
) => ({
  id: id(n),
  level: 'focus',
  kind: fields.kind,
  title: fields.title,
  sentence: fields.sentence,
  facts: [],
  objectType: fields.objectType ?? fields.item?.kind ?? 'action',
  objectId: id(n + 50),
  relationshipId: fields.relationshipId,
  counterpart: fields.counterpart,
  dueDate: fields.dueOffset === undefined ? null : day(fields.dueOffset),
  href: `/lieferanten/${fields.relationshipId}/plan`,
  score: fields.score,
  item: fields.item ?? null,
  art: fields.art,
  severity: fields.severity ?? null,
  materialGroup: fields.materialGroup ?? null,
});

const topics = [
  topic(1, {
    title: 'Preis Leiterplatten',
    kind: 'approval',
    art: 'wert',
    counterpart: 'Rheintal Elektronik',
    relationshipId: rheintal,
    sentence: 'Controlling wartet seit Freitag.',
    dueOffset: 0,
    item: item(1, 'validation', 'Rheintal Elektronik', 'Preis Leiterplatten', 0),
    materialGroup: 'Leiterplatten',
    score: 1200,
  }),
  topic(2, {
    title: 'Erwähnung von Nils Ott',
    kind: 'conversation',
    art: 'gespraech',
    counterpart: 'Rheintal Elektronik',
    relationshipId: rheintal,
    sentence: 'Seit 5 Tagen überfällig.',
    dueOffset: -5,
    item: item(2, 'mention', 'Rheintal Elektronik', 'Nils Ott', -5),
    materialGroup: 'Leiterplatten',
    score: 800,
  }),
  topic(3, {
    title: 'Scorecard 2027',
    kind: 'approval',
    art: 'unterschrift',
    counterpart: 'Nordwerk Guss',
    relationshipId: nordwerk,
    sentence: 'Morgen fällig.',
    dueOffset: 1,
    item: item(3, 'signature', 'Nordwerk Guss', null, 1),
    materialGroup: 'Guss',
    score: 600,
  }),
  topic(4, {
    title: 'Silesia Guss: Liefertreue drei Monate unter Ziel',
    kind: 'decision',
    art: 'hinweis',
    counterpart: 'Silesia Guss',
    relationshipId: silesia,
    sentence: 'Hinweis mit Schwere hoch.',
    objectType: 'hint',
    severity: 'high',
    materialGroup: 'Guss',
    score: 300,
  }),
  topic(5, {
    title: 'Bewertungsrunde 2027',
    kind: 'decision',
    art: 'bewertung',
    counterpart: 'Baltic Logistics',
    relationshipId: baltic,
    sentence: 'Fällig in 3 Tagen.',
    dueOffset: 3,
    item: item(5, 'rating', 'Baltic Logistics', 'Bewertungsrunde 2027', 3),
    materialGroup: 'Logistik',
    score: 200,
  }),
  topic(6, {
    title: 'Gemeinsamer Plan',
    kind: 'decision',
    art: 'aufgabe',
    counterpart: 'Alpen Kunststofftechnik',
    relationshipId: alpen,
    sentence: 'Fällig in 18 Tagen.',
    dueOffset: 18,
    item: item(6, 'contribution', 'Alpen Kunststofftechnik', 'Gemeinsamer Plan', 18),
    materialGroup: 'Kunststoff',
    score: 100,
  }),
];

const drafts = [
  ['Liefertreue Oktober: 94 % übernehmen', 'Rheintal Elektronik', '06:02'],
  ['Briefing JBP: 3 Ziele, Agenda mit 7 Punkten', 'Rheintal Elektronik', '06:10'],
  ['Zwei Themen unserer Seite fürs JBP', 'Rheintal Elektronik', '06:12'],
  ['Zusage zur Lücke Transparenz', 'Alpen Kunststofftechnik', '05:45'],
  ['6 Zuordnungen bestätigen', null, '05:30'],
].map(([title, counterpart, time], index) => ({
  id: id(20 + index),
  title,
  counterpart,
  relationshipId: counterpart === 'Alpen Kunststofftechnik' ? alpen : counterpart ? rheintal : null,
  createdAt: at(0, time ?? '06:00'),
  href: `/lieferanten/${rheintal}/umsetzung/termine/${id(40)}`,
}));

const waiting = [
  {
    id: `commitment:${id(30)}`,
    kind: 'commitment',
    title: '8D-Bericht Charge 4711',
    owner: 'Nils Ott',
    counterpart: 'Rheintal Elektronik',
    dueDate: day(-5),
    href: `/lieferanten/${rheintal}/plan/zusagen#${id(30)}`,
  },
  {
    id: `commitment:${id(31)}`,
    kind: 'commitment',
    title: 'Liefertreue-Bericht Oktober',
    owner: 'Kim Kaiser',
    counterpart: 'Rheintal Elektronik',
    dueDate: day(-21),
    href: `/lieferanten/${rheintal}/plan/zusagen#${id(31)}`,
  },
  {
    id: `contribution:${id(32)}`,
    kind: 'contribution',
    title: 'Beitrag Machbarkeit Lieferzeit',
    owner: 'Tom Weber',
    counterpart: 'Rheintal Elektronik',
    dueDate: day(2),
    href: `/lieferanten/${rheintal}/strategie/lieferantenplan`,
  },
  {
    id: `commitment:${id(33)}`,
    kind: 'commitment',
    title: 'Musterteile bis 15.12.',
    owner: 'Rheintal Elektronik',
    counterpart: 'Rheintal Elektronik',
    dueDate: day(20),
    href: `/lieferanten/${rheintal}/plan/zusagen#${id(33)}`,
  },
];

const plainTopic = (entry: (typeof topics)[number]) => entry;

export const todayPage = () => ({
  today: day(0),
  next: plainTopic(topics[0] as (typeof topics)[number]),
  more: topics.slice(1, 3),
  openFocus: 6,
  review: { count: 5, minutes: 6 },
  done: {
    since: at(-1, '18:00'),
    count: 19,
    tasks: [
      { task: 'Postfach', count: 12 },
      { task: 'Zusagen nachhalten', count: 4 },
      { task: 'Frühwarnung', count: 3 },
    ],
  },
  background: null,
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
    sources: ['freigaben', 'kommentare', 'entwuerfe', 'erledigt'],
  },
  drafts,
  week: [
    { turn: 'own', date: day(3), topic: topics[4] },
    { turn: 'counterpart', date: day(2), waiting: waiting[2] },
  ].sort((a, b) => a.date.localeCompare(b.date)),
  waiting: [waiting[0], waiting[1]],
  waitingTotal: 4,
  counts: { forYou: 6, others: 4, hints: 4, commitments: 6 },
});

const hint = (
  n: number,
  title: string,
  supplier: string,
  ruleKey: string,
  severity: 'high' | 'medium' | 'low',
  materialGroup: string,
  since: number,
) => ({
  id: id(n),
  title,
  ruleKey,
  supplier,
  relationshipId: id(n + 10),
  severity,
  materialGroup,
  openSince: at(since, '06:00'),
  suggestedAction: null,
  href: `/hinweise/${id(n)}`,
});

export const todayAll = () => ({
  today: day(0),
  forYou: topics.map((entry, index) => ({ ...entry, rank: index + 1, snoozed: false })),
  drafts: { rows: drafts, minutes: 6 },
  others: waiting.map((entry, index) => ({
    ...entry,
    relationshipId: rheintal,
    materialGroup: 'Leiterplatten',
    inFocus: index === 0,
  })),
  hints: [
    hint(
      60,
      'Pearl River: 72 % der Elektronik ohne Zweitlieferant',
      'Pearl River',
      'dependency',
      'high',
      'Elektronik',
      -12,
    ),
    hint(
      61,
      'Rheintal: Lieferantenplan fehlt, JBP in 12 Tagen',
      'Rheintal Elektronik',
      'plan_missing',
      'medium',
      'Leiterplatten',
      -3,
    ),
    hint(
      62,
      'Lombardia Fonderie: Kurzarbeit im Werk Brescia',
      'Lombardia Fonderie',
      'public_event',
      'medium',
      'Guss',
      -2,
    ),
    hint(
      63,
      'Moravia Plast: seit 12 Monaten kein Feedback',
      'Moravia Plast',
      'no_feedback',
      'low',
      'Kunststoff',
      -40,
    ),
  ],
  assign: [
    {
      id: id(70),
      kind: 'meeting',
      subject: 'Abstimmung Musterteile Starrflex',
      startsAt: at(16, '10:00'),
      suggestionKind: 'supplier',
      suggestions: [{ relationshipId: rheintal, name: 'Rheintal Elektronik' }],
      href: '/mein-tag/eingang',
      inReview: false,
    },
    {
      id: id(71),
      kind: 'meeting',
      subject: 'Call Guss Q1',
      startsAt: at(17, '14:00'),
      suggestionKind: 'several',
      suggestions: [
        { relationshipId: silesia, name: 'Silesia Guss' },
        { relationshipId: id(72), name: 'Lombardia Fonderie' },
      ],
      href: '/mein-tag/eingang',
      inReview: false,
    },
    {
      id: id(73),
      kind: 'meeting',
      subject: 'Lieferantentag 2027',
      startsAt: at(60, '09:00'),
      suggestionKind: 'event',
      suggestions: [],
      href: '/mein-tag/eingang',
      inReview: false,
    },
  ],
  commitments: {
    open: 6,
    relationships: 4,
    next: { title: 'Transparenzbericht', counterpart: 'Alpen Kunststofftechnik', dueDate: day(45) },
  },
  doneCount: 19,
  relationships: [
    { id: alpen, name: 'Alpen Kunststofftechnik' },
    { id: baltic, name: 'Baltic Logistics' },
    { id: nordwerk, name: 'Nordwerk Guss' },
    { id: rheintal, name: 'Rheintal Elektronik' },
    { id: silesia, name: 'Silesia Guss' },
  ],
  materialGroups: ['Elektronik', 'Guss', 'Kunststoff', 'Leiterplatten', 'Logistik'],
});

/** Heute und die Ansicht Alles aus den Vorlagen */
export async function mockToday(page: Page) {
  await page.route('**/api/heute', (route) => route.fulfill({ json: todayPage() }));
  await page.route('**/api/heute/alles', (route) => route.fulfill({ json: todayAll() }));
}

/** Kurz prüfen mit den fünf Entwürfen der Vorlage K1-Kurz-Pruefen (Kontext, Text, Quellen) */
export const reviewStack = () => ({
  items: [
    {
      kind: 'capture_action',
      objectType: 'meeting',
      subject: 'Scorecard 2026',
      title: 'Liefertreue Oktober: 94 % übernehmen',
      lines: [
        'Rheintal hat am 20.11. 94 % gemeldet.',
        'Euer Wareneingang zeigt 95 % (61 von 64 Lieferungen pünktlich).',
        'Reziproq trägt Rheintals Wert ein und vermerkt die Abweichung von einem Punkt.',
      ],
      sources: ['Meldung Rheintal 20.11.', 'Wareneingang Oktober', 'Scorecard 2026'],
      adjust: 'title',
      text: 'Liefertreue Oktober: 94 % übernehmen',
      time: '06:02',
    },
    {
      kind: 'brief_goals',
      objectType: 'meeting',
      subject: 'JBP am 04.12.',
      title: 'Briefing JBP: 3 Ziele, Agenda mit 7 Punkten',
      lines: [
        'Ziele: Prognose gegen Preis als Thema, Musterteile LP-7 bis 15.12., Liefertreue mindestens 95 %.',
        'Agenda: Rückblick, Kennzahlen, Themen beider Seiten, Prognose, Muster, Kapazität 2027, nächste Schritte.',
      ],
      sources: ['Gemeinsamer Plan', 'Zusagen', 'Scorecard'],
      adjust: 'place',
      text: null,
      time: '06:10',
    },
    {
      kind: 'qbr_topics',
      objectType: 'meeting',
      subject: 'Gemeinsamer Plan',
      title: 'Zwei Themen unserer Seite fürs JBP',
      lines: [
        '1. Kapazität für Automotive 2027 sichern.',
        '2. Spezifikationsänderungen künftig vier Wochen vorher ankündigen.',
      ],
      sources: ['Gesprächsnotiz 19.11.', 'Feedback Q3'],
      adjust: 'place',
      text: null,
      time: '06:12',
    },
    {
      kind: 'feedback_themes',
      objectType: 'survey_wave',
      subject: null,
      title: 'Zusage zur Lücke Transparenz',
      lines: [
        'Alpen schickt ab Januar monatlich einen Bericht zu Lieferzeiten.',
        'Verantwortlich: Alpen. Prüfung durch euch im QBR März.',
      ],
      sources: ['Feedback-Welle Herbst', 'Spielregeln Alpen'],
      adjust: 'text',
      text: 'Alpen schickt ab Januar monatlich einen Bericht zu Lieferzeiten.',
      time: '05:45',
    },
  ]
    .map((entry, index) => ({
      id: id(80 + index),
      source: 'ai_draft',
      kind: entry.kind,
      objectType: entry.objectType,
      subject: entry.subject,
      counterpart:
        entry.kind === 'feedback_themes' ? 'Alpen Kunststofftechnik' : 'Rheintal Elektronik',
      relationshipId: entry.kind === 'feedback_themes' ? alpen : rheintal,
      title: entry.title,
      lines: entry.lines,
      sources: entry.sources,
      createdAt: at(0, entry.time),
      reviewSeconds: 75,
      adjust: entry.adjust,
      text: entry.text,
      href: `/lieferanten/${rheintal}/umsetzung/termine/${id(40)}`,
      canAccept: true,
      inbound: null,
    }))
    .concat([
      {
        id: id(85),
        source: 'inbound',
        kind: 'inbound',
        objectType: 'inbound_item',
        subject: 'Abstimmung Musterteile Starrflex',
        counterpart: 'Rheintal Elektronik',
        relationshipId: rheintal,
        title: 'Termin zuordnen: Abstimmung Musterteile Starrflex',
        lines: [],
        sources: [],
        createdAt: at(0, '05:30'),
        reviewSeconds: 20,
        adjust: 'place',
        text: null,
        href: '/mein-tag/eingang',
        canAccept: true,
        inbound: {
          kind: 'meeting',
          from: null,
          startsAt: at(16, '10:00'),
          suggestionKind: 'supplier',
          suggestions: [{ relationshipId: rheintal, name: 'Rheintal Elektronik' }],
          suggestedType: 'site_visit',
          reason: 'Teilnehmer von rheintal.example',
          options: [
            { relationshipId: rheintal, name: 'Rheintal Elektronik' },
            { relationshipId: silesia, name: 'Silesia Guss' },
          ],
        },
      } as never,
    ]),
  minutes: 6,
});

/** Kurz prüfen: Stapel und Entscheidungen; jede Entscheidung gelingt */
export async function mockReview(page: Page) {
  await page.route(/\/api\/kurz-pruefen(\?.*)?$/, (route) =>
    route.fulfill({ json: reviewStack() }),
  );
  await page.route('**/api/kurz-pruefen/*', (route) => {
    const decision = route.request().postDataJSON()?.decision;
    return route.fulfill({
      json: {
        state:
          decision === 'uebernehmen'
            ? 'accepted'
            : decision === 'spaeter'
              ? 'snoozed'
              : 'discarded',
      },
    });
  });
}

/** Erledigt mit Zeilen nach der Vorlage Erledigt (Zuordnungen, Briefing, Fehler) */
export const doneList = () => {
  const row = (
    n: number,
    fields: {
      at: string;
      task: string;
      taskName: string;
      action: 'inbound_assign' | 'prepared' | 'run';
      subject: string | null;
      counterpart: string | null;
      status?: 'done' | 'failed' | 'undone';
      openDrafts?: number;
      href?: string | null;
      blocker?: 'geaendert' | 'abgelaufen' | 'zurueckgenommen' | 'ohne' | null;
    },
  ) => ({
    id: id(90 + n),
    at: fields.at,
    task: fields.task,
    taskName: fields.taskName,
    status: fields.status ?? 'done',
    action: fields.action,
    subject: fields.subject,
    counterpart: fields.counterpart,
    href:
      fields.href === undefined
        ? `/lieferanten/${rheintal}/umsetzung/termine/${id(40)}`
        : fields.href,
    openDrafts: fields.openDrafts ?? 0,
    undo: {
      possible: fields.action === 'inbound_assign' && !fields.blocker,
      blocker: fields.blocker ?? (fields.action === 'inbound_assign' ? null : 'ohne'),
    },
  });
  return {
    since: at(-1, '18:00'),
    recent: 5,
    rows: [
      row(1, {
        at: at(0, '07:42'),
        task: 'inbox',
        taskName: 'Postfach',
        action: 'inbound_assign',
        subject: 'Abstimmung Musterteile Starrflex',
        counterpart: 'Rheintal Elektronik',
      }),
      row(2, {
        at: at(0, '07:12'),
        task: 'inbox',
        taskName: 'Postfach',
        action: 'inbound_assign',
        subject: 'Kapazitätsplanung 2028',
        counterpart: 'Rheintal Elektronik',
        blocker: 'geaendert',
      }),
      row(3, {
        at: at(0, '06:58'),
        task: 'inbox',
        taskName: 'Postfach',
        action: 'inbound_assign',
        subject: 'QBR Nordwerk',
        counterpart: 'Nordwerk Guss',
      }),
      row(4, {
        at: at(0, '06:10'),
        task: 'meeting_brief',
        taskName: 'Termin-Briefing',
        action: 'prepared',
        subject: 'JBP Rheintal Elektronik',
        counterpart: 'Rheintal Elektronik',
        openDrafts: 3,
        href: '/kurz-pruefen',
      }),
      row(5, {
        at: at(-1, '18:20'),
        task: 'meeting_brief',
        taskName: 'Termin-Briefing',
        action: 'run',
        status: 'failed',
        subject: 'QBR Silesia Guss',
        counterpart: 'Silesia Guss',
        href: null,
      }),
    ],
    tasks: [
      { key: 'inbox', level: 'do' },
      { key: 'commitment_followup', level: 'do' },
      { key: 'meeting_brief', level: 'prepare' },
      { key: 'meeting_capture', level: 'prepare' },
      { key: 'import_assign', level: 'prepare' },
      { key: 'early_warning', level: 'suggest' },
    ],
  };
};

export async function mockDone(page: Page) {
  await page.route('**/api/erledigt', (route) => route.fulfill({ json: doneList() }));
  await page.route('**/api/erledigt/*/zuruecknehmen', (route) =>
    route.fulfill({ json: { state: 'undone' } }),
  );
}

/** Fokus-Mappe und Warum zum ersten Fokus-Thema (Wirkung freigeben · Preis Leiterplatten) */
export async function mockMapAndWhy(page: Page) {
  const first = topics[0] as (typeof topics)[number];
  const withFacts = {
    ...first,
    sentence: 'Heute fällig.',
    facts: [],
  };
  await page.route(`**/api/mappe/${first.id}`, (route) =>
    route.fulfill({
      json: {
        topic: withFacts,
        state: 'open',
        since: at(-2, '06:00'),
        rank: 1,
        hintId: null,
        recommendation: null,
        sources: [{ title: 'Frist', href: null }],
      },
    }),
  );
  await page.route(`**/api/warum/${first.id}`, (route) =>
    route.fulfill({
      json: { kind: 'topic', topic: withFacts, rank: 1, sources: [{ title: 'Frist', href: null }] },
    }),
  );
}
