import type { MeetingType } from '@reziproq/shared';

/** Mail-Domain in Kleinbuchstaben */
export const domainOf = (email: string) => email.split('@')[1]?.trim().toLowerCase() ?? '';

/** Domains von Mail-Anbietern sagen nichts über den Lieferanten */
const publicDomains = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'gmx.de',
  'gmx.net',
  'web.de',
  't-online.de',
  'example.com',
]);
export const isPublicDomain = (domain: string) => publicDomains.has(domain);

/** Adressen von Reziproq selbst (Eingangsadresse) zählen nicht als Teilnehmer */
export const isReziproqAddress = (email: string) => /@([a-z0-9-]+\.)*reziproq\.de$/i.test(email);

/**
 * Termintyp aus dem Betreff (ohne Add-in). Spec: Modell der Klasse small; hier feste Regeln, die
 * eindeutige Wörter erkennen. Unsicher bleibt „Sonstiger“.
 */
export function guessMeetingType(subject: string): MeetingType {
  const text = subject.toLocaleLowerCase('de');
  if (/\bqbr\b|quartals|quarterly/.test(text)) return 'quarterly_review';
  if (/\bjbp\b|joint business|jahresplan/.test(text)) return 'jbp';
  if (/verhandl|negotiat|preisgespr/.test(text)) return 'negotiation';
  if (/werksbesuch|werkbesuch|\baudit\b|site visit|besuch im werk/.test(text)) return 'site_visit';
  if (/eskalation|escalat/.test(text)) return 'escalation';
  if (/strategie|strategy/.test(text)) return 'strategy_dialogue';
  return 'other';
}

const words = (subject: string) =>
  new Set(
    subject
      .toLocaleLowerCase('de')
      .replace(/^((aw|wg|re|fw|fwd|antw|wtr):\s*)+/i, '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 1),
  );

/** Betreff gleich oder ähnlich (für die Verknüpfung mit dem Add-in) */
export function similarSubject(a: string, b: string): boolean {
  const left = words(a);
  const right = words(b);
  if (left.size === 0 || right.size === 0) return false;
  const shared = [...left].filter((word) => right.has(word)).length;
  return shared / Math.max(left.size, right.size) >= 0.6;
}

/** Block der Agenda in der Beschreibung eines Termins; nur er wird geändert */
export const agendaStart = '<!-- reziproq:agenda -->';
export const agendaEnd = '<!-- /reziproq:agenda -->';

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** Setzt die Agenda in den markierten Block; ohne Block wird er am Ende angefügt. */
export function replaceAgendaBlock(
  body: string,
  items: { title: string; detail: string | null }[],
  heading: string,
): string {
  const list = items
    .map((item) => `<li>${escapeHtml(item.title)}${item.detail ? ` – ${escapeHtml(item.detail)}` : ''}</li>`)
    .join('');
  const block = `${agendaStart}<p><strong>${escapeHtml(heading)}</strong></p><ul>${list}</ul>${agendaEnd}`;
  const start = body.indexOf(agendaStart);
  const end = body.indexOf(agendaEnd);
  if (start >= 0 && end > start) {
    return body.slice(0, start) + block + body.slice(end + agendaEnd.length);
  }
  return `${body}${body ? '\n' : ''}${block}`;
}
