import type { RelationshipRow } from '@reziproq/shared';
import { describe, expect, it } from 'vitest';
import {
  chipCounts,
  chipRows,
  moreFilterCount,
  moreFiltered,
  relationshipSearchSchema,
  sortedRows,
  spendTotals,
  topSegmentKey,
} from './relationship-view';

// BZ-01 (K2-b.4): Regeln der Linse Liste ohne Oberfläche

const row = (name: string, extra: Partial<RelationshipRow> = {}): RelationshipRow => ({
  relationshipId: `00000000-0000-7000-8000-${name.padStart(12, '0')}`,
  name,
  status: 'active',
  country: 'DE',
  materialGroup: null,
  spend: null,
  reason: null,
  attention: 0,
  segment: null,
  disputed: false,
  quota: null,
  isMine: false,
  isFocus: false,
  openCommitments: 0,
  businessUnitIds: [],
  materialGroupIds: [],
  targetType: null,
  categorySegments: [],
  ...extra,
});
const eur = (mio: number) => ({ amountCents: mio * 100_000_000, currency: 'EUR' });

describe('Adresse der Liste', () => {
  it('nimmt gültige Werte und lässt ungültige weg', () => {
    expect(
      relationshipSearchSchema.parse({
        filter: 'meine',
        sortierung: 'spend',
        portfolio: 1,
        beendet: 1,
        wg: 'g1',
      }),
    ).toEqual({ filter: 'meine', sortierung: 'spend', portfolio: 1, beendet: 1, wg: 'g1' });
    expect(
      relationshipSearchSchema.parse({
        filter: 'keiner',
        sortierung: 'name',
        portfolio: 'ja',
        linse: 'matrix',
        suche: 'guss',
      }),
    ).toEqual({});
  });

  it('zählt die gesetzten Filter unter „Mehr Filter“', () => {
    expect(moreFilterCount({})).toBe(0);
    expect(moreFilterCount({ filter: 'meine', sortierung: 'spend' })).toBe(0);
    expect(moreFilterCount({ portfolio: 1, beendet: 1, segment: 'ohne', typ: '3-3' })).toBe(4);
  });
});

describe('Filter', () => {
  const rows = [
    row('1', { segment: { key: '3-3', name: 'Strategisch' }, isMine: true, isFocus: true }),
    row('2', { disputed: true, segment: { key: '3-1', name: 'Entwickeln' }, openCommitments: 2 }),
    row('3', { materialGroupIds: ['sub'], businessUnitIds: ['bu'], isMine: true }),
    row('4', { targetType: { key: '3-3', name: 'Strategisch' }, materialGroupIds: ['other'] }),
  ];
  const groups = [
    { id: 'top', name: 'Guss', parentId: null },
    { id: 'sub', name: 'Sandguss', parentId: 'top' },
    { id: 'other', name: 'Kunststoff', parentId: null },
  ];
  const names = (list: RelationshipRow[]) => list.map((entry) => entry.name);

  it('Segment, strittig und ohne Segment', () => {
    expect(names(moreFiltered(rows, { segment: '3-3' }))).toEqual(['1']);
    expect(names(moreFiltered(rows, { segment: 'strittig' }))).toEqual(['2']);
    expect(names(moreFiltered(rows, { segment: 'ohne' }))).toEqual(['3', '4']);
  });

  it('Warengruppe mit Untergruppen, Soll-Typ und Business Unit, auch zusammen', () => {
    expect(names(moreFiltered(rows, { wg: 'top' }, groups))).toEqual(['3']);
    expect(names(moreFiltered(rows, { wg: 'other' }, groups))).toEqual(['4']);
    expect(names(moreFiltered(rows, { typ: '3-3' }))).toEqual(['4']);
    expect(names(moreFiltered(rows, { bu: 'bu', wg: 'top' }, groups))).toEqual(['3']);
    expect(moreFiltered(rows, { bu: 'bu', typ: '3-3' })).toEqual([]);
  });

  it('Chips: Meine, Strategisch, Offene Zusagen mit Zahl', () => {
    expect(names(chipRows(rows, 'meine'))).toEqual(['1', '3']);
    expect(names(chipRows(rows, 'strategisch'))).toEqual(['1']);
    expect(names(chipRows(rows, 'offene-zusagen'))).toEqual(['2']);
    expect(chipCounts(rows)).toEqual({ alle: 4, meine: 2, strategisch: 1, 'offene-zusagen': 1 });
  });
});

describe('Sortierung und Summen', () => {
  it('nach Aufmerksamkeit bleibt die Folge der API; nach Spend der größte zuerst, beendete zuletzt', () => {
    const rows = [
      row('a', { spend: eur(1), attention: 5 }),
      row('b', { spend: eur(4), status: 'ended' }),
      row('c', { spend: eur(3) }),
      row('d'),
    ];
    expect(sortedRows(rows, 'aufmerksamkeit')).toBe(rows);
    expect(sortedRows(rows, 'spend').map((entry) => entry.name)).toEqual(['c', 'a', 'd', 'b']);
  });

  it('das Feld mit beiden höchsten Stufen, für 3 × 3 und 2 × 2', () => {
    const types = (keys: string[]) => ({
      businessUnits: [],
      materialGroups: [],
      targetTypes: keys.map((key) => ({ key, name: key })),
    });
    expect(topSegmentKey(types(['3-3', '3-1', '1-1']))).toBe('3-3');
    expect(topSegmentKey(types(['2-2', '2-1', '1-2', '1-1']))).toBe('2-2');
    expect(topSegmentKey(types([]))).toBeNull();
  });

  it('summiert Spend je Währung', () => {
    expect(
      spendTotals([
        row('a', { spend: eur(1) }),
        row('b', { spend: { amountCents: 5, currency: 'USD' } }),
        row('c', { spend: eur(2) }),
        row('d'),
      ]),
    ).toEqual([eur(3), { amountCents: 5, currency: 'USD' }]);
  });
});
