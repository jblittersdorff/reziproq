import type { AkteCounterpartItem } from '@reziproq/shared';

// AK-01 (K2-c.4): Regeln der Sicht Von <Gegenüber> ohne Oberfläche. Die Sätze in „Das Wichtigste“
// nennen nur, was sich zählen lässt (G-6): Arten des Geteilten, was auf die eigene Seite wartet, die
// Zahl der Pflichten. Ob eine Pflicht erfüllt ist, hält Reziproq nicht fest.

type Kind = AkteCounterpartItem['kind'];

/** Reihenfolge der Arten im Satz: Meldungen vor Themen, Kommentaren und Unterschriften */
const kindOrder: Kind[] = ['kpi_value', 'topic', 'comment', 'signature', 'business_update'];

/** Zahl je Art, in fester Reihenfolge, ohne leere */
export function kindCounts(items: AkteCounterpartItem[]): { kind: Kind; count: number }[] {
  return kindOrder
    .map((kind) => ({ kind, count: items.filter((item) => item.kind === kind).length }))
    .filter((entry) => entry.count > 0);
}

/** Was auf die eigene Seite wartet: Kennzahlwerte ohne eigene Bestätigung, offene Themen fürs JBP */
export function waitingItems(items: AkteCounterpartItem[]): AkteCounterpartItem[] {
  return items.filter(
    (item) =>
      (item.kind === 'kpi_value' && item.awaitingOwn) ||
      (item.kind === 'topic' && item.status === 'proposed'),
  );
}

/**
 * Ansprechpartner ohne Einladung (Vorschläge der Einladungen, PLT-07b), ohne die, die schon im Team
 * des Gegenübers sind; höchstens drei Namen
 */
export function uninvited(
  suggestions: { name: string }[],
  members: { name: string }[],
): { names: string[]; more: number } {
  const key = (name: string) => name.trim().toLocaleLowerCase('de');
  const inTeam = new Set(members.map((member) => key(member.name)));
  const names = suggestions.map((entry) => entry.name).filter((name) => !inTeam.has(key(name)));
  return { names: names.slice(0, 3), more: Math.max(0, names.length - 3) };
}

/** Anfang eines Textes für eine Zeile, an einer Wortgrenze gekürzt */
export function excerpt(text: string, max = 90): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()} …`;
}
