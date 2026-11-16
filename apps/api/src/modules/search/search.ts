/**
 * QS-05: Suchwort als tsquery mit Präfix je Wort, damit Wortformen und Zusammensetzungen gefunden
 * werden („Kosten“ findet „Kostensenkung“). Nur Buchstaben und Ziffern gehen in die Abfrage;
 * null, wenn nichts übrig bleibt.
 */
export function prefixQuery(query: string): string | null {
  const words = query
    .toLocaleLowerCase('de')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0)
    .slice(0, 8);
  return words.length === 0 ? null : words.map((word) => `${word}:*`).join(' & ');
}
