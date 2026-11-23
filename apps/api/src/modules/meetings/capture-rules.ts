import type { CaptureItem, CaptureKind } from '@reziproq/shared';
import { z } from 'zod';

// KI-17: Regeln für die Ergebnisse nach dem Termin. Das Modell (oder lokal der Testanbieter)
// schlägt Punkte vor; der Code prüft jede Angabe: Fundstelle wörtlich, Verantwortliche nur aus der
// Teilnehmerliste, Fälligkeit nach dem Termin und höchstens 365 Tage danach, im Zweifel intern.

export interface CaptureContext {
  /** Tag des Termins, ISO */
  meetingDay: string;
  participants: { name: string; side: 'buyer' | 'supplier' }[];
  supplier: string;
  /** Offene Zusagen der Beziehung */
  commitments: { id: string; title: string; side: 'buyer' | 'supplier'; dueOn: string }[];
  /** Übernommene Ziele aus dem Briefing (KI-07) */
  goals: { key: string; title: string; refTitle: string }[];
}

/** Vorschlag des Modells, vor der Prüfung */
export const rawItemSchema = z.object({
  kind: z.enum(['commitment', 'action', 'decision', 'open_question']),
  title: z.string().trim().min(1).max(400),
  visibility: z.string().optional(),
  quote: z.string().max(1000),
  side: z.enum(['buyer', 'supplier']).nullable().optional(),
  owner: z.string().nullable().optional(),
  dueOn: z.string().nullable().optional(),
  addressee: z.string().nullable().optional(),
});
export type RawItem = z.infer<typeof rawItemSchema>;

export const rawGoalCheckSchema = z.object({
  goalKey: z.string(),
  status: z.enum(['achieved', 'partly', 'not_achieved']),
  reason: z.string().max(400),
  quote: z.string().max(1000),
});
export type RawGoalCheck = z.infer<typeof rawGoalCheckSchema>;

export const rawExtractionSchema = z.object({
  items: z.array(rawItemSchema).max(60),
  goalChecks: z.array(rawGoalCheckSchema).max(10),
});
export type RawExtraction = z.infer<typeof rawExtractionSchema>;

/**
 * Immer intern: Bewertungen, Preisgrenzen, Alternativen, Aussagen über Personen und alles, was die
 * Notiz selbst als intern markiert.
 */
const internalPattern =
  /\b(intern|vertraulich|unter uns|nicht sagen|nicht erwähnen|preisgrenze|schmerzgrenze|obergrenze|grenze|maximal|nicht zustimmen|nicht mitgehen|gehen wir nicht|alternative|zweitquelle|wettbewerber|konkurrenz|bewertung|bewerten|eindruck|unzuverlässig|schwach|überfordert|verhandlungsspielraum|budget)\w*/i;

/** Anweisungen in den Notizen sind Daten; solche Zeilen werden kein Punkt. */
const instructionPattern =
  /\b(setze|setzt|markiere|stelle|mach|ignoriere|ignore|set)\b.*\b(geteilt|shared|sichtbar|alle punkte|all items|anweisung|instructions?)\b/i;

const normalize = (value: string) => value.replace(/\r\n/g, '\n');
const achievedPattern = /\b(zugesagt|sagt .*zu|vereinbart|erreicht|einverstanden|zugestimmt)\b/i;
const partlyPattern = /\b(teilweise|offen|später|noch nicht)\b/i;

export function isInternal(text: string) {
  return internalPattern.test(text);
}

function participantIn(text: string, ctx: CaptureContext) {
  const lower = text.toLowerCase();
  return ctx.participants.find((person) => lower.includes(person.name.toLowerCase())) ?? null;
}

