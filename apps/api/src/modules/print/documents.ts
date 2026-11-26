import { currentTime } from '@reziproq/db';
import type {
  Commitments,
  Initiatives,
  JbpTopics,
  ScorecardView,
  SupplierPlan,
  SurveyWaveDetail,
} from '@reziproq/shared';
import { printDocument } from './print-document.js';
import {
  cover,
  footer,
  footerText,
  type PrintLocale,
  paragraph,
  printDate,
  printDateTime,
  privateSection,
  rows,
  section,
} from './print-parts.js';

// QS-03: PDFs für Lieferantenplan, Gemeinsamen Plan und Feedback-Ergebnis. Der Inhalt kommt aus
// denselben Antworten wie die Seiten der erzeugenden Seite; was RLS dort weglässt, fehlt hier auch.

const copy = {
  de: {
    none: 'Keine Einträge.',
    internal: 'Intern',
    sides: { buyer: 'Käufer', supplier: 'Lieferant' },
    plan: {
      eyebrow: 'Lieferantenplan',
      version: (n: number) => `Version ${n}`,
      title: 'Lieferantenplan',
      internalTitle: 'Nur für eure Seite',
      internalText: 'Der Lieferantenplan ist intern. Der Lieferant sieht ihn nie.',
      summary: 'Zusammenfassung',
      objectives: 'Ziele',
      topics: 'Strategische Themen',
      contributions: (done: number, total: number) => `${done} von ${total} Beiträgen geliefert`,
      target: (type: string) => `Soll-Typ ${type}`,
      sro: (name: string) => `SRO ${name}`,
      year: (year: number) => `Ziel ${year}`,
      statuses: {
        draft: 'Entwurf',
        in_review: 'In Freigabe',
        approved: 'Freigegeben',
        superseded: 'Abgelöst',
      } as Record<string, string>,
    },
    jbp: {
      eyebrow: 'Gemeinsamer Plan',
      title: 'Gemeinsamer Plan',
      topics: 'Themen',
      initiatives: 'Initiativen',
      commitments: 'Zusagen',
      scorecard: 'Scorecard',
      noPlan: 'Noch kein Gemeinsamer Plan.',
      period: (from: string, to: string) => `${from} bis ${to}`,
      due: (date: string) => `fällig ${date}`,
      target: (value: string, unit: string, date: string) => `Ziel ${value} ${unit} bis ${date}`,
      last: (value: string, unit: string) => `Ist ${value} ${unit}`,
      scorecardStatus: (version: number, signed: boolean) =>
        `Version ${version} · ${signed ? 'unterschrieben' : 'Entwurf'}`,
      topicStatuses: {
        proposed: 'Vorgeschlagen',
        merged: 'Zusammengeführt',
        parked: 'Geparkt',
      } as Record<string, string>,
      initiativeStatuses: {
        planned: 'Geplant',
        running: 'Läuft',
        done: 'Erledigt',
        stopped: 'Gestoppt',
      } as Record<string, string>,
      commitmentStatuses: {
        open: 'Offen',
        kept: 'Gehalten',
        missed: 'Nicht gehalten',
        replaced: 'Ersetzt',
        withdrawn: 'Zurückgezogen',
      } as Record<string, string>,
      tracks: { on_track: 'Auf Kurs', close: 'Knapp', off: 'Nicht auf Kurs' } as Record<
        string,
        string
      >,
      noValue: 'Noch kein Wert',
    },
    feedback: {
      eyebrow: 'Feedback-Ergebnis',
      kinds: { annual: 'Jahres-Feedback', pulse: 'Puls' } as Record<string, string>,
      due: (date: string) => `Frist ${date}`,
      responses: (buyer: number, supplier: number) =>
        `Antworten: Käufer ${buyer}, Lieferant ${supplier}`,
      notRevealed: 'Das Ergebnis ist noch nicht aufgedeckt.',
      dimensions: 'Ergebnis je Dimension',
      gaps: 'Größte Lücken',
      freeTexts: 'Freitexte der anderen Seite',
      actions: 'Ihr habt gesagt, wir haben gehandelt',
      pair: (side: string, ist: string, soll: string) => `${side}: Ist ${ist}, Soll ${soll}`,
      delta: (value: string) => `Lücke ${value}`,
      unknown: '–',
      names: {
        trust: 'Vertrauen',
        collaboration: 'Zusammenarbeit',
        integration: 'Integration',
        transparency: 'Transparenz',
        strategy: 'Strategie',
      } as Record<string, string>,
      actionStatuses: {
        open: 'Offen',
        in_progress: 'In Arbeit',
        done: 'Erledigt',
        cancelled: 'Abgebrochen',
        // ZQ-01 (K2-a.3): Zusagen aus Feedback-Lücken
        kept: 'Gehalten',
        missed: 'Verfehlt',
        replaced: 'Ersetzt',
        withdrawn: 'Zurückgezogen',
      } as Record<string, string>,
    },
  },
  en: {
    none: 'No entries.',
    internal: 'Internal',
    sides: { buyer: 'Buyer', supplier: 'Supplier' },
    plan: {
      eyebrow: 'Supplier plan',
      version: (n: number) => `Version ${n}`,
      title: 'Supplier plan',
      internalTitle: 'Your side only',
      internalText: 'The supplier plan is internal. The supplier never sees it.',
      summary: 'Summary',
      objectives: 'Objectives',
      topics: 'Strategic topics',
      contributions: (done: number, total: number) => `${done} of ${total} contributions delivered`,
      target: (type: string) => `Target type ${type}`,
      sro: (name: string) => `SRO ${name}`,
      year: (year: number) => `Target ${year}`,
      statuses: {
        draft: 'Draft',
        in_review: 'In approval',
        approved: 'Approved',
        superseded: 'Superseded',
      } as Record<string, string>,
    },
    jbp: {
      eyebrow: 'Joint plan',
      title: 'Joint plan',
      topics: 'Topics',
      initiatives: 'Initiatives',
      commitments: 'Commitments',
      scorecard: 'Scorecard',
      noPlan: 'No joint plan yet.',
      period: (from: string, to: string) => `${from} to ${to}`,
      due: (date: string) => `due ${date}`,
      target: (value: string, unit: string, date: string) => `Target ${value} ${unit} by ${date}`,
      last: (value: string, unit: string) => `Actual ${value} ${unit}`,
      scorecardStatus: (version: number, signed: boolean) =>
        `Version ${version} · ${signed ? 'signed' : 'draft'}`,
      topicStatuses: { proposed: 'Proposed', merged: 'Merged', parked: 'Parked' } as Record<
        string,
        string
      >,
      initiativeStatuses: {
        planned: 'Planned',
        running: 'Running',
        done: 'Done',
        stopped: 'Stopped',
      } as Record<string, string>,
      commitmentStatuses: {
        open: 'Open',
        kept: 'Kept',
        missed: 'Missed',
        replaced: 'Replaced',
        withdrawn: 'Withdrawn',
      } as Record<string, string>,
      tracks: { on_track: 'On track', close: 'Close', off: 'Off track' } as Record<string, string>,
      noValue: 'No value yet',
    },
    feedback: {
      eyebrow: 'Feedback result',
      kinds: { annual: 'Annual feedback', pulse: 'Pulse' } as Record<string, string>,
      due: (date: string) => `Due ${date}`,
      responses: (buyer: number, supplier: number) =>
        `Responses: buyer ${buyer}, supplier ${supplier}`,
      notRevealed: 'The result has not been revealed yet.',
      dimensions: 'Result per dimension',
      gaps: 'Largest gaps',
      freeTexts: 'Free texts from the other side',
      actions: 'You said, we did',
      pair: (side: string, ist: string, soll: string) => `${side}: actual ${ist}, target ${soll}`,
      delta: (value: string) => `Gap ${value}`,
      unknown: '–',
      names: {
        trust: 'Trust',
        collaboration: 'Collaboration',
        integration: 'Integration',
        transparency: 'Transparency',
        strategy: 'Strategy',
      } as Record<string, string>,
      actionStatuses: {
        open: 'Open',
        in_progress: 'In progress',
        done: 'Done',
        cancelled: 'Cancelled',
        kept: 'Kept',
        missed: 'Missed',
        replaced: 'Replaced',
        withdrawn: 'Withdrawn',
      } as Record<string, string>,
    },
  },
};

