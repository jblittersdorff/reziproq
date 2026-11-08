// Monogramm für Lieferanten und Kunden (UMB-05): zwei Buchstaben aus dem Namen, ohne Rechtsform
// und ohne den Zusatz „(Demo)“.

const legalForms = new Set(
  [
    'gmbh',
    'ag',
    'kg',
    'kgaa',
    'se',
    'ohg',
    'ug',
    'co',
    '&',
    'e.k.',
    'sas',
    'sa',
    's.a.',
    'sarl',
    's.p.a.',
    'spa',
    's.r.l.',
    'srl',
    's.r.o.',
    'a.s.',
    'sp.',
    'z',
    'o.o.',
    's.l.',
    'de',
    'c.v.',
    'ltd',
    'ltd.',
    'inc',
    'inc.',
    'llc',
    'plc',
    'b.v.',
    'bv',
    'n.v.',
    'kft.',
    'ab',
    'oy',
    'as',
  ].map((form) => form.toLowerCase()),
);

export function monogram(name: string): string {
  const words = name
    .replace(/\(demo\)/gi, '')
    .split(/[\s,]+/)
    .filter((word) => word && !legalForms.has(word.toLowerCase()))
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  if (words.length === 0) return '?';
  const [first = '', second] = words;
  const letters = second ? `${first[0]}${second[0]}` : first.slice(0, 2);
  return letters.toLocaleUpperCase('de');
}
