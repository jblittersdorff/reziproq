import { z } from 'zod';
import type { AiFeature } from './ai-gateway.js';

// MA-01: Registry der Aufgaben von Reziproq mit erlaubten Stufen, Startstufe, geschätzter Prüfzeit
// und Werkzeugen. Werkzeuge mit binding = true laufen nie automatisch, auf keiner Stufe, sondern nur
// mit dem Bestätigungs-Token eines Menschen (G-5). binding_scope sagt, wem gegenüber eine Handlung
// bindet (KA-01): keiner, intern (die eigene Organisation) oder gegenueber (die andere Seite).
// Stand nach Kapitel 7 (Tabelle in MA-01); weitere Aufgaben kommen mit ihren Paketen dazu.

export const workerLevels = ['suggest', 'prepare', 'do'] as const;
export type WorkerLevel = (typeof workerLevels)[number];
export const workerLevelSchema = z.enum(workerLevels);

export const bindingScopes = ['keiner', 'intern', 'gegenueber'] as const;
export type BindingScope = (typeof bindingScopes)[number];

export interface WorkerTool {
  key: string;
  binding: boolean;
  bindingScope: BindingScope;
}

export interface Worker {
  key: string;
  /** Kapitel, in dem die Aufgabe dazukommt */
  chapter: number;
  allowedLevels: readonly WorkerLevel[];
  defaultLevel: WorkerLevel;
  /**
   * Stufen, die heute im Code wirken (K1-f). Mein Agent bietet nur sie an; eine erlaubte Stufe ohne
   * Wirkung kommt mit dem Paket der Aufgabe dazu. Leer: Die Aufgabe gibt es noch nicht, Mein Agent
   * und die KI-Einstellungen zeigen sie nicht.
   */
  liveLevels: readonly WorkerLevel[];
  /** Modellfunktionen des Gateways, die zu dieser Aufgabe gehören; aus heißt kein Aufruf (T1-MA4) */
  features?: readonly AiFeature[];
  /** Arten von `ai_draft`, die diese Aufgabe anlegt; daraus die Übernahmequote in Mein Agent */
  draftKinds?: readonly string[];
  /** Aufgabe ist für eine Organisation an, solange ein Admin sie nicht ausschaltet (Startwert) */
  enabledByDefault: boolean;
  /** Startwert für die geschätzte Zeit, einen Entwurf dieser Aufgabe zu prüfen (Kurz prüfen) */
  reviewSeconds: number;
  tools: readonly WorkerTool[];
  /** Schlüssel des bestehenden Systemagenten oder der Gateway-Funktion, wenn es sie schon gibt */
  existing?: string;
}

const all = workerLevels;
const free = (key: string): WorkerTool => ({ key, binding: false, bindingScope: 'keiner' });
const bindsInternally = (key: string): WorkerTool => ({
  key,
  binding: true,
  bindingScope: 'intern',
});
const bindsCounterpart = (key: string): WorkerTool => ({
  key,
  binding: true,
  bindingScope: 'gegenueber',
});

