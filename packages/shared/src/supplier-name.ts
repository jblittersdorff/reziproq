// LS-01: Anzeigename in der Lieferantenliste. Der rechtliche Name steht nur in der Detailleiste.

/** Rechtsformen, die der Anzeigename weglässt (längste zuerst, damit „GmbH & Co. KG“ vor „KG“ greift) */
export const legalForms = [
  'GmbH & Co. KG',
  'Sp. z o.o.',
  'S.p.A.',
  's.r.o.',
  'GmbH',
  'Ltd.',
  'Inc.',
  'S.A.',
  'AG',
  'SE',
  'KG',
] as const;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const formPattern = new RegExp(`[\\s,]+(?:${legalForms.map(escapeRegExp).join('|')})$`, 'i');

/**
 * Name ohne Rechtsform; ein Zusatz „(Demo)“ wird zum Kennzeichen statt zum Namensteil.
 * „Rheintal Elektronik GmbH (Demo)“ → { name: „Rheintal Elektronik“, demo: true }
 */
export function displayNameOf(name: string): { name: string; demo: boolean } {
  let rest = name.trim();
  const demo = /\s*\(Demo\)$/i.test(rest);
  if (demo) rest = rest.replace(/\s*\(Demo\)$/i, '').trim();
  const stripped = rest.replace(formPattern, '').trim();
  return { name: stripped || rest, demo };
}
