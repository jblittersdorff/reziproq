/** Platzhalter für Namen von Personen in Texten an die KI (SEG-11) */
export const personPlaceholder = '[Person]';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Entfernt Namen von Personen aus einem Text, bevor er an die KI geht: alle bekannten Namen
 * (ganz und je Namensteil ab drei Buchstaben) und Anreden wie „Herr Müller“.
 */
export function withoutNames(text: string, names: string[]): string {
  const parts = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    if (trimmed.length === 0) continue;
    parts.add(trimmed);
    for (const part of trimmed.split(/\s+/)) if (part.length >= 3) parts.add(part);
  }
  // Längste zuerst, damit „Anna Berg“ als Ganzes ersetzt wird.
  const sorted = [...parts].sort((a, b) => b.length - a.length);
  let result = text;
  for (const part of sorted) {
    result = result.replace(
      new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(part)}(?![\\p{L}\\p{N}])`, 'giu'),
      personPlaceholder,
    );
  }
  result = result.replace(
    /\b(Herrn?|Frau|Hr\.|Fr\.|Mr\.?|Mrs\.?|Ms\.?)\s+\p{Lu}[\p{L}-]*/gu,
    personPlaceholder,
  );
  return result.replace(/(\[Person\])(\s+\[Person\])+/g, '$1');
}
