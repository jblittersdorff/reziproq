import { z } from 'zod';

// PO-01 (K2-d.3): Zusagen aus einer Mail. Das Modell liefert je Zusage Titel, Seite, Person, Frist
// und das wörtliche Zitat; daraus entsteht die Textstelle (source_span). Ohne Modell liest der
// lokale Testanbieter unten die Mail, wie es auch ein Modell täte, nur ohne Netzwerk.

export const mailItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  side: z.enum(['buyer', 'supplier']),
  /** Name, wie er in der Mail steht („Herr Ott“), oder null für die Absenderin bzw. offen */
  owner: z.string().trim().max(200).nullable(),
  dueOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  quote: z.string().max(1000),
});
export type MailItem = z.infer<typeof mailItemSchema>;

export const mailExtractionSchema = z.object({ items: z.array(mailItemSchema).max(20) });
export type MailExtraction = z.infer<typeof mailExtractionSchema>;

const weekdays = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
const due = String.raw`(\d{1,2}\.\d{1,2}\.(?:\d{4})?|(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag))`;

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Frist aus „11.12.“, „11.12.2026“ oder einem Wochentag. Ein Wochentag ist der nächste nach dem Tag
 * der Mail (am selben Wochentag eine Woche später); ein Datum ohne Jahr liegt nie vor der Mail.
 */
export function dueFrom(text: string, sentOn: string): string | null {
  const value = text.trim().toLowerCase();
  const day = weekdays.indexOf(value);
  const sent = new Date(`${sentOn}T12:00:00Z`);
  if (day >= 0) {
    const ahead = (day - sent.getUTCDay() + 7) % 7 || 7;
    const next = new Date(sent);
    next.setUTCDate(sent.getUTCDate() + ahead);
    return next.toISOString().slice(0, 10);
  }
  const match = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})?$/);
  if (!match) return null;
  const [dd, mm] = [Number(match[1]), Number(match[2])];
  let year = match[3] ? Number(match[3]) : sent.getUTCFullYear();
  const iso = `${year}-${pad(mm)}-${pad(dd)}`;
  if (!match[3] && iso < sentOn) year += 1;
  return `${year}-${pad(mm)}-${pad(dd)}`;
}

/** Titel ohne Füllwörter: „8D-Bericht zur Charge 4711“ → „8D-Bericht Charge 4711“ */
const titleOf = (value: string) =>
  value
    .replace(/\s+(?:zur|zum|für die|für den|für das)\s+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Lokaler Testanbieter: erkennt Zusagen an „bis <Frist>“ mit Liefern, Schicken oder Haben.
 * - „die Musterteile können wir bis 11.12. liefern“: Lieferant, Person die Absenderin
 * - „wenn wir Ihre Zeichnung bis 30.11. haben“: Käuferseite (die Angeschriebene), Person offen
 * - „Den 8D-Bericht schickt Herr Ott bis Freitag“: Lieferant, Person „Herr Ott“
 * - „wir schicken das Angebot bis Montag“: Lieferant, Person die Absenderin
 */
export function parseMailLocally(body: string, sentOn: string): MailExtraction {
  const items: MailItem[] = [];
  const patterns: {
    pattern: RegExp;
    side: MailItem['side'];
    title: (match: RegExpExecArray) => string;
    owner: (match: RegExpExecArray) => string | null;
    due: (match: RegExpExecArray) => string;
  }[] = [
    {
      pattern: new RegExp(
        String.raw`\b(?:die|den|das)\s+([^,.;]+?)\s+können wir bis\s+${due}\s+(?:liefern|schicken|senden)`,
        'gi',
      ),
      side: 'supplier',
      title: (match) => match[1] ?? '',
      owner: () => null,
      due: (match) => match[2] ?? '',
    },
    {
      pattern: new RegExp(
        String.raw`\bwenn wir (?:ihre|ihren|ihr)\s+([^,;]+?)\s+bis\s+${due}\s+(?:haben|bekommen|erhalten)`,
        'gi',
      ),
      side: 'buyer',
      title: (match) => match[1] ?? '',
      owner: () => null,
      due: (match) => match[2] ?? '',
    },
    {
      pattern: new RegExp(
        String.raw`\b(?:den|die|das)\s+([^,;]+?)\s+(?:schickt|liefert|sendet)\s+((?:herr|frau)\s+[A-ZÄÖÜ][a-zäöüß-]+)\s+bis\s+${due}`,
        'gi',
      ),
      side: 'supplier',
      title: (match) => match[1] ?? '',
      owner: (match) => match[2] ?? null,
      due: (match) => match[3] ?? '',
    },
    {
      pattern: new RegExp(
        String.raw`\bwir\s+(?:schicken|liefern|senden)\s+([^,.;]+?)\s+bis\s+${due}`,
        'gi',
      ),
      side: 'supplier',
      title: (match) => match[1] ?? '',
      owner: () => null,
      due: (match) => match[2] ?? '',
    },
  ];
  for (const { pattern, side, title, owner, due: dueText } of patterns) {
    for (const match of body.matchAll(pattern)) {
      const name = titleOf(title(match));
      if (!name) continue;
      items.push({
        title: name.charAt(0).toUpperCase() + name.slice(1),
        side,
        owner: owner(match),
        dueOn: dueFrom(dueText(match), sentOn),
        quote: match[0],
      });
    }
  }
  // In der Reihenfolge der Mail
  return {
    items: items.sort((a, b) => body.indexOf(a.quote) - body.indexOf(b.quote)).slice(0, 20),
  };
}

/** Textstelle des Zitats im Mailtext, [Anfang, Ende); null, wenn es dort nicht wörtlich steht */
export function spanOf(body: string, quote: string): [number, number] | null {
  if (!quote) return null;
  const start = body.indexOf(quote);
  return start >= 0 ? [start, start + quote.length] : null;
}
