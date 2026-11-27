import { type MailItem, spanOf } from './mail-extract.js';

// PO-01 (K2-d.3): Aus den erkannten Zusagen einer Mail wird der Entwurf „Zusagen aus Mail“: Person
// und Ersatz aufgelöst, Textstelle gesetzt, dazu ein Antwortentwurf. Ohne Datenbank, damit sich
// jede Regel einzeln prüfen lässt.

export interface OpenCommitment {
  id: string;
  title: string;
  side: 'buyer' | 'supplier';
  dueOn: string;
}

export interface MailCommitment {
  title: string;
  side: 'buyer' | 'supplier';
  ownerName: string;
  /** Person der eigenen Seite mit Konto; beim Lieferanten null */
  ownerUserId: string | null;
  dueOn: string | null;
  quote: string;
  /** Textstelle im Mailtext, [Anfang, Ende) */
  span: [number, number] | null;
  /** Offene Zusage, die diese ersetzt (E-K2-2) */
  replaces: { id: string; title: string; dueOn: string } | null;
}

export interface MailCommitmentsContent {
  sender: { name: string; email: string };
  commitments: MailCommitment[];
  reply: { to: string; subject: string; text: string };
}

/** Wörter, an denen zwei Zusagen als dieselbe gelten: lange Wörter und alles mit Ziffern */
const keyWords = (title: string) =>
  title
    .toLowerCase()
    .split(/[^a-zäöüß0-9-]+/)
    .filter((word) => word.length >= 5 || /\d/.test(word));

/**
 * Ersetzt die erkannte Zusage eine offene derselben Seite? Ja, wenn mindestens zwei Schlüsselwörter
 * übereinstimmen oder ein Wort mit Ziffern (etwa die Charge 4711). Bei mehreren die mit den meisten.
 */
export function replacedBy(
  item: Pick<MailItem, 'title' | 'side'>,
  open: OpenCommitment[],
): OpenCommitment | null {
  const words = new Set(keyWords(item.title));
  let best: { entry: OpenCommitment; score: number } | null = null;
  for (const entry of open) {
    if (entry.side !== item.side) continue;
    const shared = keyWords(entry.title).filter((word) => words.has(word));
    const score = shared.length + (shared.some((word) => /\d/.test(word)) ? 1 : 0);
    if (score >= 2 && (!best || score > best.score)) best = { entry, score };
  }
  return best?.entry ?? null;
}

/** „Herr Ott“ → der Ansprechpartner mit diesem Nachnamen; ohne Treffer der Name, wie er dasteht */
function supplierOwner(
  owner: string | null,
  sender: { name: string; email: string },
  contacts: { name: string; email: string }[],
): string {
  if (!owner) return sender.name;
  const last = owner
    .replace(/^(herr|frau)\s+/i, '')
    .trim()
    .toLowerCase();
  const contact = contacts.find((entry) => entry.name.toLowerCase().split(/\s+/).at(-1) === last);
  return contact?.name ?? owner.replace(/^(herr|frau)\s+/i, '').trim();
}

export function resolveCommitments(
  items: MailItem[],
  context: {
    body: string;
    sender: { name: string; email: string };
    contacts: { name: string; email: string }[];
    /** Wer die Mail abgelegt hat; trägt Zusagen der eigenen Seite, bis jemand anderes sie bekommt */
    filer: { userId: string; name: string };
    open: OpenCommitment[];
  },
): MailCommitment[] {
  return items.map((item) => {
    const replaces = replacedBy(item, context.open);
    return {
      title: item.title,
      side: item.side,
      ownerName:
        item.side === 'supplier'
          ? supplierOwner(item.owner, context.sender, context.contacts)
          : (item.owner?.replace(/^(herr|frau)\s+/i, '').trim() ?? context.filer.name),
      ownerUserId: item.side === 'buyer' && !item.owner ? context.filer.userId : null,
      dueOn: item.dueOn,
      quote: item.quote,
      span: spanOf(context.body, item.quote),
      replaces: replaces ? { id: replaces.id, title: replaces.title, dueOn: replaces.dueOn } : null,
    };
  });
}

const weekday = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const shortDate = (iso: string) => {
  const date = new Date(`${iso}T12:00:00Z`);
  return `${weekday[date.getUTCDay()]} ${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
};

/**
 * Antwortentwurf an die Absenderin, sachlich und im Namen der Person, die freigibt (E-K2-15). Die
 * Anrede nennt den ganzen Namen: Aus einem Namen lässt sich nicht sicher auf Herr oder Frau schließen.
 */
export function replyText(input: {
  sender: string;
  commitments: MailCommitment[];
  signer: string;
}): string {
  const line = (entry: MailCommitment) =>
    `- ${entry.title}${entry.dueOn ? ` bis ${shortDate(entry.dueOn)}` : ''} (${entry.ownerName})`;
  const own = input.commitments.filter((entry) => entry.side === 'buyer');
  const theirs = input.commitments.filter((entry) => entry.side === 'supplier');
  return [
    `Guten Tag ${input.sender},`,
    '',
    'danke für die Rückmeldung. So halten wir es fest:',
    ...theirs.map(line),
    ...own.map(line),
    '',
    'Alle Punkte stehen jetzt in Reziproq; bitte bestätigen Sie sie kurz über den Link, den Sie gleich bekommen.',
    '',
    'Viele Grüße',
    input.signer,
  ].join('\n');
}