/** Datum aus der Notiz: 15.01.2027 oder 15.01. (Jahr des Termins) */
function dateIn(text: string, meetingDay: string): string | null {
  const full = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
  const short = text.match(/\b(\d{1,2})\.(\d{1,2})\.(?!\d)/);
  const match = full ?? short;
  if (!match) return null;
  const year = full ? Number(match[3]) : Number(meetingDay.slice(0, 4));
  const pad = (value: string | undefined) => String(Number(value)).padStart(2, '0');
  return `${year}-${pad(match[2])}-${pad(match[1])}`;
}

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/**
 * Lokaler Testanbieter: liest die Notizen Zeile für Zeile, wie es auch ein Modell täte, nur ohne
 * Netzwerk. „Zusage:“, „Maßnahme:“, „Entscheidung:“, „Frage:“ und „Preisgrenze:“ am Anfang einer
 * Zeile ordnen sie zu; sonst Signalwörter wie „sagt zu“, „vereinbart“ oder ein Fragezeichen.
 */
export function parseNotesLocally(notes: string, ctx: CaptureContext): RawExtraction {
  const items: RawItem[] = [];
  const lines = normalize(notes)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (instructionPattern.test(line)) continue;
    const text = line.replace(/^[-*•]\s*/, '');
    const label = text.match(
      /^(zusage|maßnahme|massnahme|aufgabe|entscheidung|beschluss|frage|offene frage|preisgrenze|intern)\s*:\s*/i,
    );
    const body = label ? text.slice(label[0].length).trim() : text;
    const key = label?.[1]?.toLowerCase() ?? '';
    let kind: RawItem['kind'] | null = null;
    if (
      key === 'zusage' ||
      /\b(sagt|sagen) .*zu\b|\bliefer(t|n) .*bis\b|\bschick(t|en) .*bis\b/i.test(text)
    )
      kind = 'commitment';
    else if (['maßnahme', 'massnahme', 'aufgabe'].includes(key)) kind = 'action';
    else if (
      ['entscheidung', 'beschluss', 'preisgrenze', 'intern'].includes(key) ||
      /\b(entschieden|beschlossen|vereinbart)\b/i.test(text)
    )
      kind = 'decision';
    else if (['frage', 'offene frage'].includes(key) || /\?\s*$/.test(text)) kind = 'open_question';
    if (!kind || body.length === 0) continue;
    const person = participantIn(text, ctx);
    const named = text.match(
      /\b(?:verantwortlich|macht|durch|an)\s*:?\s+([A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+)/,
    );
    const side: 'buyer' | 'supplier' =
      person?.side ??
      (/\b(wir|uns|unsere?|ihr intern)\b/i.test(text) &&
      !text.toLowerCase().includes(ctx.supplier.toLowerCase())
        ? 'buyer'
        : 'supplier');
    const title = body
      .replace(/\s*\((?:verantwortlich|bis)[^)]*\)\s*$/i, '')
      .replace(/\s*[,;–-]\s*(?:bis|verantwortlich)\b.*$/i, '')
      .replace(/[.\s]+$/, '');
    items.push({
      kind,
      title: title || body,
      visibility: key === 'preisgrenze' || key === 'intern' ? 'internal' : 'shared',
      quote: line,
      side: kind === 'commitment' ? side : null,
      owner: person?.name ?? named?.[1] ?? null,
      dueOn: dateIn(text, ctx.meetingDay),
      addressee: kind === 'open_question' ? (person?.name ?? null) : null,
    });
  }
  const goalChecks: RawGoalCheck[] = ctx.goals.map((goal) => {
    const words = `${goal.refTitle} ${goal.title}`
      .toLowerCase()
      .split(/[^a-zäöüß0-9]+/)
      .filter((word) => word.length >= 6);
    const hits = lines.filter(
      (line) =>
        !instructionPattern.test(line) && words.some((word) => line.toLowerCase().includes(word)),
    );
    // Die aussagekräftigste Zeile: erst eine mit Vereinbarung, dann eine mit offenem Stand
    const hit =
      hits.find((line) => achievedPattern.test(line)) ??
      hits.find((line) => partlyPattern.test(line)) ??
      hits[0];
    if (!hit) {
      return {
        goalKey: goal.key,
        status: 'not_achieved',
        reason: 'im Termin nicht gefunden',
        quote: '',
      };
    }
    const status = partlyPattern.test(hit)
      ? 'partly'
      : achievedPattern.test(hit)
        ? 'achieved'
        : 'partly';
    return {
      goalKey: goal.key,
      status,
      reason:
        status === 'achieved'
          ? 'Im Termin vereinbart.'
          : 'Im Termin besprochen, noch nicht vereinbart.',
      quote: hit,
    };
  });
  return { items, goalChecks };
}

