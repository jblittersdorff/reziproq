import { describe, expect, it } from 'vitest';
import { dueRuns, nextMorningRun } from './demo-clock.js';

// DM-01 (K1-g.1), T1-DM5: Die Demo-Uhr führt beim Vorrücken alle fälligen Läufe aus, in zeitlicher
// Reihenfolge, zu den Zeiten des Betriebs in Berlin (Sommer- und Winterzeit eingerechnet).

const at = (iso: string) => new Date(iso);
const times = (runs: { key: string; at: Date }[], key: string) =>
  runs.filter((run) => run.key === key).map((run) => run.at.toISOString());

describe('Zeitplan der Demo-Uhr', () => {
  it('von Mo 23.11., 07:30 bis Fr 04.12., 07:30: jeder Lauf zu seiner Zeit, in Reihenfolge', () => {
    const runs = dueRuns(at('2026-11-23T06:30:00Z'), at('2026-12-04T06:30:00Z'));
    // Triage 06:00 ab Di 24.11., Hinweise 07:30 ab Di 24.11. bis zum Ziel, Wertfinder am 01.12.
    expect(times(runs, 'triage')).toHaveLength(11);
    expect(times(runs, 'triage')[0]).toBe('2026-11-24T05:00:00.000Z');
    expect(times(runs, 'hinweise')).toHaveLength(11);
    expect(times(runs, 'hinweise').at(-1)).toBe('2026-12-04T06:30:00.000Z');
    expect(times(runs, 'wertfinder')).toEqual(['2026-12-01T04:00:00.000Z']);
    // K2-b.6: Zusagen nachhalten um 06:00 wie die Triage
    expect(times(runs, 'nachhalten')).toEqual(times(runs, 'triage'));
    // Das Briefing an jedem Haltepunkt, vor Zusagen nachhalten und der Triage
    expect(times(runs, 'briefing')).toHaveLength(23);
    expect(runs.slice(0, 3).map((run) => run.key)).toEqual(['briefing', 'nachhalten', 'triage']);
    const ordered = runs.map((run) => run.at.getTime());
    expect(ordered).toEqual([...ordered].sort((a, b) => a - b));
  });

  it('eine Stunde weiter ohne Lauf dazwischen: nur das Briefing am Ziel', () => {
    expect(dueRuns(at('2026-11-23T07:00:00Z'), at('2026-11-23T08:00:00Z'))).toEqual([
      { key: 'briefing', at: at('2026-11-23T08:00:00Z') },
    ]);
  });

  it('Neuer Tag: der nächste 06:00-Lauf in Berlin, auch über die Umstellung auf Sommerzeit', () => {
    expect(nextMorningRun(at('2026-11-23T06:30:00Z')).toISOString()).toBe(
      '2026-11-24T05:00:00.000Z',
    );
    expect(nextMorningRun(at('2026-11-24T04:00:00Z')).toISOString()).toBe(
      '2026-11-24T05:00:00.000Z',
    );
    // 28.03.2027: 06:00 ist schon Sommerzeit (04:00 UTC)
    expect(nextMorningRun(at('2027-03-27T06:30:00Z')).toISOString()).toBe(
      '2027-03-28T04:00:00.000Z',
    );
  });
});
