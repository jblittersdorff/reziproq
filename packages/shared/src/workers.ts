import { z } from 'zod';

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
    reviewSeconds: 10,
    // E-K1-5: Erinnern nur an Zusagen des Lieferanten, gekennzeichnet als Nachricht von Reziproq
    tools: [free('commitment.check'), free('commitment.book_kept'), free('commitment.remind')],
  },
  {
    key: 'meeting_brief',
    chapter: 3,
    allowedLevels: ['suggest', 'prepare'],
    defaultLevel: 'prepare',
    reviewSeconds: 120,
    tools: [free('brief.draft'), bindsCounterpart('agenda.release')],
    existing: 'meeting_brief',
  },
  {
    key: 'meeting_capture',
    chapter: 3,
    allowedLevels: ['suggest', 'prepare'],
    defaultLevel: 'prepare',
    reviewSeconds: 30,
    tools: [free('capture.draft'), bindsCounterpart('protocol.share')],
    existing: 'meeting_capture',
  },
  {
    key: 'deck_build',
    chapter: 3,
    allowedLevels: ['prepare', 'do'],
    defaultLevel: 'do',
    reviewSeconds: 180,
    // E-K3-3: Bauen auf Erledigen, Teilen durch Menschen
    tools: [free('deck.build'), bindsCounterpart('deck.share')],
  },
  {
    key: 'import_assign',
    chapter: 1,
    allowedLevels: all,
    defaultLevel: 'prepare',
    reviewSeconds: 15,
    tools: [free('import.assign')],
    existing: 'import_assist',
  },
  {
    key: 'rating_prefill',
    chapter: 2,
    allowedLevels: ['suggest', 'prepare'],
    defaultLevel: 'prepare',
    reviewSeconds: 60,
    tools: [free('rating.prefill')],
  },
  {
    key: 'feedback',
    chapter: 2,
    allowedLevels: all,
    defaultLevel: 'prepare',
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
    reviewSeconds: 30,
    tools: [free('segment.suggest'), bindsInternally('segment.decide')],
  },
  {
    key: 'early_warning',
    chapter: 1,
    allowedLevels: ['suggest', 'prepare'],
    defaultLevel: 'suggest',
    reviewSeconds: 20,
    tools: [free('hint.explain')],
    existing: 'hint_explainer',
  },
  {
    key: 'value_finder',
    chapter: 4,
    allowedLevels: ['suggest', 'prepare'],
    defaultLevel: 'suggest',
    reviewSeconds: 60,
    tools: [free('value.find_potentials')],
    existing: 'value_finder',
  },
  {
    key: 'value_booking',
    chapter: 4,
    allowedLevels: ['do'],
    defaultLevel: 'do',
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
    reviewSeconds: 180,
    tools: [free('value_report.draft'), bindsInternally('value_report.send')],
  },
  {
    key: 'routine_replies',
    chapter: 5,
    allowedLevels: all,
    defaultLevel: 'prepare',
    reviewSeconds: 15,
    tools: [free('reply.draft'), free('reply.send_routine')],
  },
  {
    key: 'deal_check',
    chapter: 5,
    allowedLevels: ['suggest', 'prepare'],
    defaultLevel: 'prepare',
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
    reviewSeconds: 300,
    tools: [free('strategy.draft'), bindsInternally('strategy.release')],
  },
  {
    key: 'market_signals',
    chapter: 6,
    allowedLevels: ['suggest'],
    defaultLevel: 'suggest',
    reviewSeconds: 45,
    tools: [free('market.signal'), free('market.map_to_relationships')],
    existing: 'market_analysis',
  },
];

export type WorkerKey = (typeof workers)[number]['key'];

/** Werkzeug, das ein Objekt in die Mitte stellt; bindet immer gegenüber der anderen Seite (ZA-01). */
export const shareTool: WorkerTool = bindsCounterpart('share.to_shared');

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
