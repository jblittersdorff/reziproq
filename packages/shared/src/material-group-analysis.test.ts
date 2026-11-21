import { describe, expect, it } from 'vitest';
import { costDataSchema, topShares } from './material-group-analysis.js';

describe('WG-07 Analysen', () => {
  it('die Volumensicht nimmt die obersten 80 % des Umsatzes, höchstens zehn Produktgruppen', () => {
    const items = [50, 20, 15, 10, 5].map((amountCents, n) => ({ key: `p${n}`, amountCents }));
    const { top, restShare } = topShares(items);
    // 50 + 20 = 70 % < 80 %, mit 15 % sind 85 % erreicht
    expect(top.map((item) => item.key)).toEqual(['p0', 'p1', 'p2']);
    expect(restShare).toBeCloseTo(0.15);

    const flat = Array.from({ length: 20 }, (_, n) => ({ key: `f${n}`, amountCents: 5 }));
    expect(topShares(flat).top).toHaveLength(10);
    expect(topShares([]).top).toEqual([]);
  });

  it('das Schema der Kostensicht lehnt ein Lieferantenfeld ab', () => {
    const row = { name: 'Material', own: 100, target: 98.5, market: 91 };
    expect(costDataSchema.safeParse({ costTypes: [row] }).success).toBe(true);
    expect(
      costDataSchema.safeParse({ costTypes: [{ ...row, relationshipId: crypto.randomUUID() }] })
        .success,
    ).toBe(false);
    expect(costDataSchema.safeParse({ costTypes: [row], supplier: 'Rheintal' }).success).toBe(
      false,
    );
  });
});
