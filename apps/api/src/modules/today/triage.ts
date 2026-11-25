import { createHash } from 'node:crypto';
import {
  backedSentence,
  captureItemSchema,
  type DueItem,
  daysBetween,
  type FocusTopicKind,
  type FocusTopicLevel,
  type Hint,
  type ImpactSeverity,
  relationshipOfHref,
  type SentenceFact,
} from '@reziproq/shared';

// HE-01 Dienst 1 (K1-c): Aus jedem Ergebnis eines Moduls wird genau ein Fokus-Thema. Hier nur die
// Abbildung ohne Datenbank: Stufe, Art, Titel und der Satz mit seinen Fakten (G-6).

export type Locale = 'de' | 'en';

export const sourceTypes = ['due', 'hint', 'ai_draft', 'agent_run', 'inbound'] as const;
export type SourceType = (typeof sourceTypes)[number];

/** Ein Ergebnis, bevor die Triage es speichert; Punktzahl kommt im Dienst dazu */
export interface TriageCandidate {
  sourceType: SourceType;
  sourceId: string;
  level: FocusTopicLevel;
  kind: FocusTopicKind;
  title: string;
  sentence: string;
  facts: SentenceFact[];
  objectType: string;
  objectId: string | null;
  relationshipId: string | null;
  counterpart: string | null;
  dueDate: string | null;
  href: string | null;
  severity: ImpactSeverity | null;
  /** Kurz prüfen: geschätzte Sekunden je Entwurf */
  reviewSeconds: number | null;
  /** „Als Nächstes“ im Format von Start und Mein Tag, bis K1-e sie ablöst */
  dueItem: DueItem | null;
}

export const keyOf = (candidate: { sourceType: string; sourceId: string }) =>
  `${candidate.sourceType}:${candidate.sourceId}`;

/**
 * Feste ID eines Ergebnisses ohne eigene UUID (Fristen kommen mit zusammengesetzten IDs), damit die
 * Triage es bei jedem Lauf wiederfindet. Form einer UUID der Version 8 (RFC 9562).
 */
