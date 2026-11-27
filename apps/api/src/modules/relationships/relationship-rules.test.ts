import type { RelationshipHint, SideQuote } from '@reziproq/shared';
import { describe, expect, it } from 'vitest';
import {
  type PortfolioEntry,
  type RowInput,
  rankRows,
  reasonOf,
  segmentFields,
  shareOf,
  strongestHints,
  summaryOf,
  totalsOf,
} from './relationship-rules.js';

// BZ-01 (K2-b.3): Regeln der Seite Lieferanten ohne Datenbank

let next = 0;
const id = () => `00000000-0000-7000-8000-${String(++next).padStart(12, '0')}`;
const eur = (mio: number) => ({ amountCents: Math.round(mio * 100_000_000), currency: 'EUR' });
const quote = (kept: number, due: number): SideQuote => ({
  kept,
  due,
  percent: due === 0 ? null : Math.round((kept / due) * 100),
});
const hint = (severity: RelationshipHint['severity']): RelationshipHint => ({
  id: id(),
  ruleKey: 'performance_drop',
  severity,
  status: 'open',
  title: null,
  metric: 'Liefertreue',
  value: '86 %',
});
const row = (overrides: Partial<RowInput> = {}): RowInput => ({
  relationshipId: id(),
  name: 'Lieferant',
  status: 'active',
  country: 'DE',
  materialGroup: null,
  spend: eur(1),
  isMine: false,
  isFocus: false,
  segment: { key: '2-2', name: 'Strategisch' },
  disputed: false,
  quota: null,
  openCommitments: 0,
  overdue: null,
  hint: null,
  ...overrides,
});

describe('BZ-01 Aufmerksamkeit: der stärkste Grund zählt', () => {
  it('überfällige Zusage vor Hinweis hoch vor strittig vor ohne Bewertung', () => {
    const overdue = { count: 2, title: '8D-Bericht' };
    expect(reasonOf(row({ overdue, hint: hint('high'), disputed: true }))).toEqual({
      reason: { kind: 'overdue', count: 2, title: '8D-Bericht' },
      attention: 5,
    });
    expect(reasonOf(row({ hint: hint('high'), disputed: true })).attention).toBe(4);
    expect(reasonOf(row({ disputed: true, segment: null }))).toEqual({
      reason: { kind: 'disputed' },
      attention: 3,
    });
    expect(reasonOf(row({ segment: null }))).toEqual({ reason: { kind: 'unrated' }, attention: 2 });
    expect(reasonOf(row())).toEqual({ reason: null, attention: 0 });
  });

  it('bei Gleichstand von Hinweis mittel und strittig steht „strittig“ in der grauen Zeile', () => {
    expect(reasonOf(row({ hint: hint('medium'), disputed: true }))).toEqual({
      reason: { kind: 'disputed' },
      attention: 3,
    });
  });

  it('ein Hinweis geringer Schwere steht in der grauen Zeile, hebt die Beziehung aber nicht an', () => {
    expect(reasonOf(row({ hint: hint('low') }))).toMatchObject({
      reason: { kind: 'hint' },
      attention: 0,
    });
    // Ohne Segment zählt „ohne Bewertung“ mehr als der Hinweis
    expect(reasonOf(row({ hint: hint('low'), segment: null }))).toMatchObject({
      reason: { kind: 'unrated' },
      attention: 2,
    });
  });

  it('sortiert nach Punkten, dann nach Spend, dann nach Name; ohne Spend zuletzt', () => {
    const rows = rankRows([
      row({ name: 'Ohne Spend', spend: null }),
      row({ name: 'Klein', spend: eur(0.5) }),
      row({ name: 'Bertram', spend: eur(2) }),
      row({ name: 'Anders', spend: eur(2) }),
      row({ name: 'Strittig', spend: eur(0.1), disputed: true }),
      row({ name: 'Überfällig', spend: eur(0.2), overdue: { count: 1, title: 'x' } }),
    ]);
    expect(rows.map((entry) => entry.name)).toEqual([
      'Überfällig',
      'Strittig',
      'Anders',
      'Bertram',
      'Klein',
      'Ohne Spend',
    ]);
  });

  it('nimmt je Beziehung den Hinweis mit der höchsten Schwere, dann den mit dem höheren score', () => {
    const relationshipId = id();
    const other = id();
    const best = strongestHints([
      { ...hint('medium'), relationshipId, score: 900 },
      { ...hint('high'), relationshipId, score: 10, title: 'hoch' },
      { ...hint('high'), relationshipId, score: 5 },
      { ...hint('low'), relationshipId: other, score: 1 },
      { ...hint('low'), relationshipId: other, score: 7, title: 'mehr score' },
      { ...hint('high'), relationshipId: null, score: 99 },
    ]);
    expect(best.size).toBe(2);
    expect(best.get(relationshipId)?.title).toBe('hoch');
    expect(best.get(other)?.title).toBe('mehr score');
    expect(best.get(relationshipId)).not.toHaveProperty('score');
  });
});

