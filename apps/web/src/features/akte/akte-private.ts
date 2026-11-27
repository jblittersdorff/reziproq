import type {
  ActionItem,
  ActivityItem,
  RatingOutcome,
  Segmentation,
  SupplierPlan,
  TouchpointList,
  ValueOpportunities,
} from '@reziproq/shared';

// AK-01 (K2-c.3): Regeln der Sicht Nur für dich ohne Oberfläche. Die Sicht liest die bestehenden
// Endpunkte (Segmentierung, Lieferantenplan, Warengruppen, Wert, Kontaktpunkte, Verlauf, Aufgaben);
// hier entstehen daraus die Zahlen für die Sätze in „Das Wichtigste“ (G-6: nur belegte Zahlen).

/**
 * „knapp“: Das Segment liegt weniger als so viele Punkte (Skala 0 bis 100) über der Grenze, unter
 * der es wechselt. Annahme in K2-c.3 nach dem Vorbild von JBP-09 („knapp: bis zu 10 % dahinter“).
 */
export const closeDistance = 10;

type Model = { gridSize: 2 | 3; lowMax: number; midMax: number };
type Scores = Pick<RatingOutcome, 'impactScore' | 'qualityScore' | 'impactLevel' | 'qualityLevel'>;

/** Untere Grenze einer Stufe; die unterste Stufe hat keine (wie segmentLevel) */
function lowerBound(level: number, model: Model): number | null {
  if (level <= 1) return null;
  if (model.gridSize === 2) return model.lowMax;
  return level === 2 ? model.lowMax : model.midMax;
}

/**
 * Abstand zur Grenze, unter der das Segment wechselt: der kleinste Abstand einer Achse über ihrer
 * unteren Grenze, auf eine Nachkommastelle. null, wenn beide Achsen auf der untersten Stufe liegen.
 */
export function segmentDistance(scores: Scores, model: Model): number | null {
  const distances = (
    [
      [scores.impactScore, scores.impactLevel],
      [scores.qualityScore, scores.qualityLevel],
    ] as const
  ).flatMap(([score, level]) => {
    const bound = lowerBound(level, model);
    return bound === null ? [] : [score - bound];
  });
  return distances.length > 0 ? Math.round(Math.min(...distances) * 10) / 10 : null;
}

export interface SegmentFacts {
  /** Festgelegtes Segment (SEG-06), sonst das berechnete */
  name: string;
  /** Punkte über der Grenze; null, wenn es keine gibt oder die Festlegung abweicht */
  distance: number | null;
  close: boolean;
  /** Noch nicht konsolidiert */
  provisional: boolean;
  roundName: string;
  /** Zahl der Bewertungen in der Runde */
  ratings: number;
  decidedAt: string | null;
  /** Kriterien mit Mittel und Spanne (größter minus kleinster Wert der Bewertenden) */
  criteria: {
    key: string;
    name: string;
    axis: 'impact' | 'quality';
    mean: number;
    spread: number;
  }[];
}

/** Segment und Bewertung aus der Segmentierung (SEG-05, SEG-06); null ohne Ergebnis */
export function segmentFacts(segmentation: Segmentation['segmentation']): SegmentFacts | null {
  if (!segmentation) return null;
  const computed = segmentation.overall.ist;
  const decided =
    segmentation.decision?.entries.find((entry) => entry.scope === 'total')?.ist ?? null;
  const name = decided?.typeName ?? computed?.typeName;
  if (!name) return null;
  // Der Abstand gilt nur, wenn die Festlegung dem berechneten Segment folgt
  const follows =
    computed !== null &&
    (decided === null ||
      (decided.impactLevel === computed.impactLevel &&
        decided.qualityLevel === computed.qualityLevel));
  const distance = follows && computed ? segmentDistance(computed, segmentation.model) : null;
  const stats = new Map(segmentation.stats.map((stat) => [stat.criterionKey, stat]));
  return {
    name,
    distance,
    close: distance !== null && distance < closeDistance,
    provisional: segmentation.status !== 'consolidated',
    roundName: segmentation.roundName,
    ratings: segmentation.overall.count,
    decidedAt: segmentation.decision?.decidedAt ?? null,
    criteria: segmentation.model.criteria.flatMap((criterion) => {
      const stat = stats.get(criterion.key);
      return stat
        ? [
            {
              key: criterion.key,
              name: criterion.name,
              axis: criterion.axis,
              mean: Math.round(stat.mean * 10) / 10,
              spread: Math.round((stat.max - stat.min) * 10) / 10,
            },
          ]
        : [];
    }),
  };
}

