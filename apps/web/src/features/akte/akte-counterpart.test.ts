import { describe, expect, it } from 'vitest';
import { akteCounterpartSample } from '@/testing/akte-counterpart-sample';
import { excerpt, kindCounts, uninvited, waitingItems } from './akte-counterpart';

// AK-01 (K2-c.4): Zahlen der Sicht Von <Gegenüber>, aus denen die Sätze entstehen (G-6).

describe('Von <Gegenüber>: Arten, Wartendes, Ansprechpartner ohne Einladung', () => {
  const { view } = akteCounterpartSample();

  it('zählt je Art in fester Reihenfolge, ohne leere Arten', () => {
    expect(kindCounts(view.items)).toEqual([
      { kind: 'kpi_value', count: 2 },
      { kind: 'topic', count: 2 },
      { kind: 'comment', count: 1 },
      { kind: 'signature', count: 1 },
      { kind: 'business_update', count: 1 },
    ]);
    expect(kindCounts(view.items.filter((item) => item.kind === 'comment'))).toEqual([
      { kind: 'comment', count: 1 },
    ]);
  });

  it('wartet: Kennzahlwerte ohne eigene Bestätigung und vorgeschlagene Themen, sonst nichts', () => {
    expect(waitingItems(view.items).map((item) => item.id)).toEqual([
      '00000000-0000-7000-8000-000000001901',
      '00000000-0000-7000-8000-000000001709',
    ]);
  });

  it('ohne Einladung: ohne Personen im Team, höchstens drei Namen', () => {
    expect(
      uninvited(
        [{ name: 'Kim Kaiser' }, { name: 'Nils Ott' }, { name: 'Tom Weber' }],
        [{ name: 'kim kaiser' }],
      ),
    ).toEqual({ names: ['Nils Ott', 'Tom Weber'], more: 0 });
    expect(
      uninvited(
        ['A', 'B', 'C', 'D', 'E'].map((name) => ({ name })),
        [],
      ),
    ).toEqual({ names: ['A', 'B', 'C'], more: 2 });
  });

  it('kürzt an einer Wortgrenze mit Auslassung, kurze Texte bleiben', () => {
    expect(excerpt('Kurz und  klar')).toBe('Kurz und klar');
    expect(excerpt('Können wir die Kapazitätsplanung 2028 im JBP vorziehen?', 40)).toBe(
      'Können wir die Kapazitätsplanung 2028 …',
    );
  });
});

describe('Datum einer Zeile', () => {
  it('ohne Jahr im laufenden Jahr, mit Jahr aus einem anderen', async () => {
    const { dayMonth } = await import('./akte-view');
    const now = new Date('2026-11-27T10:00:00Z');
    expect(dayMonth('2026-11-18T15:20:00Z', 'de', now)).toBe('18.11.');
    expect(dayMonth('2025-12-08T11:00:00Z', 'de', now)).toBe('08.12.2025');
    expect(dayMonth('2025-12-08T11:00:00Z', 'en', now)).toBe('08/12/2025');
  });
});