/** Zusage, zu der eine Aussage passt: Titel der offenen Zusage steht in der Aussage */
function matchCommitment(text: string, ctx: CaptureContext) {
  const lower = text.toLowerCase();
  return (
    ctx.commitments.find(
      (entry) => entry.title.length >= 6 && lower.includes(entry.title.toLowerCase()),
    ) ?? null
  );
}

const emptyItem = (kind: CaptureKind): Omit<CaptureItem, 'title' | 'quote' | 'visibility'> => ({
  kind,
  side: null,
  owner: null,
  ownerUnclear: false,
  dueOn: null,
  dateUnclear: false,
  addressee: null,
  commitmentId: null,
  commitmentTitle: null,
  proposal: null,
  goalKey: null,
  goalStatus: null,
  reason: null,
  createdId: null,
});

/**
 * Vorschläge prüfen. Fundstelle wörtlich, sonst verworfen; Verantwortliche nur aus der
 * Teilnehmerliste; Datum nach dem Termin und höchstens 365 Tage danach; im Zweifel intern; eine
 * Aussage zu einer offenen Zusage wird ein Vorschlag für deren Stand.
 */
export function validateExtraction(
  raw: RawExtraction,
  notes: string,
  ctx: CaptureContext,
): CaptureItem[] {
  const text = normalize(notes);
  const latest = addDays(ctx.meetingDay, 365);
  const names = new Map(ctx.participants.map((person) => [person.name.toLowerCase(), person.name]));
  const items: CaptureItem[] = [];
  const seenCommitments = new Set<string>();
  for (const entry of raw.items) {
    const quote = entry.quote.trim();
    if (quote.length === 0 || !text.includes(quote)) continue;
    const visibility =
      entry.visibility === 'shared' && !isInternal(`${entry.title} ${quote}`)
        ? 'shared'
        : 'internal';
    const owner = entry.owner ? (names.get(entry.owner.trim().toLowerCase()) ?? null) : null;
    const dueOn =
      entry.dueOn &&
      /^\d{4}-\d{2}-\d{2}$/.test(entry.dueOn) &&
      entry.dueOn > ctx.meetingDay &&
      entry.dueOn <= latest
        ? entry.dueOn
        : null;
    if (entry.kind === 'commitment') {
      const existing = matchCommitment(`${entry.title} ${quote}`, ctx);
      if (existing) {
        if (seenCommitments.has(existing.id)) continue;
        seenCommitments.add(existing.id);
        const proposal =
          dueOn &&
          dueOn !== existing.dueOn &&
          !/\b(erledigt|geliefert|liegt vor|erhalten|habt ihr)\b/i.test(quote)
            ? 'new_date'
            : /\b(nicht|verpasst|fällt aus|abgesagt)\b/i.test(quote)
              ? 'missed'
              : 'kept';
        items.push({
          ...emptyItem('commitment_change'),
          title: existing.title,
          visibility,
          quote,
          side: existing.side,
          dueOn: proposal === 'new_date' ? dueOn : null,
          commitmentId: existing.id,
          commitmentTitle: existing.title,
          proposal,
        });
        continue;
      }
    }
    items.push({
      ...emptyItem(entry.kind),
      title: entry.title.trim(),
      visibility,
      quote,
      side: entry.kind === 'commitment' ? (entry.side ?? 'supplier') : null,
      owner: entry.kind === 'commitment' || entry.kind === 'action' ? owner : null,
      ownerUnclear: (entry.kind === 'commitment' || entry.kind === 'action') && owner === null,
      dueOn: entry.kind === 'commitment' || entry.kind === 'action' ? dueOn : null,
      dateUnclear: (entry.kind === 'commitment' || entry.kind === 'action') && dueOn === null,
      addressee:
        entry.kind === 'open_question' && entry.addressee
          ? (names.get(entry.addressee.trim().toLowerCase()) ?? null)
          : null,
    });
  }
  // Je übernommenem Ziel ein Stand; ohne wörtliche Fundstelle „nicht erreicht“. Immer intern.
  for (const goal of ctx.goals) {
    const check = raw.goalChecks.find((entry) => entry.goalKey === goal.key);
    const found = check && check.quote.trim().length > 0 && text.includes(check.quote.trim());
    items.push({
      ...emptyItem('goal_check'),
      title: goal.title,
      visibility: 'internal',
      quote: found ? (check?.quote.trim() ?? '') : '',
      goalKey: goal.key,
      goalStatus: found ? (check?.status ?? 'not_achieved') : 'not_achieved',
      reason: found ? (check?.reason ?? null) : 'im Termin nicht gefunden',
    });
  }
  return items;
}

