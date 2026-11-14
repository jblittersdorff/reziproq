import { describe, expect, it } from 'vitest';
import { sortByGap, surveyGap } from './survey.js';

// PUL-03: Lücke je Dimension und Reihenfolge nach der größten Lücke.
describe('PUL-03 Lücken', () => {
  it('die Lücke ist Ist Käufer minus Ist Lieferant, ohne beide Werte keine', () => {
    expect(surveyGap(4.1, 3.2)).toBe(0.9);
    expect(surveyGap(3, 4.25)).toBe(-1.25);
    expect(surveyGap(null, 3)).toBeNull();
  });

  it('sortiert nach dem Betrag; ohne Lücke ans Ende', () => {
    const sorted = sortByGap([
      { key: 'a', delta: 0.1 },
      { key: 'b', delta: null },
      { key: 'c', delta: -1.4 },
      { key: 'd', delta: 0.9 },
    ]);
    expect(sorted.map((entry) => entry.key)).toEqual(['c', 'd', 'a', 'b']);
  });
});
