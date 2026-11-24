import { describe, expect, it } from 'vitest';
import {
  categoryOfHref,
  type DueItem,
  defaultOrgModules,
  endOfWeek,
  pickNextAction,
  relationshipOfHref,
  sortTimeline,
  type TimelineItem,
  withModules,
} from './index.js';

// NAV-10 1.1 / UX-20 Phase 2: Auswahl „Als Nächstes“ und Terminschiene als Funktionen im Code.
const rel = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const due = (id: string, dueDate: string, href = `/lieferanten/${rel}/plan`): DueItem => ({
  id,
  kind: 'commitment',
  supplier: 'Rheintal',
  detail: null,
  dueDate,
  href,
});

describe('pickNextAction', () => {
  const today = '2026-11-23';

  it('überfällig vor fällig heute vor später, unabhängig von der Wirkung', () => {
    const items = [due('later', '2026-11-25'), due('today', today), due('late', '2026-11-20')];
    expect(
      pickNextAction(items, today, { weight: (item) => (item.id === 'later' ? 9 : 0) })?.item.id,
    ).toBe('late');
    expect(pickNextAction(items.slice(0, 2), today)?.item.id).toBe('today');
  });

  it('innerhalb einer Stufe zuerst die größere Wirkung, dann die frühere Frist', () => {
    const items = [due('small', '2026-11-19'), due('big', '2026-11-21', `/lieferanten/${other}`)];
    const weight = (item: DueItem) => (relationshipOfHref(item.href) === other ? 100 : 1);
    expect(pickNextAction(items, today, { weight })?.item.id).toBe('big');
    expect(pickNextAction(items, today)?.item.id).toBe('small');
  });

  it('liefert Tage seit der Frist und den Zeitbedarf; ohne Kandidat null', () => {
    const next = pickNextAction([due('late', '2026-11-21')], today);
    expect(next).toMatchObject({ scope: 'global', overdueDays: 2, minutes: 5 });
    expect(pickNextAction([], today)).toBeNull();
    expect(
      pickNextAction([due('a', today)], today, { filter: (item) => item.id === 'b' }),
    ).toBeNull();
  });
});

describe('Ziele und Woche', () => {
  it('liest Beziehung und Warengruppe aus dem Ziel', () => {
    expect(relationshipOfHref(`/lieferanten/${rel}/plan/zusagen`)).toBe(rel);
    expect(relationshipOfHref(`/kunden/${rel}`)).toBe(rel);
    expect(relationshipOfHref('/einstellungen')).toBeNull();
    expect(categoryOfHref(`/warengruppen/${other}/strategie/3`)).toBe(other);
  });

  it('Diese Woche endet am Sonntag', () => {
    expect(endOfWeek('2026-11-23')).toBe('2026-11-29');
    expect(endOfWeek('2026-11-29')).toBe('2026-11-29');
  });
});

describe('Terminschiene', () => {
  const item = (
    id: string,
    source: TimelineItem['source'],
    kind: TimelineItem['kind'],
    date: string,
  ): TimelineItem => ({
    id,
    date,
    kind,
    source,
    title: id,
    counterpart: null,
    detail: null,
    startsAt: null,
    progress: null,
    href: '/x',
    relationshipId: null,
    categoryId: null,
  });

  it('ohne Modul keine Claims, keine Risiken, keine Vertragsfristen', () => {
    const items = [
      item('termin', 'meeting', 'meeting', '2026-11-24'),
      item('claim', 'claim', 'deadline', '2026-11-25'),
      item('risiko', 'risk', 'risk', '2026-11-26'),
      item('vertrag', 'contract', 'deadline', '2026-11-27'),
    ];
    expect(withModules(items, defaultOrgModules).map((entry) => entry.id)).toEqual(['termin']);
    expect(
      withModules(items, { ...defaultOrgModules, claims: true, risk: true, contract: true }),
    ).toHaveLength(4);
  });

  it('sortiert nach Datum und kürzt auf höchstens acht', () => {
    const items = Array.from({ length: 10 }, (_, index) =>
      item(
        `e${index}`,
        'commitment',
        'commitment',
        `2026-12-${String(20 - index).padStart(2, '0')}`,
      ),
    );
    const rail = sortTimeline(items, 8);
    expect(rail).toHaveLength(8);
    expect(rail[0]?.date).toBe('2026-12-11');
  });
});
