import type { RatingOutcome, RatingValue } from '@reziproq/shared';

interface Named {
  id: string;
  name: string;
}

export interface SegmentationInput {
  id: string;
  businessUnit: Named;
  materialGroup: Named | null;
  function: string;
  values: RatingValue[];
}

type Outcome = (
  values: { criterionKey: string; ist: number | null; soll: number | null }[],
  field: 'ist' | 'soll',
) => RatingOutcome | null;

const mean = (numbers: number[]) => numbers.reduce((sum, n) => sum + n, 0) / numbers.length;

/** Mittelwert je Kriterium über die Eingaben; null, wenn eine Eingabe den Wert nicht hat */
export function averaged(inputs: SegmentationInput[], criteria: { key: string }[]) {
  return criteria.map(({ key }) => {
    const entries = inputs.map((input) => input.values.find((value) => value.criterionKey === key));
    const average = (field: 'ist' | 'soll') => {
      const numbers = entries.map((entry) => entry?.[field]).filter((n): n is number => n != null);
      return numbers.length === inputs.length && numbers.length > 0 ? mean(numbers) : null;
    };
    return { criterionKey: key, ist: average('ist'), soll: average('soll') };
  });
}

/**
 * Mittelwerte je Business Unit und Warengruppe und insgesamt, dazu die Abweichungen je Kriterium.
 * Rechnet nur; welche Bewertungen sichtbar sind, entscheidet der Aufrufer.
 */
export function aggregateSegmentation(
  model: { criteria: { key: string }[] },
  inputs: SegmentationInput[],
  outcome: Outcome,
) {
  const groups = new Map<string, SegmentationInput[]>();
  for (const input of inputs) {
    const key = `${input.businessUnit.id}:${input.materialGroup?.id ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), input]);
  }

  const stats = model.criteria.map(({ key }) => {
    const ist = inputs
      .map((input) => input.values.find((value) => value.criterionKey === key)?.ist)
      .filter((n): n is number => n != null);
    return {
      criterionKey: key,
      mean: ist.length ? mean(ist) : 0,
      min: ist.length ? Math.min(...ist) : 0,
      max: ist.length ? Math.max(...ist) : 0,
    };
  });

  const rows = inputs
    .map((input) => ({
      ...input,
      deviation: Math.max(
        0,
        ...stats.map((stat) => {
          const value = input.values.find((entry) => entry.criterionKey === stat.criterionKey)?.ist;
          return value == null ? 0 : Math.abs(value - stat.mean);
        }),
      ),
    }))
    .sort(
      (a, b) =>
        b.deviation - a.deviation ||
        a.businessUnit.name.localeCompare(b.businessUnit.name) ||
        a.function.localeCompare(b.function),
    );

  const overallValues = averaged(inputs, model.criteria);
  return {
    overall: {
      ist: outcome(overallValues, 'ist'),
      soll: outcome(overallValues, 'soll'),
      count: inputs.length,
    },
    groups: [...groups.values()]
      .map((members) => {
        const values = averaged(members, model.criteria);
        const first = members[0] as SegmentationInput;
        return {
          businessUnit: first.businessUnit,
          materialGroup: first.materialGroup,
          ist: outcome(values, 'ist'),
          soll: outcome(values, 'soll'),
          count: members.length,
        };
      })
      .sort(
        (a, b) =>
          a.businessUnit.name.localeCompare(b.businessUnit.name) ||
          (a.materialGroup?.name ?? '').localeCompare(b.materialGroup?.name ?? ''),
      ),
    rows,
    stats,
  };
}