export function sourceIdOf(type: SourceType, key: string): string {
  const hex = createHash('sha256').update(`${type}:${key}`).digest('hex');
  const variant = ((Number.parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const firstUuid = (value: string) => uuidPattern.exec(value)?.[0] ?? null;
const titleOf = (...values: (string | null | undefined)[]) =>
  (values.map((value) => value?.trim()).find(Boolean) ?? '').slice(0, 300);

/** Vorlage ohne Zahl je Art (HE-01 Dienst 2): gilt, wenn ein Satz eine unbelegte Zahl hat */
const templates: Record<Locale, Record<FocusTopicKind, string>> = {
  de: {
    decision: 'Braucht deine Entscheidung.',
    approval: 'Wartet auf deine Freigabe.',
    conversation: 'Wartet auf deine Antwort.',
    draft: 'Entwurf von Reziproq zum Prüfen.',
    info: 'Von Reziproq erledigt.',
  },
  en: {
    decision: 'Needs your decision.',
    approval: 'Waiting for your approval.',
    conversation: 'Waiting for your reply.',
    draft: 'Draft by Reziproq to review.',
    info: 'Done by Reziproq.',
  },
};

export const templateOf = (locale: Locale, kind: FocusTopicKind) => templates[locale][kind];

/**
 * Satz, der angezeigt oder gespeichert wird (HE-01 Dienst 2, G-6): der Satz, wenn jede Zahl darin
 * in den Fakten steht, sonst die Vorlage ohne Zahl für die Art.
 */
export function shownSentence(
  sentence: string | null,
  facts: readonly SentenceFact[],
  kind: FocusTopicKind,
  locale: Locale,
): string {
  return backedSentence(sentence, facts, templateOf(locale, kind));
}

/** Freigaben unter den Fristen; Erwähnungen sind Gespräche, alles andere Entscheidungen */
const approvalDue = new Set<DueItem['kind']>([
  'approval',
  'signature',
  'validation',
  'review',
  'member_review',
  'agent_approval',
  'category_approval',
]);

export function kindOfDue(kind: DueItem['kind']): FocusTopicKind {
  if (kind === 'mention') return 'conversation';
  return approvalDue.has(kind) ? 'approval' : 'decision';
}

/** Satz zur Frist; die Zahl der Tage steht als Fakt dabei */
export function dueSentence(
  locale: Locale,
  dueDate: string,
  today: string,
  source: { objectType: string; objectId: string | null },
): { sentence: string; facts: SentenceFact[] } {
  const overdue = daysBetween(dueDate, today);
  const days = Math.abs(overdue);
  const fact: SentenceFact = {
    key: overdue > 0 ? 'overdue_days' : 'days_left',
    value: days,
    unit: 'd',
    source: {
      objectType: source.objectType,
      ...(source.objectId ? { objectId: source.objectId } : {}),
      label: locale === 'de' ? 'Frist' : 'Deadline',
    },
  };
  const de = locale === 'de';
  if (overdue === 0) return { sentence: de ? 'Heute fällig.' : 'Due today.', facts: [] };
  if (overdue === -1) return { sentence: de ? 'Morgen fällig.' : 'Due tomorrow.', facts: [] };
  if (overdue < 0) {
    return { sentence: de ? `Fällig in ${days} Tagen.` : `Due in ${days} days.`, facts: [fact] };
  }
  const sentence = de
    ? days === 1
      ? 'Seit 1 Tag überfällig.'
      : `Seit ${days} Tagen überfällig.`
    : days === 1
      ? '1 day overdue.'
      : `${days} days overdue.`;
  return { sentence, facts: [fact] };
}

/** Frist, Freigabe oder Gespräch aus einem Modul (DueItem) */
export function fromDue(item: DueItem, today: string, locale: Locale): TriageCandidate {
  const objectId = firstUuid(item.id);
  const { sentence, facts } = dueSentence(locale, item.dueDate, today, {
    objectType: item.kind,
    objectId,
  });
  return {
    sourceType: 'due',
    sourceId: sourceIdOf('due', `${item.kind}:${item.id}`),
    level: 'focus',
    kind: kindOfDue(item.kind),
    title: titleOf(item.detail, item.supplier, item.kind),
    sentence,
    facts,
    objectType: item.kind,
    objectId,
    relationshipId: relationshipOfHref(item.href),
    counterpart: item.supplier.trim() || null,
    dueDate: item.dueDate,
    href: item.href.startsWith('/') ? item.href : null,
    severity: null,
    reviewSeconds: null,
    dueItem: item,
  };
}

const severityText: Record<Locale, Record<ImpactSeverity, string>> = {
  de: { low: 'niedrig', medium: 'mittel', high: 'hoch' },
  en: { low: 'low', medium: 'medium', high: 'high' },
};

/** Offener Hinweis: eine Entscheidung (annehmen oder verwerfen) */
export function fromHint(hint: Hint, today: string, locale: Locale): TriageCandidate {
  const severity = hint.severity as ImpactSeverity;
  return {
    sourceType: 'hint',
    sourceId: hint.id,
    level: 'focus',
    kind: 'decision',
    title: titleOf(hint.title, hint.ruleKey),
    sentence:
      locale === 'de'
        ? `Hinweis mit Schwere ${severityText.de[severity]}.`
        : `Hint with ${severityText.en[severity]} severity.`,
    facts: [],
    objectType: 'hint',
    objectId: hint.id,
    relationshipId: hint.relationshipId,
    counterpart: hint.supplier,
    dueDate: null,
    href: hint.href.startsWith('/') ? hint.href : null,
    severity,
    reviewSeconds: null,
    dueItem: {
      id: `hint-${hint.id}`,
      kind: 'hint',
      supplier: hint.supplier ?? '',
      detail: hint.ruleKey,
      dueDate: today,
      href: hint.href,
    },
  };
}

export interface DraftRow {
  id: string;
  kind: string;
  objectType: string;
  objectId: string;
  relationshipId: string | null;
  subject: string | null;
  content: string;
  claims: { key: string; text: string }[] | null;
  reviewSeconds: number | null;
  counterpart: string | null;
  href: string | null;
}

/**
 * Zusage im Namen der eigenen Seite aus dem Protokoll (side buyer oder unklar) und vorgeschlagene
 * Änderung einer Zusage: nie Kurz prüfen, sondern Fokus (HE-01, E-K0-27).
 */
const captureFields = captureItemSchema
  .pick({ title: true, side: true, commitmentTitle: true })
  .partial();

function bindingCapture(draft: DraftRow): { title: string } | null {
  if (draft.kind !== 'capture_commitment' && draft.kind !== 'capture_commitment_change') {
    return null;
  }
  let content: unknown;
  try {
    content = JSON.parse(draft.content);
  } catch {
    return { title: '' };
  }
  // Nur die Felder, die die Triage braucht; ältere Entwürfe haben nicht alle Felder.
  const item = captureFields.safeParse(content);
  if (!item.success) return { title: '' };
  if (draft.kind === 'capture_commitment' && item.data.side === 'supplier') return null;
  return { title: item.data.commitmentTitle ?? item.data.title ?? '' };
}

/**
 * Entwürfe, die etwas an das Gegenüber geben: die Agenda eines Briefings (geteilt beim Übernehmen,
 * „Agenda freigeben“, BE-01) und eine Anfrage an den Lieferanten (KI-11). Nie Kurz prüfen, sondern
 * Freigabe im Fokus (HE-01, K1-e.2).
 */
const toCounterpart = new Set(['brief_agenda', 'data_request']);

/**
 * Offener Entwurf von Reziproq: Kurz prüfen. Teilen ohne Bestätigung (ZA-01) und alles, was an das
 * Gegenüber geht, ist eine Freigabe, eine Zusage der eigenen Seite eine Entscheidung; diese sind
 * Fokus-Themen.
 */
export function fromDraft(draft: DraftRow, locale: Locale): TriageCandidate {
  const de = locale === 'de';
  const binding = bindingCapture(draft);
  const share = draft.kind === 'share_request';
  const release = toCounterpart.has(draft.kind);
  const level: FocusTopicLevel = share || release || binding ? 'focus' : 'review';
  const kind: FocusTopicKind = share || release ? 'approval' : binding ? 'decision' : 'draft';
  const sentence = share
    ? de
      ? 'Reziproq will das teilen. Das braucht deine Bestätigung.'
      : 'Reziproq wants to share this. It needs your confirmation.'
    : release
      ? de
        ? 'Geht an das Gegenüber. Das braucht deine Freigabe.'
        : 'Goes to the counterpart. It needs your approval.'
      : binding
        ? de
          ? 'Zusage im Namen deiner Seite. Sie braucht deine Entscheidung.'
          : 'Commitment on behalf of your side. It needs your decision.'
        : templateOf(locale, 'draft');
  return {
    sourceType: 'ai_draft',
    sourceId: draft.id,
    level,
    kind,
    title: titleOf(
      binding?.title,
      draft.subject,
      draft.claims?.[0]?.text,
      draft.content.split('\n')[0],
      draft.kind,
    ),
    sentence,
    facts: [],
    objectType: draft.objectType,
    objectId: draft.objectId,
    relationshipId: draft.relationshipId,
    counterpart: draft.counterpart,
    dueDate: null,
    href: draft.href,
    severity: null,
    reviewSeconds: draft.reviewSeconds,
    dueItem: null,
  };
}

export interface RunRow {
  id: string;
  agentName: string;
  relationshipId: string | null;
  counterpart: string | null;
}

export interface InboundRow {
  id: string;
  kind: 'meeting' | 'mail';
  subject: string;
  /** Vorgeschlagene Beziehung, wenn genau eine; sonst null */
  relationshipId: string | null;
  counterpart: string | null;
}

/**
 * Eingang zum Zuordnen (IN-03, E-K0-26): ein Termin, den Reziproq nicht sicher zuordnen konnte.
 * Kurz prüfen, Entwurf „zuordnen“ (Inventar T1-I10); die Liste steht in Alles unter „Zuordnen“.
 */
export function fromInbound(item: InboundRow, locale: Locale): TriageCandidate {
  return {
    sourceType: 'inbound',
    sourceId: item.id,
    level: 'review',
    kind: 'draft',
    title: titleOf(
      item.kind === 'mail'
        ? locale === 'de'
          ? `Mail zuordnen: ${item.subject}`
          : `Assign mail: ${item.subject}`
        : locale === 'de'
          ? `Termin zuordnen: ${item.subject}`
          : `Assign meeting: ${item.subject}`,
    ),
    sentence: templateOf(locale, 'draft'),
    facts: [],
    objectType: 'inbound_item',
    objectId: item.id,
    relationshipId: item.relationshipId,
    counterpart: item.counterpart,
    dueDate: null,
    href: '/kurz-pruefen',
    severity: null,
    reviewSeconds: inboundReviewSeconds,
    dueItem: null,
  };
}

/** Geschätzte Prüfzeit einer Zuordnung (MA-01, Aufgabe Postfach) */
const inboundReviewSeconds = 20;

/** Handlung von Reziproq auf Stufe Erledigen (mit undo_payload): Erledigt im Hintergrund */
export function fromRun(run: RunRow, locale: Locale): TriageCandidate {
  return {
    sourceType: 'agent_run',
    sourceId: run.id,
    level: 'done',
    kind: 'info',
    title: titleOf(run.agentName, 'Reziproq'),
    sentence: templateOf(locale, 'info'),
    facts: [],
    objectType: 'agent_run',
    objectId: run.id,
    relationshipId: run.relationshipId,
    counterpart: run.counterpart,
    dueDate: null,
    href: null,
    severity: null,
    reviewSeconds: null,
    dueItem: null,
  };
}
