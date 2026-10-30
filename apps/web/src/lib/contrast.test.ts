import { describe, expect, it } from 'vitest';
import { contrast, luminance } from './contrast';

describe('Kontrastrechnung nach WCAG (PLT-10)', () => {
  it('kennt die Endpunkte der Skala', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBe(1);
    expect(contrast('#000000', '#ffffff')).toBe(21);
    expect(contrast('#2b63c6', '#2b63c6')).toBe(1);
  });

  it('stimmt mit bekannten Werten überein, unabhängig von der Reihenfolge', () => {
    // Referenzwerte aus dem WebAIM Contrast Checker
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(contrast('#ffffff', '#767676')).toBeCloseTo(4.54, 2);
    expect(contrast('#949494', '#ffffff')).toBeCloseTo(3.03, 2);
  });

  it('lehnt Farben ab, die es nicht sicher lesen kann', () => {
    expect(() => contrast('#fff', '#000000')).toThrow();
    expect(() => contrast('rgb(0, 0, 0)', '#000000')).toThrow();
  });
});
