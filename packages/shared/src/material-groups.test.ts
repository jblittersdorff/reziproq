import { describe, expect, it } from 'vitest';
import { applyCategoryLabel, defaultCategoryLabel } from './material-groups.js';

describe('WG-01 eigene Bezeichnung der Warengruppe', () => {
  const label = { singular: 'Werkstoffgruppe', plural: 'Werkstoffgruppen' };

  it('ersetzt Einzahl, Mehrzahl und Zusammensetzungen', () => {
    expect(applyCategoryLabel('Warengruppen anlegen', label)).toBe('Werkstoffgruppen anlegen');
    expect(applyCategoryLabel('Neue Warengruppe', label)).toBe('Neue Werkstoffgruppe');
    expect(applyCategoryLabel('Haupt-Warengruppe ändern', label)).toBe('Haupt-Werkstoffgruppe ändern');
    expect(applyCategoryLabel('Warengruppenstrategie', label)).toBe('Werkstoffgruppenstrategie');
  });

  it('ersetzt auch das englische Wort', () => {
    expect(applyCategoryLabel('Material groups and suppliers', label)).toBe(
      'Werkstoffgruppen and suppliers',
    );
  });

  it('ohne eigene Bezeichnung bleibt der Text unverändert', () => {
    expect(applyCategoryLabel('Warengruppe', defaultCategoryLabel)).toBe('Warengruppe');
    expect(applyCategoryLabel('Warengruppe', null)).toBe('Warengruppe');
  });
});
