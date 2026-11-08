import type { OpenItem } from '@reziproq/shared';

export interface OpenInput {
  relationshipId: string;
  name: string;
  /** Eine Zeile je Zuordnung der letzten gestarteten Runde */
  assignments: { status: string; values: { criterionKey: string; ist: number | null }[] }[];
  /** Zeitpunkt der letzten Abgabe der Runde */
  lastSubmittedAt: Date | null;
  /** Zeitpunkt der letzten Konsolidierung der Beziehung */
  decidedAt: Date | null;
}

const mean = (numbers: number[]) => numbers.reduce((sum, n) => sum + n, 0) / numbers.length;

/** Größte Abweichung eines Ist-Werts vom Mittelwert seines Kriteriums, in Punkten. */
export function largestDeviation(values: OpenInput['assignments']) {
  const byCriterion = new Map<string, number[]>();
  for (const assignment of values) {
    for (const value of assignment.values) {
      if (value.ist === null) continue;
      byCriterion.set(value.criterionKey, [
        ...(byCriterion.get(value.criterionKey) ?? []),
        value.ist,
      ]);
    }
  }
  let largest = 0;
  for (const ist of byCriterion.values()) {
    const average = mean(ist);
    for (const value of ist) largest = Math.max(largest, Math.abs(value - average));
  }
  return byCriterion.size === 0 ? null : largest;
}

/**
 * Sortiert Lieferanten in die drei Gründe für offene Entscheidungen. Jeder Lieferant steht in
 * höchstens einer Gruppe: fehlende Bewertungen vor ungeklärter Abweichung vor „nicht konsolidiert“.
 */
export function openGroups(inputs: OpenInput[], threshold: number) {
  const groups = {
    ratings_open: [] as OpenItem[],
    not_consolidated: [] as OpenItem[],
    deviation: [] as OpenItem[],
  };
  for (const input of inputs) {
    if (input.assignments.length === 0) continue;
    const submitted = input.assignments.filter((entry) => entry.status === 'submitted');
    const complete = submitted.length === input.assignments.length;
    const decided =
      input.decidedAt !== null &&
      input.lastSubmittedAt !== null &&
      input.decidedAt >= input.lastSubmittedAt;
    const deviation = largestDeviation(submitted);
    const item: OpenItem = {
      relationshipId: input.relationshipId,
      name: input.name,
      submitted: submitted.length,
      total: input.assignments.length,
      deviation: deviation === null ? null : Math.round(deviation * 10) / 10,
    };
    if (!complete) groups.ratings_open.push(item);
    else if (decided) continue;
    else if (deviation !== null && deviation > threshold) groups.deviation.push(item);
    else groups.not_consolidated.push(item);
  }
  return groups;
}
