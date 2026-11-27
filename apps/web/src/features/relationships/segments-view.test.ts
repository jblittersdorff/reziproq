import type { SegmentSupplier } from '@reziproq/shared';
import { describe, expect, it } from 'vitest';
import { sampleSegments } from '@/testing/app-harness';
import {
  fieldNames,
  fieldsInReadingOrder,
  levelOf,
  segmentListHref,
  shareInWords,
  spendBars,
  unratedIsLargest,
} from './segments-view';

// BZ-01 (K2-b.5): Regeln der Linse Segmente ohne Oberfläche

const supplier = (name: string, extra: Partial<SegmentSupplier> = {}): SegmentSupplier => ({
  relationshipId: `00000000-0000-7000-8000-${String(name.length).padStart(12, '0')}`,
  name,
  status: 'active',
  spend: null,
  disputed: false,
  ...extra,
});
const labels = (suppliers: SegmentSupplier[]) =>
  fieldNames(suppliers).names.map((entry) => entry.label);

describe('Namen je Feld', () => {
  it('höchstens drei, solange sie zusammen in 44 Zeichen passen; der Rest zählt „und N weitere“', () => {
    // Vorlage: Rheintal Elektronik, Silesia Guss, Nordwerk Guss „und 5 weitere“ (44 Zeichen)
    const strategic = sampleSegments.fields.find((field) => field.key === '2-2');
    expect(strategic && labels(strategic.suppliers)).toEqual([
      'Rheintal Elektronik',
      'Silesia Guss',
      'Nordwerk Guss',
    ]);
    expect(strategic && fieldNames(strategic.suppliers).rest).toBe(5);
    // Vorlage: Alpen Sensorik, Baltic Logistics „und 10 weitere“; Hanse Verpackung passt nicht mehr
    const secure = sampleSegments.fields.find((field) => field.key === '1-2');
    expect(secure && labels(secure.suppliers)).toEqual(['Alpen Sensorik', 'Baltic Logistics']);
    expect(secure && fieldNames(secure.suppliers).rest).toBe(10);
  });

  it('strittige zuerst, und ein langer erster Name steht trotzdem da', () => {
    expect(
      labels([
        supplier('Alpen Kunststofftechnik GmbH (Demo)'),
        supplier('Kessler Präzision GmbH (Demo)', { disputed: true }),
      ]),
    ).toEqual(['Kessler Präzision', 'Alpen Kunststofftechnik']);
    expect(
      labels([supplier('Ein sehr langer Name eines Lieferanten aus dem Import GmbH')]),
    ).toEqual(['Ein sehr langer Name eines Lieferanten aus dem Import']);
    expect(fieldNames([]).rest).toBe(0);
  });
});

describe('Anteil in Worten', () => {
  it('fast, gut oder genau ein Bruch; sonst Prozent', () => {
    expect(shareInWords(48)).toEqual({ fraction: 'half', approx: 'almost' });
    expect(shareInWords(50)).toEqual({ fraction: 'half', approx: 'exact' });
    expect(shareInWords(53)).toEqual({ fraction: 'half', approx: 'over' });
    expect(shareInWords(33)).toEqual({ fraction: 'third', approx: 'exact' });
    expect(shareInWords(30)).toEqual({ fraction: 'third', approx: 'almost' });
    expect(shareInWords(29)).toEqual({ fraction: 'quarter', approx: 'over' });
    expect(shareInWords(74)).toEqual({ fraction: 'threeQuarters', approx: 'almost' });
    expect(shareInWords(41)).toBeNull();
    expect(shareInWords(90)).toBeNull();
  });
});

describe('Matrix, Spend und Liste', () => {
  it('Felder in Lesefolge: höchster Impact oben, höchste Qualität rechts', () => {
    const shuffled = [...sampleSegments.fields].reverse();
    expect(fieldsInReadingOrder(shuffled).map((field) => field.name)).toEqual([
      'Entwickeln',
      'Strategisch',
      'Hebeln',
      'Absichern',
    ]);
  });

  it('Spend nach Segment: der größte zuerst, Balken im Verhältnis zum größten', () => {
    const bars = spendBars(sampleSegments);
    expect(bars.map((bar) => bar.name)).toEqual([
      'Strategisch',
      'Hebeln',
      'Absichern',
      'Entwickeln',
    ]);
    // Vorlage: 100, 49, 34 und 23 %
    expect(bars.map((bar) => Math.round(bar.share * 100))).toEqual([100, 49, 34, 23]);
    expect(spendBars({ ...sampleSegments, ratedSpend: [] })).toEqual([]);
  });

  it('Stufen in Worten, ob der größte ohne Bewertung der größte überhaupt ist, und die Liste dazu', () => {
    expect([levelOf(1, 2), levelOf(2, 2)]).toEqual(['low', 'high']);
    expect([levelOf(1, 3), levelOf(2, 3), levelOf(3, 3)]).toEqual(['low', 'mid', 'high']);
    expect(unratedIsLargest(sampleSegments)).toBe(true);
    const smaller = {
      ...sampleSegments,
      unrated: { ...sampleSegments.unrated, suppliers: sampleSegments.unrated.suppliers.slice(1) },
    };
    expect(unratedIsLargest(smaller)).toBe(false);
    expect(segmentListHref('2-2')).toBe('/beziehungen?segment=2-2&portfolio=1');
    expect(segmentListHref('ohne')).toBe('/beziehungen?segment=ohne&portfolio=1');
  });
});
