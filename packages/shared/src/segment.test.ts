import { describe, expect, it } from 'vitest';
import {
  calculateSegment,
  defaultSegmentCriteria,
  defaultSegmentTypes,
  defaultSegmentTypesFor,
  updateSegmentGridSchema,
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
      {
        criteria: defaultSegmentCriteria,
        types: defaultSegmentTypes,
        gridSize: 3,
        lowMax: 33,
        midMax: 66,
      },
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
      gridSize: 3 as const,
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

// E-K0-33 (K2-b.1): Matrix 2 × 2 je Segmentmodell, Hollmann nutzt sie
describe('E-K0-33 Matrix 2 × 2', () => {
  const model2 = {
    criteria: defaultSegmentCriteria,
    types: defaultSegmentTypesFor(2),
    gridSize: 2 as const,
    lowMax: 50,
    midMax: 100,
  };

  it('hat vier Typen auf zwei Stufen je Achse', () => {
    const types = defaultSegmentTypesFor(2);
    expect(types).toHaveLength(4);
    expect(types.map((type) => `${type.impactLevel}-${type.qualityLevel}`)).toEqual([
      '1-1',
      '1-2',
      '2-1',
      '2-2',
    ]);
    expect(types.at(-1)?.name).toBe('Hoher Impact · starke Beziehung');
  });

  it.each([
    [50, 1],
    [51, 2],
    [99, 2],
  ])('trennt bei lowMax 50: Wert %i ergibt Stufe %i', (score, expectedLevel) => {
    const result = calculateSegment(
      model2,
      Object.fromEntries(defaultSegmentCriteria.map((criterion) => [criterion.key, score])),
    );
    expect(result.impactLevel).toBe(expectedLevel);
    expect(result.qualityLevel).toBe(expectedLevel);
    expect(result.type.name).toBe(
      model2.types.find(
        (type) => type.impactLevel === expectedLevel && type.qualityLevel === expectedLevel,
      )?.name,
    );
  });

  it('nimmt nur 2 oder 3 als Größe und verlangt Namen für beide Achsen', () => {
    const grid = (gridSize: number, impactLabel = 'Versorgungsrisiko') =>
      updateSegmentGridSchema.safeParse({ gridSize, impactLabel, qualityLabel: 'Wertbeitrag' })
        .success;
    expect(grid(2)).toBe(true);
    expect(grid(3)).toBe(true);
    expect(grid(4)).toBe(false);
    expect(grid(2, ' ')).toBe(false);
  });
});
