import type { Money } from '@reziproq/shared';

// AK-01 (K2-c.5): Regeln des Blatts Profil ohne Oberfläche (Vorlage K2-Profil). Die Aussage nennt nur
// belegte Zahlen (G-6): seit wann der Ist-Spend jedes Jahr wächst und der Rang nach Spend.

/**
 * Jahr, seit dem der Ist-Spend jedes Jahr gewachsen ist, mit mindestens zwei Jahren Wachstum in
 * Folge bis zum jüngsten Jahr („wächst seit 2023 jedes Jahr“); sonst null
 */
export function growingSince(
  years: { year: number; kind: string; amountCents: number }[],
): number | null {
  const actual = years.filter((entry) => entry.kind === 'actual').sort((a, b) => a.year - b.year);
  let since: number | null = null;
  let steps = 0;
  for (let index = actual.length - 1; index > 0; index -= 1) {
    const year = actual[index];
    const before = actual[index - 1];
    if (
      !year ||
      !before ||
      year.year !== before.year + 1 ||
      year.amountCents <= before.amountCents
    ) {
      break;
    }
    steps += 1;
    since = before.year;
  }
  return steps >= 2 ? since : null;
}

/** Rang nach Spend unter den laufenden Beziehungen mit Spend; null ohne Spend */
export function spendRank(
  rows: { relationshipId: string; status: string; spend: Money | null }[],
  relationshipId: string,
): number | null {
  const ranked = rows
    .filter((row) => row.status === 'active' && (row.spend?.amountCents ?? 0) > 0)
    .sort((a, b) => (b.spend?.amountCents ?? 0) - (a.spend?.amountCents ?? 0));
  const index = ranked.findIndex((row) => row.relationshipId === relationshipId);
  return index >= 0 ? index + 1 : null;
}