/** Kontakte des Lieferanten, mit denen bei euch noch niemand ein Gesprächspaar hat */
export function unpairedContacts(network: TouchpointList): string[] {
  const key = (name: string) => name.trim().toLocaleLowerCase('de');
  const paired = new Set(
    network.touchpoints.flatMap((touchpoint) => [
      touchpoint.supplierContactId ?? '',
      key(touchpoint.supplierName),
    ]),
  );
  return network.contacts
    .filter((contact) => !paired.has(contact.id) && !paired.has(key(contact.name)))
    .map((contact) => contact.name);
}

/** Was „Das Wichtigste“ zum Beziehungsnetz sagt, nach Gewicht */
export type NetworkFinding =
  | { kind: 'gaps'; count: number }
  | { kind: 'unpaired'; names: string[]; more: number }
  | { kind: 'empty' };

export function networkFinding(network: TouchpointList | null | undefined): NetworkFinding | null {
  if (!network) return null;
  // Vereinbarte Formate ohne Gesprächspaar wiegen schwerer als einzelne Kontakte
  if (network.gaps.length > 0) return { kind: 'gaps', count: network.gaps.length };
  if (network.touchpoints.length === 0) return { kind: 'empty' };
  const names = unpairedContacts(network);
  if (names.length === 0) return null;
  return { kind: 'unpaired', names: names.slice(0, 3), more: Math.max(0, names.length - 3) };
}

/** Wertpotenzial nur als EBIT: neu und übernommen, nie mit Cash oder Kostenvermeidung addiert */
export function ebitPotential(
  totals: ValueOpportunities['totals'],
): { low: number; high: number } | null {
  const ebit = totals.find((total) => total.impactType === 'ebit');
  if (!ebit) return null;
  const low = ebit.new.low + ebit.adopted.low;
  const high = ebit.new.high + ebit.adopted.high;
  return high > 0 ? { low, high } : null;
}

/** Lieferantenplan in drei Zeilen: Stand, Themen fürs JBP, Ziele, die intern bleiben (SPL-06) */
export function planFacts(plan: SupplierPlan) {
  const inTopics = new Set(
    plan.topics.flatMap((topic) => topic.objectives.map((objective) => objective.id)),
  );
  const approved = [...plan.approval.decisions]
    .filter((decision) => decision.decision === 'approved')
    .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))[0];
  return {
    approvedBy: plan.status === 'approved' ? (approved?.userName ?? null) : null,
    approvedAt: plan.status === 'approved' ? plan.approval.approvedAt : null,
    topics: [...plan.topics].sort((a, b) => a.priority - b.priority).map((topic) => topic.title),
    internal: plan.objectives
      .filter((objective) => !inTopics.has(objective.id))
      .map((objective) => objective.text),
  };
}

/** Offene interne Aufgaben (T2-I22), nach Frist */
export function openTasks(actions: ActionItem[]): ActionItem[] {
  return actions
    .filter(
      (action) =>
        action.kind === 'task' && (action.status === 'open' || action.status === 'in_progress'),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * Verlauf: Angeheftetes oben, dann das Vergangene, neueste zuerst. Kommendes (geplante Termine)
 * steht am Ende, damit vorn steht, was zuletzt geschah (Vorlage K2-Akte-Privat).
 */
export function orderedEntries(items: ActivityItem[], now: Date): ActivityItem[] {
  const time = (item: ActivityItem) => Date.parse(item.occurredAt);
  const latest = (a: ActivityItem, b: ActivityItem) => time(b) - time(a);
  const rest = items.filter((item) => !item.pinned);
  return [
    ...items.filter((item) => item.pinned).sort(latest),
    ...rest.filter((item) => time(item) <= now.getTime()).sort(latest),
    ...rest.filter((item) => time(item) > now.getTime()).sort((a, b) => time(a) - time(b)),
  ];
}

/**
 * Verlauf nach Monaten (AK-01: „Termine nach Monaten, Angeheftet oben“), neueste zuerst. Die Seite
 * zeigt das Angeheftete und die jüngsten Einträge vorn und übergibt hier den Rest.
 */
export function entriesByMonth(
  items: ActivityItem[],
  locale: string,
): { month: string; items: ActivityItem[] }[] {
  const format = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  });
  const groups = new Map<string, ActivityItem[]>();
  const byDate = [...items].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  for (const item of byDate) {
    const month = format.format(new Date(item.occurredAt));
    groups.set(month, [...(groups.get(month) ?? []), item]);
  }
  return [...groups.entries()].map(([month, entries]) => ({ month, items: entries }));
}