const stamp = (locale: PrintLocale, now: Date) =>
  footer(footerText[locale](printDateTime(locale, now.toISOString())));

/** Lieferantenplan (SPL-08): nur beim Käufer, ganz intern. */
export function supplierPlanHtml(
  plan: SupplierPlan,
  supplierName: string,
  locale: PrintLocale,
  now = currentTime(),
): string {
  const t = copy[locale];
  const p = t.plan;
  const body = [
    cover(
      `${p.eyebrow} · ${p.version(plan.version)} · ${p.statuses[plan.status] ?? plan.status}`,
      supplierName,
      [
        plan.targetType ? p.target(plan.targetType) : '',
        plan.sro ? p.sro(plan.sro.name) : '',
        p.contributions(plan.contributions.done, plan.contributions.total),
      ],
    ),
    privateSection(p.internalTitle, t.internal, paragraph(p.internalText, '')),
    section(p.summary, paragraph(plan.summary, t.none)),
    section(
      p.objectives,
      rows(
        plan.objectives.map((objective) => ({
          title: objective.text,
          meta: [
            objective.categoryName,
            objective.businessUnit?.name,
            objective.materialGroup?.name,
            objective.owner.name,
            p.year(objective.targetYear),
          ],
        })),
        t.none,
      ),
    ),
    section(
      p.topics,
      rows(
        plan.topics.map((topic) => ({
          title: topic.title,
          meta: topic.objectives.map((objective) => objective.text),
        })),
        t.none,
      ),
    ),
    stamp(locale, now),
  ].join('');
  return printDocument({ lang: locale, title: `${p.title}: ${supplierName}`, body });
}