describe('BZ-01 Das Wichtigste der Liste', () => {
  it('zählt ab 10 Punkten Abstand als „deutlich besser“ und nennt Hakt, Fehlt und Info', () => {
    const low = row({
      name: 'Silesia',
      quota: { own: quote(5, 5), counterpart: quote(3, 5) },
      hint: hint('high'),
    });
    const gap = row({
      name: 'Rheintal',
      spend: eur(4.2),
      quota: { own: quote(9, 10), counterpart: quote(7, 9) },
      overdue: { count: 1, title: '8D-Bericht' },
    });
    const close = row({ name: 'Kessler', quota: { own: quote(9, 10), counterpart: quote(8, 10) } });
    const unrated = row({ name: 'Pearl River', spend: eur(5.64), segment: null });
    const summary = summaryOf([close, gap, low, unrated]);
    expect(summary.keptBetter).toBe(3);
    expect(summary.unrated).toEqual({
      relationshipId: unrated.relationshipId,
      name: 'Pearl River',
      spend: eur(5.64),
      largest: true,
    });
    expect(summary.rows).toEqual([
      {
        kind: 'counterpart_low',
        relationshipId: low.relationshipId,
        name: 'Silesia',
        kept: 3,
        due: 5,
        hint: low.hint,
      },
      {
        kind: 'unrated',
        relationshipId: unrated.relationshipId,
        name: 'Pearl River',
        spend: eur(5.64),
      },
      {
        kind: 'quota_gap',
        relationshipId: gap.relationshipId,
        name: 'Rheintal',
        own: 90,
        counterpart: 78,
        overdue: { count: 1, title: '8D-Bericht' },
      },
    ]);
    // 9 Punkte zählen nicht
    expect(
      summaryOf([row({ quota: { own: quote(10, 10), counterpart: quote(91, 100) } })]).keptBetter,
    ).toBe(0);
  });

  it('ohne Zusagen und ohne Lücken bleibt es leer; der größte ohne Segment ist nicht immer der größte', () => {
    expect(summaryOf([row()])).toEqual({ keptBetter: 0, unrated: null, rows: [] });
    const summary = summaryOf([row({ spend: eur(9) }), row({ name: 'Neu', segment: null })]);
    expect(summary.unrated).toMatchObject({ name: 'Neu', largest: false });
    expect(summary.rows).toEqual([expect.objectContaining({ kind: 'unrated', name: 'Neu' })]);
  });
});

describe('BZ-01 Linse Segmente', () => {
  const types = [
    { impactLevel: 1, qualityLevel: 1, name: 'Hebeln' },
    { impactLevel: 2, qualityLevel: 2, name: 'Strategisch' },
    { impactLevel: 1, qualityLevel: 2, name: 'Absichern' },
    { impactLevel: 2, qualityLevel: 1, name: 'Entwickeln' },
  ];
  const entry = (overrides: Partial<PortfolioEntry>): PortfolioEntry => ({
    relationshipId: id(),
    name: 'Lieferant',
    status: 'active',
    spend: eur(1),
    disputed: false,
    segmentKey: '2-2',
    ...overrides,
  });

  it('ordnet die Felder wie die Matrix und die Lieferanten: aktive zuerst, dann nach Spend', () => {
    const { fields, unrated } = segmentFields(types, [
      entry({ name: 'Import groß', status: 'draft', spend: eur(2.4) }),
      entry({ name: 'Aktiv klein', spend: eur(1.6) }),
      entry({ name: 'Aktiv groß', spend: eur(4.2) }),
      entry({ name: 'Hebel', segmentKey: '1-1', spend: { amountCents: 5, currency: 'USD' } }),
      entry({ name: 'Ohne', segmentKey: null, spend: eur(0.1) }),
      entry({ name: 'Altes Modell', segmentKey: '3-3', spend: eur(0.5) }),
    ]);
    expect(fields.map((field) => [field.name, field.count])).toEqual([
      ['Entwickeln', 0],
      ['Strategisch', 3],
      ['Hebeln', 1],
      ['Absichern', 0],
    ]);
    expect(fields[1]?.suppliers.map((supplier) => supplier.name)).toEqual([
      'Aktiv groß',
      'Aktiv klein',
      'Import groß',
    ]);
    expect(fields[1]?.spend).toEqual([eur(8.2)]);
    expect(fields[2]?.spend).toEqual([{ amountCents: 5, currency: 'USD' }]);
    // Kein Segment im aktiven Modell heißt ohne Bewertung, der größte zuerst
    expect(unrated.map((supplier) => supplier.name)).toEqual(['Altes Modell', 'Ohne']);
  });

  it('rechnet Anteile nur in einer gemeinsamen Währung', () => {
    expect(shareOf([eur(18.4)], [eur(38)])).toBe(48);
    expect(shareOf([eur(1)], [eur(1), { amountCents: 1, currency: 'USD' }])).toBeNull();
    expect(shareOf([], [eur(1)])).toBeNull();
    expect(totalsOf([eur(1), null, { amountCents: 3, currency: 'USD' }, eur(2)])).toEqual([
      eur(3),
      { amountCents: 3, currency: 'USD' },
    ]);
  });
});
