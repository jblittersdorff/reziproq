import { describe, expect, it } from 'vitest';
import { de } from './de';
import { en } from './en';

// UMB-05: Keine Seite zeigt „Kommt mit Release“ oder „Kommt nach Release“. Früher besuchte ein
// E2E-Test dafür jede Route (über vier Minuten); jeder sichtbare Text kommt aber aus den
// Sprachdateien, deshalb genügt die Prüfung dort.

const placeholder = [/Kommt (mit|nach) Release/i, /Coming (with|after) release/i];

/** Alle Texte eines Katalogs; Funktionen liefern ihren Text mit Beispielwerten. */
function texts(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') {
    const result = (value as (...args: unknown[]) => unknown)('x', 'x', 'x');
    return typeof result === 'string' ? [result] : [];
  }
  if (Array.isArray(value)) return value.flatMap(texts);
  if (value && typeof value === 'object') return Object.values(value).flatMap(texts);
  return [];
}

describe('UMB-05: kein Platzhalter für spätere Releases', () => {
  it('kein Text in Deutsch oder Englisch kündigt eine Seite für ein späteres Release an', () => {
    const all = [...texts(de), ...texts(en)];
    expect(all.length).toBeGreaterThan(1000);
    expect(all.filter((text) => placeholder.some((pattern) => pattern.test(text)))).toEqual([]);
  });

  it('die Prüfung findet den Platzhalter', () => {
    expect(texts({ a: 'Kommt mit Release 0.2', b: () => 'Coming after release 1.1' })).toHaveLength(2);
    expect(
      texts({ a: 'Kommt mit Release 0.2' }).filter((text) => placeholder.some((p) => p.test(text))),
    ).toHaveLength(1);
  });
});
