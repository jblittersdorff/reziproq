import { describe, expect, it } from 'vitest';
import { parseImportAmount } from './import.js';
import { demoSupplierImportInvalidRows, demoSupplierImportRows } from './import-demo.js';

describe('parseImportAmount', () => {
  it.each([
    ['1.234.567,89', 123_456_789],
    ['1,234,567.89', 123_456_789],
    ['1234567', 123_456_700],
    ['1234567,8', 123_456_780],
    ['1234567.89', 123_456_789],
    ['1.234.567', 123_456_700],
    ['1,234,567', 123_456_700],
  ])('parses %s to %d cents', (value, cents) => {
    expect(parseImportAmount(value)).toBe(cents);
  });

  describe('Demo-Lieferantenimport', () => {
    it('enthält 50 gültige Demo-Lieferanten und drei gezielt fehlerhafte Zeilen', () => {
      expect(demoSupplierImportRows).toHaveLength(50);
      expect(new Set(demoSupplierImportRows.map((row) => row.name)).size).toBe(50);
      expect(demoSupplierImportRows.every((row) => row.name.endsWith('(Demo)'))).toBe(true);
      expect(demoSupplierImportInvalidRows).toHaveLength(3);
      expect(demoSupplierImportInvalidRows.map((row) => row.name)).toEqual([
        'Fehlendes Land (Demo)',
        'Ungültige Umsatzsteuer (Demo)',
        'Unbekannte Warengruppe (Demo)',
      ]);
    });
  });

  it.each(['', '1,234', '1.234', '1.234,567', '1,23.45', '12,34,567', 'unknown'])(
    'rejects ambiguous or invalid value %s',
    (value) => {
      expect(parseImportAmount(value)).toBeNull();
    },
  );
});
