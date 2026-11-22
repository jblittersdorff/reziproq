import { describe, expect, it } from 'vitest';
import { progressFromBaseline } from './insights.js';

describe('AW-01 Fortschritt von der Basis zum Ziel', () => {
  it('folgt der Formel, auch wenn weniger besser ist, und bleibt zwischen 0 und 100 %', () => {
    // Liefertreue: Basis 80, Ziel 95, zuletzt 86 → 40 %
    expect(progressFromBaseline(80, 95, 86)).toBeCloseTo(0.4);
    // Fehlerquote in ppm, weniger ist besser: Basis 120, Ziel 40, zuletzt 60 → 75 %
    expect(progressFromBaseline(120, 40, 60)).toBeCloseTo(0.75);
    // Schlechter als die Basis → 0, besser als das Ziel → 100 %
    expect(progressFromBaseline(120, 40, 150)).toBe(0);
    expect(progressFromBaseline(80, 95, 99)).toBe(1);
    // Ohne Wert kein Fortschritt; Ziel gleich Basis ohne Balken
    expect(progressFromBaseline(80, 95, null)).toBeNull();
    expect(progressFromBaseline(80, 80, 82)).toBeNull();
  });
});