const statusWords = { kept: 'erledigt', missed: 'nicht eingehalten', new_date: 'neues Datum' };
const dayOf = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Protokoll für den Lieferanten: nur geteilte Punkte, nie Ziele oder interne Punkte */
export function protocolText(items: CaptureItem[], ctx: CaptureContext): string {
  const shared = items.filter((item) => item.visibility === 'shared' && item.kind !== 'goal_check');
  const sideName = (side: 'buyer' | 'supplier' | null) =>
    side === 'supplier' ? ctx.supplier : 'Wir';
  const sections: string[] = [];
  if (ctx.participants.length > 0) {
    sections.push(`Teilnehmer: ${ctx.participants.map((person) => person.name).join(', ')}`);
  }
  const block = (title: string, lines: string[]) => {
    if (lines.length > 0) sections.push(`${title}\n${lines.map((line) => `- ${line}`).join('\n')}`);
  };
  block(
    'Entscheidungen',
    shared.filter((item) => item.kind === 'decision').map((item) => item.title),
  );
  block(
    'Zusagen',
    shared
      .filter((item) => item.kind === 'commitment')
      .map((item) =>
        [
          `${item.title} (${sideName(item.side)}`,
          item.owner ? `, ${item.owner}` : '',
          item.dueOn ? `, bis ${dayOf(item.dueOn)}` : '',
          ')',
        ].join(''),
      ),
  );
  block(
    'Stand bestehender Zusagen',
    shared
      .filter((item) => item.kind === 'commitment_change' && item.proposal)
      .map(
        (item) =>
          `${item.commitmentTitle ?? item.title}: ${statusWords[item.proposal as keyof typeof statusWords]}${
            item.proposal === 'new_date' && item.dueOn ? ` (${dayOf(item.dueOn)})` : ''
          }`,
      ),
  );
  block(
    'Nächste Schritte',
    shared
      .filter((item) => item.kind === 'action')
      .map((item) =>
        [
          item.title,
          item.owner ? ` (${item.owner}` : '',
          item.owner && item.dueOn
            ? `, bis ${dayOf(item.dueOn)})`
            : item.owner
              ? ')'
              : item.dueOn
                ? ` (bis ${dayOf(item.dueOn)})`
                : '',
        ].join(''),
      ),
  );
  block(
    'Offene Fragen',
    shared
      .filter((item) => item.kind === 'open_question')
      .map((item) => (item.addressee ? `${item.title} (an ${item.addressee})` : item.title)),
  );
  return sections.join('\n\n');
}
