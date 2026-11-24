import { sentenceBacked } from '@reziproq/shared';
import { describe, expect, it } from 'vitest';
import { berlinHour, nextMorning } from './berlin.js';
import {
  type DraftRow,
  dueSentence,
  fromDraft,
  fromDue,
  shownSentence,
  sourceIdOf,
  templateOf,
} from './triage.js';

// HE-01 Dienst 1, 2 und 4 (K1-c): Abbildung der Ergebnisse, Satz mit Zahl, „Später“ bis 07:00.

const draft = (kind: string, content = 'Text', side?: 'buyer' | 'supplier' | null): DraftRow => ({
  id: '00000000-0000-7000-8000-0000000000d1',
  kind,
  objectType: 'meeting',
  objectId: '00000000-0000-7000-8000-0000000000e1',
  relationshipId: '00000000-0000-7000-8000-0000000000f1',
  subject: null,
  content:
    side === undefined
      ? content
      : JSON.stringify({
          kind: 'commitment',
          title: 'Muster bis Freitag',
          visibility: 'shared',
          quote: 'Wir schicken die Muster bis Freitag.',
          side,
          owner: null,
          ownerUnclear: true,
          dueOn: null,
          dateUnclear: true,
          addressee: null,
          commitmentId: null,
          commitmentTitle: null,
          proposal: null,
          goalKey: null,
          goalStatus: null,
        }),
  claims: [{ key: '1', text: 'Aussage' }],
  reviewSeconds: null,
  counterpart: 'Lieferant 1',
  href: '/lieferanten/00000000-0000-7000-8000-0000000000f1/aktivitaeten',
});

describe('Triage: Abbildung der Ergebnisse (HE-01)', () => {
  it('Frist und Freigabe sind Fokus, ein Entwurf ist Kurz prüfen', () => {
    const due = (kind: 'action' | 'approval' | 'mention') =>
      fromDue(
        {
          id: '00000000-0000-7000-8000-0000000000a1',
          kind,
          supplier: 'Lieferant 1',
          detail: 'Werkzeugkosten senken',
          dueDate: '2026-11-20',
          href: '/lieferanten/00000000-0000-7000-8000-0000000000f1/umsetzung/massnahmen',
        },
        '2026-11-24',
        'de',
      );
    expect(due('action')).toMatchObject({
      level: 'focus',
      kind: 'decision',
      title: 'Werkzeugkosten senken',
      relationshipId: '00000000-0000-7000-8000-0000000000f1',
      objectId: '00000000-0000-7000-8000-0000000000a1',
      sentence: 'Seit 4 Tagen überfällig.',
    });
    expect(due('approval').kind).toBe('approval');
    expect(due('mention').kind).toBe('conversation');
    expect(fromDraft(draft('plan_summary'), 'de')).toMatchObject({
      level: 'review',
      kind: 'draft',
    });
  });

  it('Nie in Kurz prüfen: Teilen ohne Bestätigung und Zusagen der eigenen Seite (E-K0-27)', () => {
    expect(fromDraft(draft('share_request'), 'de')).toMatchObject({
      level: 'focus',
      kind: 'approval',
    });
    expect(fromDraft(draft('capture_commitment', '', 'buyer'), 'de')).toMatchObject({
      level: 'focus',
      kind: 'decision',
      title: 'Muster bis Freitag',
    });
    // Unklare Seite gilt als eigene Seite; die Zusage des Lieferanten bleibt in Kurz prüfen.
    expect(fromDraft(draft('capture_commitment', '', null), 'de').level).toBe('focus');
    expect(fromDraft(draft('capture_commitment', '', 'supplier'), 'de').level).toBe('review');
  });

  it('Ein Ergebnis hat bei jedem Lauf dieselbe Quelle', () => {
    expect(sourceIdOf('due', 'action:x')).toBe(sourceIdOf('due', 'action:x'));
    expect(sourceIdOf('due', 'action:x')).not.toBe(sourceIdOf('due', 'rating:x'));
    expect(sourceIdOf('due', 'action:x')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe('Satz mit Zahl in der Triage (T1-HE2, TN-10)', () => {
  it('Jeder Satz zur Frist ist durch seine Fakten belegt, in beiden Sprachen', () => {
    for (const locale of ['de', 'en'] as const) {
      for (let offset = -12; offset <= 12; offset += 1) {
        const due = new Date(Date.UTC(2026, 10, 24 + offset)).toISOString().slice(0, 10);
        const { sentence, facts } = dueSentence(locale, due, '2026-11-24', {
          objectType: 'action',
          objectId: null,
        });
        expect(sentenceBacked(sentence, facts)).toBe(true);
      }
    }
  });

  it('Eine unbelegte Zahl wird nie angezeigt; dann gilt die Vorlage ohne Zahl', () => {
    const facts = [
      { key: 'overdue_days', value: 3, source: { objectType: 'action', label: 'Frist' } },
    ];
    expect(shownSentence('Seit 30 Tagen überfällig.', facts, 'decision', 'de')).toBe(
      templateOf('de', 'decision'),
    );
    expect(shownSentence('Waiting 7 days.', [], 'approval', 'en')).toBe(
      'Waiting for your approval.',
    );
    expect(shownSentence('Seit 3 Tagen überfällig.', facts, 'decision', 'de')).toBe(
      'Seit 3 Tagen überfällig.',
    );
  });
});

describe('„Später“ bis 07:00 des nächsten Tages in Berlin (HE-01 Dienst 4)', () => {
  it('rechnet Winter- und Sommerzeit ein', () => {
    // Dienstag 24.11., 23:30 in Berlin: weiter bis Mittwoch 07:00 (Winterzeit, UTC+1)
    expect(nextMorning(new Date('2026-11-24T22:30:00Z')).toISOString()).toBe(
      '2026-11-25T06:00:00.000Z',
    );
    // Mittwoch 25.11., 00:30 in Berlin: schon der neue Tag, also Donnerstag 07:00
    expect(nextMorning(new Date('2026-11-24T23:30:00Z')).toISOString()).toBe(
      '2026-11-26T06:00:00.000Z',
    );
    // Samstag 28.03.2026: In der Nacht beginnt die Sommerzeit, Sonntag 07:00 ist 05:00 UTC
    expect(nextMorning(new Date('2026-03-28T12:00:00Z')).toISOString()).toBe(
      '2026-03-29T05:00:00.000Z',
    );
    expect(berlinHour(new Date('2026-11-24T05:30:00Z'))).toBe(6);
    expect(berlinHour(new Date('2026-07-01T04:30:00Z'))).toBe(6);
  });
});
