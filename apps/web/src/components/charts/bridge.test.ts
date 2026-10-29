import { describe, expect, it } from 'vitest';
import { buildBridge } from './bridge';

describe('buildBridge', () => {
  const baseline = { label: 'Baseline', amountCents: 1_000_00, currency: 'EUR' };

  it('führt von der Baseline über die Hebel zur realisierten Wirkung', () => {
    const { steps, total } = buildBridge(
      baseline,
      [
        { label: 'Preis', amountCents: 300_00 },
        { label: 'Index', amountCents: -100_00 },
      ],
      'Realisiert',
    );

    expect(total).toEqual({ amountCents: 1_200_00, currency: 'EUR' });
    expect(steps.map((s) => [s.label, s.kind, s.startCents, s.endCents])).toEqual([
      ['Baseline', 'total', 0, 1_000_00],
      ['Preis', 'increase', 1_000_00, 1_300_00],
      ['Index', 'decrease', 1_300_00, 1_200_00],
      ['Realisiert', 'total', 0, 1_200_00],
    ]);
  });

  it('lehnt Bruchteile von Cent ab', () => {
    expect(() => buildBridge(baseline, [{ label: 'x', amountCents: 0.5 }], 'Summe')).toThrow();
  });
});
