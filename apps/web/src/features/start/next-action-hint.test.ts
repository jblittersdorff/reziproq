import type { NextAction } from '@reziproq/shared';
import { describe, expect, it } from 'vitest';
import { de } from '@/locales/de';
import { en } from '@/locales/en';
import { dueTitle } from './due-title';
import { myDayMessages } from './my-day-messages';
import { actionLabel, nextKicker } from './next-action';

// HE-01 (K1-c): „Als Nächstes“ liest aus der Triage und kann ein offener Hinweis sein.

const next: NextAction = {
  scope: 'global',
  item: {
    id: 'hint-1',
    kind: 'hint',
    supplier: 'Rheintal Elektronik',
    detail: 'performance_drop',
    dueDate: '2026-11-24',
    href: '/hinweise?hinweis=1',
  },
  overdueDays: 0,
  minutes: 5,
};

describe('„Als Nächstes“ mit einem Hinweis (HE-01)', () => {
  it('nennt die Regel, keine Frist und führt zum Hinweis, auf Deutsch und Englisch', () => {
    expect(dueTitle(de, next.item)).toBe(`Hinweis entscheiden: ${de.hints.rules.performance_drop}`);
    expect(dueTitle(en, next.item)).toBe(`Decide on a hint: ${en.hints.rules.performance_drop}`);
    expect(nextKicker(myDayMessages.de, next, 'de-DE')).toBe('Als Nächstes · 5 Min.');
    expect(nextKicker(myDayMessages.en, next, 'en-GB')).toBe('Up next · 5 min.');
    expect(actionLabel(myDayMessages.de, next.item)).toBe('Hinweis ansehen');
    expect(actionLabel(myDayMessages.en, next.item)).toBe('View hint');
  });
});
