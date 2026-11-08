import { describe, expect, it } from 'vitest';
import {
  calculateSegment,
  defaultSegmentCriteria,
  defaultSegmentTypes,
  updateSegmentWeightsSchema,
} from './segment.js';

describe('SEG-01 Standardmodell', () => {
  it('verteilt beide Achsen auf genau 100 Prozent und definiert alle neun Typen', () => {
    for (const axis of ['impact', 'quality']) {
      expect(
        defaultSegmentCriteria
          .filter((criterion) => criterion.axis === axis)
          .reduce((sum, criterion) => sum + criterion.weight, 0),
      ).toBe(100);
    }
    expect(defaultSegmentTypes).toHaveLength(9);
  });

  it.each([
    [33, 1],
    [34, 2],
    [66, 2],
    [67, 3],
  ])('ordnet den Grenzwert %i der Stufe %i zu', (score, expectedLevel) => {
    const result = calculateSegment(
      { criteria: defaultSegmentCriteria, types: defaultSegmentTypes, lowMax: 33, midMax: 66 },
      Object.fromEntries(defaultSegmentCriteria.map((criterion) => [criterion.key, score])),
    );
    expect(result.impactScore).toBeCloseTo(score);
    expect(result.qualityScore).toBeCloseTo(score);
    expect(result.impactLevel).toBe(expectedLevel);
    expect(result.qualityLevel).toBe(expectedLevel);
  });

  it('lehnt Gewichte ab, deren Summe nicht 100 Prozent ergibt', () => {
    expect(
      updateSegmentWeightsSchema.safeParse({
        impact: [{ key: 'spend', weight: 99 }],
        quality: [{ key: 'trust', weight: 100 }],
      }).success,
    ).toBe(false);
  });

  it('lehnt fehlende und unbekannte Bewertungswerte ab', () => {
    const model = {
      criteria: defaultSegmentCriteria,
      types: defaultSegmentTypes,
      lowMax: 33,
      midMax: 66,
    };
    expect(() => calculateSegment(model, { spend: 50 })).toThrow(/Ungültiger Wert/);
    expect(() =>
      calculateSegment(model, {
        ...Object.fromEntries(defaultSegmentCriteria.map((criterion) => [criterion.key, 50])),
        unknown: 50,
      }),
    ).toThrow(/Unbekanntes Segmentkriterium/);
  });
});