/** Gemeinsamer Plan (JBP): Themen, Initiativen, Zusagen und Scorecard, so wie die Seite sie sieht. */
export function jbpHtml(
  data: {
    topics: JbpTopics;
    initiatives: Initiatives;
    commitments: Commitments;
    scorecard: ScorecardView;
  },
  counterpart: string,
  locale: PrintLocale,
  now = currentTime(),
): string {
  const t = copy[locale];
  const j = t.jbp;
  const date = (iso: string) => printDate(locale, iso);
  if (!data.topics.hasPlan) {
    return printDocument({
      lang: locale,
      title: j.title,
      body: cover(j.eyebrow, counterpart, []) + paragraph(j.noPlan, '') + stamp(locale, now),
    });
  }
  const topics = [...data.topics.buyer, ...data.topics.supplier].map((topic) => ({
    title: topic.title,
    meta: [t.sides[topic.side], j.topicStatuses[topic.status] ?? topic.status],
  }));
  const initiatives = data.initiatives.initiatives.map((initiative) => ({
    title: initiative.title,
    meta: [
      j.initiativeStatuses[initiative.status] ?? initiative.status,
      j.period(date(initiative.startsOn), date(initiative.endsOn)),
    ],
  }));
  const commitments = [...data.commitments.buyer, ...data.commitments.supplier].map((entry) => ({
    title: entry.title,
    meta: [
      entry.ownerName,
      j.commitmentStatuses[entry.status] ?? entry.status,
      j.due(date(entry.dueOn)),
    ],
  }));
  const kpis = data.scorecard.kpis.map((kpi) => {
    const last = kpi.values.at(-1);
    return {
      title: kpi.name,
      meta: [
        j.target(kpi.target, kpi.unit, date(kpi.targetDate)),
        last ? j.last(last.value, kpi.unit) : j.noValue,
        kpi.track ? (j.tracks[kpi.track] ?? kpi.track) : null,
      ],
    };
  });
  const body = [
    cover(j.eyebrow, counterpart, [
      j.scorecardStatus(data.scorecard.version, data.scorecard.status === 'signed'),
    ]),
    section(j.topics, rows(topics, t.none), 'topics'),
    section(j.initiatives, rows(initiatives, t.none), 'initiatives'),
    section(j.commitments, rows(commitments, t.none), 'commitments'),
    section(j.scorecard, rows(kpis, t.none), 'scorecard'),
    stamp(locale, now),
  ].join('');
  return printDocument({ lang: locale, title: `${j.title}: ${counterpart}`, body });
}

/** Feedback-Ergebnis (PUL-03): dieselben Zahlen für beide Seiten, interne Maßnahmen nur eigene. */
export function feedbackHtml(
  detail: SurveyWaveDetail,
  counterpart: string,
  locale: PrintLocale,
  now = currentTime(),
): string {
  const t = copy[locale];
  const f = t.feedback;
  const number = (value: number | null) =>
    value === null
      ? f.unknown
      : value.toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: 1 });
  const head = cover(
    `${f.eyebrow} · ${f.kinds[detail.wave.kind] ?? detail.wave.kind}`,
    counterpart,
    [
      f.due(printDate(locale, detail.wave.dueDate)),
      detail.results
        ? f.responses(detail.results.responses.buyer, detail.results.responses.supplier)
        : '',
    ],
  );
  if (!detail.results) {
    return printDocument({
      lang: locale,
      title: f.eyebrow,
      body: head + paragraph(f.notRevealed, '') + stamp(locale, now),
    });
  }
  const results = detail.results;
  const dimensionRow = (entry: (typeof results.dimensions)[number]) => ({
    title: f.names[entry.dimension] ?? entry.dimension,
    meta: [
      f.pair(t.sides.buyer, number(entry.buyer.ist), number(entry.buyer.soll)),
      f.pair(t.sides.supplier, number(entry.supplier.ist), number(entry.supplier.soll)),
      f.delta(number(entry.delta)),
    ],
  });
  const ownActions = results.actions.filter((action) => action.visibility === 'internal');
  const sharedActions = results.actions.filter((action) => action.visibility === 'shared');
  const actionRow = (action: (typeof results.actions)[number]) => ({
    title: action.title,
    meta: [
      f.names[action.dimension] ?? action.dimension,
      f.actionStatuses[action.status] ?? action.status,
    ],
  });
  const body = [
    head,
    section(f.dimensions, rows(results.dimensions.map(dimensionRow), t.none), 'dimensions'),
    section(f.gaps, rows(results.topGaps.map(dimensionRow), t.none), 'gaps'),
    section(
      f.freeTexts,
      rows(
        results.freeTexts.map((text) => ({ title: text, meta: [] })),
        t.none,
      ),
      'free-texts',
    ),
    section(f.actions, rows(sharedActions.map(actionRow), t.none), 'actions'),
    ownActions.length > 0
      ? privateSection(f.actions, t.internal, rows(ownActions.map(actionRow), t.none))
      : '',
    stamp(locale, now),
  ].join('');
  return printDocument({ lang: locale, title: `${f.eyebrow}: ${counterpart}`, body });
}
