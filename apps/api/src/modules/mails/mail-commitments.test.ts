import { describe, expect, it } from 'vitest';
import {
  type OpenCommitment,
  replacedBy,
  replyText,
  replyVariant,
  resolveCommitments,
} from './mail-commitments.js';
import { parseMailLocally } from './mail-extract.js';

// PO-01 (K2-d.3): Person, Ersatz (E-K2-2) und Antwortentwurf zu den Zusagen aus der Mail von Kim
// Kaiser, mit offenen Zusagen wie im Demo-Mandanten Hollmann.
const body =
  'Hallo Herr von Blittersdorff, die Musterteile Starrflex können wir bis 11.12. liefern, wenn wir Ihre Zeichnung Rev. C bis 30.11. haben. Den 8D-Bericht zur Charge 4711 schickt Herr Ott bis Freitag. Viele Grüße Kim Kaiser';
const open: OpenCommitment[] = [
  { id: 'c-8d', title: '8D-Bericht Charge 4711', side: 'supplier', dueOn: '2026-11-05' },
  { id: 'c-muster', title: 'Musterteile Starrflex liefern', side: 'supplier', dueOn: '2026-12-15' },
  { id: 'c-prognose', title: 'Prognose monatlich teilen', side: 'buyer', dueOn: '2026-12-15' },
];
const context = {
  body,
  sender: { name: 'Kim Kaiser', email: 'kim.kaiser@rheintal.example' },
  contacts: [
    { name: 'Kim Kaiser', email: 'kim.kaiser@rheintal.example' },
    { name: 'Nils Ott', email: 'nils.ott@rheintal.example' },
  ],
  filer: { userId: 'hollmann-jan-luka', name: 'Jan-Luka von Blittersdorff' },
  open,
};

describe('Zusagen aus der Mail auflösen (PO-01)', () => {
  it('Person, Ersatz und Textstelle je Zusage', () => {
    const commitments = resolveCommitments(parseMailLocally(body, '2026-11-23').items, context);
    expect(
      commitments.map((entry) => [entry.title, entry.ownerName, entry.replaces?.id ?? null]),
    ).toEqual([
      ['Musterteile Starrflex', 'Kim Kaiser', 'c-muster'],
      ['Zeichnung Rev. C', 'Jan-Luka von Blittersdorff', null],
      ['8D-Bericht Charge 4711', 'Nils Ott', 'c-8d'],
    ]);
    // Die eigene Seite trägt die Person mit Konto; beim Lieferanten nur der Name
    expect(commitments.map((entry) => entry.ownerUserId)).toEqual([
      null,
      'hollmann-jan-luka',
      null,
    ]);
    expect(commitments.every((entry) => entry.span !== null)).toBe(true);
  });

  it('Ersatz nur für dieselbe Seite und mit genug gemeinsamen Wörtern', () => {
    expect(replacedBy({ title: 'Zeichnung Rev. C', side: 'buyer' }, open)).toBeNull();
    expect(replacedBy({ title: '8D-Bericht Charge 4711', side: 'buyer' }, open)).toBeNull();
    expect(replacedBy({ title: 'Lieferung Gussteile', side: 'supplier' }, open)).toBeNull();
    expect(replacedBy({ title: 'Prognose monatlich teilen', side: 'buyer' }, open)?.id).toBe(
      'c-prognose',
    );
  });

  it('die Antwort nennt alle Zusagen und rät keine Anrede', () => {
    const commitments = resolveCommitments(parseMailLocally(body, '2026-11-23').items, context);
    const text = replyText({
      sender: 'Kim Kaiser',
      commitments,
      signer: 'Jan-Luka von Blittersdorff',
    });
    expect(text.startsWith('Guten Tag Kim Kaiser,')).toBe(true);
    expect(text).not.toMatch(/Herr Kaiser|Frau Kaiser/);
    expect(text).toContain('- Musterteile Starrflex bis Fr 11.12. (Kim Kaiser)');
    expect(text).toContain('- 8D-Bericht Charge 4711 bis Fr 27.11. (Nils Ott)');
    expect(text).toContain('- Zeichnung Rev. C bis Mo 30.11. (Jan-Luka von Blittersdorff)');
    expect(text.endsWith('Viele Grüße\nJan-Luka von Blittersdorff')).toBe(true);
  });
});

describe('Antwort in anderem Ton (PO-01, K2-d.3b)', () => {
  const commitments = resolveCommitments(parseMailLocally(body, '2026-11-23').items, context);
  const variant = (value: 'kuerzer' | 'foermlicher' | 'englisch') =>
    replyVariant({
      sender: 'Kim Kaiser',
      commitments,
      signer: 'Jan-Luka von Blittersdorff',
      variant: value,
    });

  it('kürzer, förmlicher und auf Englisch, mit allen Zusagen und ohne geratene Anrede', () => {
    expect(variant('kuerzer')).toContain(
      'danke, so halten wir es fest: Musterteile Starrflex bis Fr 11.12.; 8D-Bericht Charge 4711 bis Fr 27.11.; Zeichnung Rev. C bis Mo 30.11. Bitte kurz über den Link bestätigen.',
    );
    expect(variant('foermlicher')).toContain('Mit freundlichen Grüßen\nJan-Luka von Blittersdorff');
    expect(variant('foermlicher')).toContain(
      '- 8D-Bericht Charge 4711 bis Fr 27.11., verantwortlich Nils Ott',
    );
    expect(variant('englisch')).toContain('- Musterteile Starrflex by Fri 11 Dec (Kim Kaiser)');
    expect(variant('englisch').startsWith('Hello Kim Kaiser,')).toBe(true);
    for (const text of [variant('kuerzer'), variant('foermlicher'), variant('englisch')]) {
      expect(text).not.toMatch(/Herr Kaiser|Frau Kaiser|Mr |Ms /);
    }
  });
});