export const workers: readonly Worker[] = [
  {
    key: 'inbox',
    chapter: 1,
    allowedLevels: all,
    defaultLevel: 'do',
    // K1-f: Termine und Mails selbst zuordnen, als Entwurf in Kurz prüfen oder als Vorschlag in Alles
    liveLevels: all,
    features: ['mail_summary'],
    enabledByDefault: true,
    reviewSeconds: 20,
    tools: [
      free('mail.assign'),
      free('mail.extract'),
      free('commitment.draft'),
      bindsCounterpart('commitment.create_buyer'),
      bindsCounterpart('mail.send'),
      free('confirm_link.create'),
      free('mail.check_offer'),
    ],
  },
  {
    key: 'commitment_followup',
    chapter: 1,
    allowedLevels: all,
    defaultLevel: 'do',
    liveLevels: [],
    enabledByDefault: true,
    reviewSeconds: 10,
    // E-K1-5: Erinnern nur an Zusagen des Lieferanten, gekennzeichnet als Nachricht von Reziproq
    tools: [free('commitment.check'), free('commitment.book_kept'), free('commitment.remind')],
  },
  {
    key: 'meeting_brief',
    chapter: 3,
    allowedLevels: ['suggest', 'prepare'],
    defaultLevel: 'prepare',
    liveLevels: ['prepare'],
    // Kein Gateway-Schalter: pre_read nutzt auch der Pre-Read-Entwurf auf der Terminseite (QBR-07),
    // den eine Person selbst startet. An oder aus prüft der Start des Laufs (agents.service).
    draftKinds: [
      'brief_situation',
      'brief_goals',
      'brief_agenda',
      'brief_internal_questions',
      'brief_supplier_questions',
      'brief_expected_questions',
      'brief_risks',
      'brief_open_points',
      'qbr_topics',
      'qbr_risks',
      'qbr_open_points',
    ],
    // KI-04, KI-07: Das Briefing ruft regelmäßig ein Modell auf; ein Admin schaltet es ein.
    enabledByDefault: false,
    reviewSeconds: 120,
    tools: [free('brief.draft'), bindsCounterpart('agenda.release')],
    existing: 'meeting_brief',
  },
  {
    key: 'meeting_capture',
    chapter: 3,
    allowedLevels: ['suggest', 'prepare'],
    defaultLevel: 'prepare',
    liveLevels: ['prepare'],
    features: ['meeting_capture'],
    draftKinds: [
      'capture_commitment',
      'capture_action',
      'capture_decision',
      'capture_question',
      'capture_commitment_change',
      'capture_goal_check',
    ],
    enabledByDefault: true,
    reviewSeconds: 30,
    tools: [free('capture.draft'), bindsCounterpart('protocol.share')],
    existing: 'meeting_capture',
  },
  {
    key: 'deck_build',
    chapter: 3,
    allowedLevels: ['prepare', 'do'],
    defaultLevel: 'do',
    liveLevels: [],
    enabledByDefault: true,
    reviewSeconds: 180,
    // E-K3-3: Bauen auf Erledigen, Teilen durch Menschen
    tools: [free('deck.build'), bindsCounterpart('deck.share')],
  },
  {
    key: 'import_assign',
    chapter: 1,
    allowedLevels: all,
    defaultLevel: 'prepare',
    liveLevels: ['prepare'],
    features: ['import_assist'],
    enabledByDefault: true,
    reviewSeconds: 15,
    tools: [free('import.assign')],
    existing: 'import_assist',
  },
  {
    key: 'rating_prefill',
    chapter: 2,
    allowedLevels: ['suggest', 'prepare'],
    defaultLevel: 'prepare',
    liveLevels: [],
    enabledByDefault: true,
    reviewSeconds: 60,
    tools: [free('rating.prefill')],
  },
  {
    key: 'feedback',
    chapter: 2,
    allowedLevels: all,
    defaultLevel: 'prepare',
    liveLevels: [],
    enabledByDefault: true,
    reviewSeconds: 45,
    tools: [
      free('feedback.draft_wave'),
      free('feedback.remind'),
      bindsCounterpart('feedback.release'),
    ],
  },
  {
    key: 'segment_suggest',
    chapter: 2,
    allowedLevels: ['suggest'],
    defaultLevel: 'suggest',
    liveLevels: [],
    enabledByDefault: true,
    reviewSeconds: 30,
    tools: [free('segment.suggest'), bindsInternally('segment.decide')],
  },
  {
    key: 'early_warning',
    chapter: 1,
    allowedLevels: ['suggest', 'prepare'],
    defaultLevel: 'suggest',
    liveLevels: ['suggest'],
    features: ['hint_explanation'],
    enabledByDefault: true,
    reviewSeconds: 20,
    tools: [free('hint.explain')],
    existing: 'hint_explainer',
  },
  {
    key: 'value_finder',
    chapter: 4,
    allowedLevels: ['suggest', 'prepare'],
    defaultLevel: 'suggest',
    liveLevels: ['suggest'],
    features: ['value_opportunity'],
    enabledByDefault: true,
    reviewSeconds: 60,
    tools: [free('value.find_potentials')],
    existing: 'value_finder',
  },
  {
    key: 'value_booking',
    chapter: 4,
    allowedLevels: ['do'],
    defaultLevel: 'do',
    liveLevels: [],
    enabledByDefault: true,
    reviewSeconds: 30,
    tools: [
      free('value.book'),
      free('value.prepare_release'),
      bindsInternally('value.release'),
      bindsInternally('value.confirm'),
      bindsInternally('rule.freeze_baseline'),
    ],
  },
  {
    key: 'value_report',
    chapter: 4,
    allowedLevels: ['prepare'],
    defaultLevel: 'prepare',
    liveLevels: [],
    enabledByDefault: true,
    reviewSeconds: 180,
    tools: [free('value_report.draft'), bindsInternally('value_report.send')],
  },
  {
    key: 'routine_replies',
    chapter: 5,
    allowedLevels: all,
    defaultLevel: 'prepare',
    liveLevels: [],
    enabledByDefault: true,
    reviewSeconds: 15,
    tools: [free('reply.draft'), free('reply.send_routine')],
  },
  {
    key: 'deal_check',
    chapter: 5,
    allowedLevels: ['suggest', 'prepare'],
    defaultLevel: 'prepare',
    liveLevels: [],
    enabledByDefault: true,
    reviewSeconds: 120,
    tools: [
      free('deal.check_mandate'),
      free('deal.evaluate'),
      free('deal.draft_reply'),
      bindsCounterpart('deal.send'),
      bindsCounterpart('deal.confirm'),
    ],
  },
  {
    key: 'strategy_update',
    chapter: 6,
    allowedLevels: ['prepare'],
    defaultLevel: 'prepare',
    liveLevels: [],
    enabledByDefault: true,
    reviewSeconds: 300,
    tools: [free('strategy.draft'), bindsInternally('strategy.release')],
  },
  {
    key: 'market_signals',
    chapter: 6,
    allowedLevels: ['suggest'],
    defaultLevel: 'suggest',
    liveLevels: ['suggest'],
    features: ['market_analysis'],
    enabledByDefault: true,
    reviewSeconds: 45,
    tools: [free('market.signal'), free('market.map_to_relationships')],
    existing: 'market_analysis',
  },
];

