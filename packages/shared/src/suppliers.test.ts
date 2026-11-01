import { describe, expect, it } from 'vitest';
import {
  countryCodes,
  createSupplierRequestSchema,
  parseEuroToCents,
  spendRequestSchema,
  updateSupplierRequestSchema,
} from './suppliers.js';

// PLT-03b: Pflichtfelder und Formate werden auf der Seite und in der API geprüft (zod in
// packages/shared). Die Seite nutzt dieselben Schemas und zeigt die Codes am Feld.

const errorsOf = (input: unknown) => {
  const result = createSupplierRequestSchema.safeParse(input);
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
};

describe('Pflichtfelder und Formate werden auf der Seite und in der API geprüft (zod in packages/shared)', () => {
  it('verlangt Name und Land', () => {
    expect(errorsOf({})).toEqual({ name: 'required', country: 'invalid_country' });
    expect(errorsOf({ name: '   ', country: 'DE' })).toEqual({ name: 'required' });
    expect(errorsOf({ name: 'x'.repeat(201), country: 'DE' })).toEqual({ name: 'too_long' });
  });

  it('kennt alle Länder, aber keine Regionen', () => {
    expect(countryCodes).toContain('DE');
    expect(countryCodes).toContain('PL');
    expect(countryCodes).toContain('US');
    expect(countryCodes).not.toContain('EU');
    expect(countryCodes).not.toContain('XX');
    expect(countryCodes.length).toBeGreaterThan(200);
    expect(errorsOf({ name: 'X', country: 'XX' })).toEqual({ country: 'invalid_country' });
  });

  it('schreibt USt-IdNr. ohne Leerzeichen groß und prüft das Format', () => {
    const ok = createSupplierRequestSchema.parse({
      name: 'X',
      country: 'DE',
      vatId: 'de 123.456-789',
    });
    expect(ok.vatId).toBe('DE123456789');
    expect(errorsOf({ name: 'X', country: 'DE', vatId: '123456789' })).toEqual({
      vatId: 'invalid_vat_id',
    });
    // Leere Felder sind „nicht angegeben“, kein Fehler.
    expect(createSupplierRequestSchema.parse({ name: 'X', country: 'DE', vatId: ' ' }).vatId).toBe(
      undefined,
    );
  });

  it('verlangt bei D-U-N-S genau neun Ziffern', () => {
    expect(
      createSupplierRequestSchema.parse({ name: 'X', country: 'DE', duns: '12-345-6789' }).duns,
    ).toBe('123456789');
    expect(errorsOf({ name: 'X', country: 'DE', duns: '12345678' })).toEqual({
      duns: 'invalid_duns',
    });
  });

  it('prüft Spend als ganze Cent und das Jahr', () => {
    const next = new Date().getFullYear() + 1;
    expect(errorsOf({ name: 'X', country: 'DE', spend: { year: 2025, amountCents: -1 } })).toEqual({
      'spend.amountCents': 'invalid_amount',
    });
    expect(errorsOf({ name: 'X', country: 'DE', spend: { year: 2025, amountCents: 0.5 } })).toEqual(
      {
        'spend.amountCents': 'invalid_amount',
      },
    );
    expect(
      errorsOf({ name: 'X', country: 'DE', spend: { year: next + 1, amountCents: 1 } }),
    ).toEqual({
      'spend.year': 'invalid_year',
    });
    expect(spendRequestSchema.safeParse({ amountCents: 482_000_000 }).success).toBe(true);
  });

  it('begrenzt eigene Nummer und Notizen', () => {
    expect(
      updateSupplierRequestSchema.safeParse({ displayName: 'X', externalRef: 'x'.repeat(51) })
        .success,
    ).toBe(false);
    expect(
      updateSupplierRequestSchema.safeParse({ displayName: 'X', notes: 'x'.repeat(2001) }).success,
    ).toBe(false);
    expect(
      updateSupplierRequestSchema.parse({ displayName: 'X', externalRef: '', notes: '' }),
    ).toEqual({
      displayName: 'X',
      externalRef: undefined,
      notes: undefined,
    });
  });
});

describe('Spend liegt in Cent in der Datenbank und erscheint als Euro im deutschen Format', () => {
  it.each([
    ['4.820.000', 482_000_000],
    ['4820000', 482_000_000],
    ['1.234,5', 123_450],
    ['0,99 €', 99],
    ['12', 1_200],
  ])('liest „%s“ als %i Cent', (text, cents) => {
    expect(parseEuroToCents(text)).toBe(cents);
  });

  it.each(['', 'abc', '1,234', '1.23.4', '-5', '1,999'])('lehnt „%s“ ab', (text) => {
    expect(parseEuroToCents(text)).toBeNull();
  });

  it.each([
    ['1,234,567.89', 123456789],
    ['€4,820,000', 482000000],
    ['4820000', 482000000],
    ['0.5', 50],
  ])('PLT-09: Beträge im Format der Sprache: liest „%s“ auf Englisch als %i Cent', (text, cents) => {
    expect(parseEuroToCents(text, 'en')).toBe(cents);
  });

  it.each(['1.234,56', '1,23,4', '1.999'])('PLT-09: lehnt „%s“ auf Englisch ab', (text) => {
    expect(parseEuroToCents(text, 'en')).toBeNull();
  });
});
