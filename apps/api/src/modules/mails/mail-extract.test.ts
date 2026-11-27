import { describe, expect, it } from 'vitest';
import { dueFrom, parseMailLocally, spanOf } from './mail-extract.js';

// PO-01 (K2-d.3): Zusagen aus einer Mail mit dem lokalen Testanbieter; Text wie das Signal der
// Regie „Mail von Kim Kaiser“ (DM-01, Kapitel 2), gesendet am Montag, 23.11.2026.
const mail =
  'Hallo Herr von Blittersdorff, die Musterteile Starrflex können wir bis 11.12. liefern, wenn wir Ihre Zeichnung Rev. C bis 30.11. haben. Den 8D-Bericht zur Charge 4711 schickt Herr Ott bis Freitag. Viele Grüße Kim Kaiser';

describe('Zusagen aus einer Mail (PO-01, lokaler Testanbieter)', () => {
  it('die Mail von Kim Kaiser ergibt drei Zusagen mit Seite, Person, Frist und Zitat', () => {
    const { items } = parseMailLocally(mail, '2026-11-23');
    expect(items.map(({ title, side, owner, dueOn }) => ({ title, side, owner, dueOn }))).toEqual([
      { title: 'Musterteile Starrflex', side: 'supplier', owner: null, dueOn: '2026-12-11' },
      { title: 'Zeichnung Rev. C', side: 'buyer', owner: null, dueOn: '2026-11-30' },
      { title: '8D-Bericht Charge 4711', side: 'supplier', owner: 'Herr Ott', dueOn: '2026-11-27' },
    ]);
    // Jede Zusage mit ihrer Textstelle im Mailtext
    for (const item of items) {
      const span = spanOf(mail, item.quote);
      expect(span).not.toBeNull();
      expect(mail.slice(span?.[0], span?.[1])).toBe(item.quote);
    }
  });

  it('Fristen: Wochentag ist der nächste nach der Mail, ein Datum ohne Jahr liegt nie davor', () => {
    expect(dueFrom('Freitag', '2026-11-23')).toBe('2026-11-27');
    expect(dueFrom('Montag', '2026-11-23')).toBe('2026-11-30');
    expect(dueFrom('11.12.', '2026-11-23')).toBe('2026-12-11');
    expect(dueFrom('05.01.', '2026-11-23')).toBe('2027-01-05');
    expect(dueFrom('11.12.2027', '2026-11-23')).toBe('2027-12-11');
    expect(dueFrom('bald', '2026-11-23')).toBeNull();
  });

  it('ohne Frist keine Zusage; ein Zitat, das nicht im Text steht, hat keine Textstelle', () => {
    expect(
      parseMailLocally('Danke für die Unterlagen. Wir melden uns.', '2026-11-23').items,
    ).toEqual([]);
    expect(spanOf(mail, 'steht nicht in der Mail')).toBeNull();
  });
});
