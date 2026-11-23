// IN-04: Mailtext ohne HTML, Bilder und Tracking-Links. Der Text gilt als Freitext eines
// Lieferanten: Er wird nur gespeichert und angezeigt; an ein Modell geht er nur für die
// Zusammenfassung, deren Ergebnis gegen den Text geprüft wird.

const entities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  Auml: 'Ä',
  Ouml: 'Ö',
  Uuml: 'Ü',
  szlig: 'ß',
  euro: '€',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

function decode(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    }
    if (code.startsWith('#')) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return entities[code] ?? whole;
  });
}

/** Links und Adressen von Bildern und Tracking entfernen; Mailadressen bleiben */
export function removeLinks(text: string): string {
  return text
    .replace(/\b(?:https?|ftp):\/\/[^\s<>"')\]]+/gi, '')
    .replace(/\bwww\.[^\s<>"')\]]+/gi, '')
    .replace(/[ \t]+\n/g, '\n');
}

/** HTML einer Mail als Text: Absätze bleiben, alles andere entfällt */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style|head|title)[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '');
  return decode(text);
}

/** Gespeicherter Mailtext: ohne HTML und Links, Leerzeilen gestrafft, höchstens 100.000 Zeichen */
export function cleanMailText(body: string, isHtml: boolean): string {
  const text = removeLinks(isHtml ? htmlToText(body) : body)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.slice(0, 100_000);
}

const digits = (text: string) =>
  (text.match(/\d[\d.,]*/g) ?? []).map((value) => value.replace(/[.,]/g, '')).filter(Boolean);

/**
 * Zusammenfassung prüfen: höchstens zwei Sätze, keine Links, jede Zahl steht im Mailtext oder
 * Betreff. Sonst wird sie verworfen (null).
 */
export function validSummary(summary: string, source: string): string | null {
  const text = summary.replace(/\s+/g, ' ').trim();
  if (!text || text.length > 400) return null;
  if (/(https?:\/\/|www\.)/i.test(text)) return null;
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 2) return null;
  const allowed = new Set(digits(source));
  if (!digits(text).every((value) => allowed.has(value))) return null;
  return text;
}

/** Erste Sätze des Textes als Ersatz, wenn kein Modell läuft (Testanbieter) */
export function fallbackSummary(subject: string, body: string): string {
  const first = body
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !/^(hallo|guten tag|hi|dear|sehr geehrte)/i.test(line));
  const sentence = (first ?? '').split(/(?<=[.!?])\s+/)[0] ?? '';
  return [`Mail zum Thema „${subject || 'ohne Betreff'}“.`, sentence.slice(0, 200)]
    .filter(Boolean)
    .join(' ');
}

export interface OriginalHeader {
  from: string | null;
  to: string[];
  cc: string[];
  subject: string | null;
}

const emailsIn = (line: string) =>
  [...line.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)].map((match) => match[0].toLowerCase());

/**
 * Kopf der ursprünglichen Mail in einer Weiterleitung (Outlook, Gmail, Apple Mail; Deutsch und
 * Englisch). Liefert die Adressen des ersten weitergeleiteten Blocks.
 */
export function forwardedHeader(text: string): OriginalHeader | null {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((line) => /^\s*(von|from)\s*:/i.test(line.replace(/^[>\s*]+/, '')));
  if (start < 0) return null;
  const header: OriginalHeader = { from: null, to: [], cc: [], subject: null };
  for (const raw of lines.slice(start, start + 12)) {
    const line = raw.replace(/^[>\s*]+/, '');
    if (!line.trim()) break;
    const [, key, value = ''] = line.match(/^(\w[\w ]*?)\s*:\s*(.*)$/) ?? [];
    if (!key) continue;
    const name = key.toLowerCase();
    if (name === 'von' || name === 'from') header.from = emailsIn(value)[0] ?? null;
    else if (name === 'an' || name === 'to') header.to.push(...emailsIn(value));
    else if (name === 'cc' || name === 'kopie') header.cc.push(...emailsIn(value));
    else if (name === 'betreff' || name === 'subject') header.subject = value.trim();
  }
  return header.from ? header : null;
}