export type WorkerKey = (typeof workers)[number]['key'];

/** Werkzeug, das ein Objekt in die Mitte stellt; bindet immer gegenüber der anderen Seite (ZA-01). */
export const shareTool: WorkerTool = bindsCounterpart('share.to_shared');

/** Werkzeug aus der Registry (mit dem Werkzeug zum Teilen in die Mitte) */
export function toolByKey(key: string): WorkerTool | undefined {
  return [...workers.flatMap((worker) => worker.tools), shareTool].find((tool) => tool.key === key);
}

export function workerByKey(key: string): Worker | undefined {
  return workers.find((worker) => worker.key === key);
}

/** MA-01: Stufe, die für eine Person gilt; ohne gültige Einstellung die Startstufe. */
export function effectiveLevel(
  worker: Worker,
  setting: WorkerLevel | null | undefined,
): WorkerLevel {
  return setting && worker.allowedLevels.includes(setting) ? setting : worker.defaultLevel;
}

/** Aufgaben, die es heute gibt: Mein Agent und die KI-Einstellungen zeigen nur sie (K1-f). */
export const liveWorkers = workers.filter((worker) => worker.liveLevels.length > 0);

/** Reihenfolge der Stufen: Vorschlagen < Vorbereiten < Erledigen */
export const levelRank = (level: WorkerLevel) => workerLevels.indexOf(level);

/** Stufen, die eine Person für sich wählen kann: erlaubt, heute wirksam und unter der Obergrenze */
export function selectableLevels(worker: Worker, orgCap: WorkerLevel | null | undefined) {
  return worker.allowedLevels.filter(
    (level) =>
      worker.liveLevels.includes(level) && (!orgCap || levelRank(level) <= levelRank(orgCap)),
  );
}

/**
 * MA-01, G-5 (K1-f): Stufe, mit der Reziproq für eine Person arbeitet. Ausgangspunkt ist die Wahl
 * in Mein Agent oder die Startstufe; die Obergrenze der Organisation und ein Mandat (MD-01) können
 * sie nur senken, nie heben. Wirkt eine Stufe noch nicht, gilt die nächstniedrigere, die wirkt.
 * null: Die Aufgabe ist für die Organisation aus oder hat keine wählbare Stufe; dann entsteht kein
 * Lauf (T1-MA4).
 */
export function resolveLevel(
  worker: Worker,
  input: {
    personal: WorkerLevel | null | undefined;
    enabled: boolean;
    orgCap?: WorkerLevel | null | undefined;
    mandateCap?: WorkerLevel | null | undefined;
  },
): WorkerLevel | null {
  if (!input.enabled) return null;
  const caps = [input.orgCap, input.mandateCap].filter((cap): cap is WorkerLevel => Boolean(cap));
  const ceiling = Math.min(
    levelRank(effectiveLevel(worker, input.personal)),
    ...caps.map(levelRank),
  );
  const candidates = selectableLevels(worker, null).filter((level) => levelRank(level) <= ceiling);
  return candidates.at(-1) ?? null;
}

/**
 * KI-Einstellungen der Organisation je Aufgabe (MA-01, K1-f): an oder aus und die Obergrenze der
 * Stufe. Ohne Eintrag gelten `enabledByDefault` und keine Obergrenze. Gespeichert als `ai_workers`.
 */
export const orgWorkerSettingSchema = z
  .object({ enabled: z.boolean().optional(), cap: workerLevelSchema.optional() })
  .strict();
export const orgWorkersSchema = z.record(z.string().min(1).max(80), orgWorkerSettingSchema);
export type OrgWorkers = z.infer<typeof orgWorkersSchema>;

/** An oder aus und Obergrenze einer Aufgabe in einer Organisation */
export function orgWorkerState(stored: OrgWorkers, worker: Worker) {
  const entry = stored[worker.key];
  return {
    enabled: entry?.enabled ?? worker.enabledByDefault,
    cap: entry?.cap && worker.allowedLevels.includes(entry.cap) ? entry.cap : null,
  };
}

/** Aufgabe, zu der eine Modellfunktion des Gateways gehört */
export function workerOfFeature(feature: AiFeature): Worker | undefined {
  return workers.find((worker) => worker.features?.includes(feature));
}
