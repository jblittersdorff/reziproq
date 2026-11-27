import {
  levelRank,
  liveWorkers,
  orgWorkerState,
  resolveLevel,
  selectableLevels,
  type Worker,
  workerByKey,
  workerOfFeature,
  workers,
} from '@reziproq/shared';
import { describe, expect, it } from 'vitest';

// MA-01 (K1-f): Welche Stufe gilt? Die Wahl der Person oder die Startstufe; Obergrenze der
// Organisation und Mandat senken nur (G-5). Mein Agent bietet nur erlaubte Stufen an, die heute
// wirken. Ohne Datenbank: die Regeln selbst.

const task = (key: string): Worker => {
  const worker = workerByKey(key);
  if (!worker) throw new Error(`${key} fehlt`);
  return worker;
};

describe('MA-01 Stufen je Aufgabe', () => {
  it('wirksame Stufen sind erlaubt; jede Aufgabe, die es gibt, startet auf einer wirksamen Stufe', () => {
    for (const worker of workers) {
      for (const level of worker.liveLevels)
        expect(worker.allowedLevels, worker.key).toContain(level);
    }
    expect(liveWorkers.map((worker) => worker.key)).toEqual([
      'inbox',
      // K2-b.6: Zusagen nachhalten wirkt auf Erledigen (ZQ-01 Regel 5)
      'commitment_followup',
      'meeting_brief',
      'meeting_capture',
      'import_assign',
      'early_warning',
      'value_finder',
      'market_signals',
    ]);
    for (const worker of liveWorkers) {
      expect(worker.liveLevels, worker.key).toContain(worker.defaultLevel);
    }
  });

  it('jede Modellfunktion und jede Art von Entwurf gehört zu höchstens einer Aufgabe', () => {
    const features = workers.flatMap((worker) => worker.features ?? []);
    expect(new Set(features).size).toBe(features.length);
    const kinds = workers.flatMap((worker) => worker.draftKinds ?? []);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(workerOfFeature('mail_summary')?.key).toBe('inbox');
    expect(workerOfFeature('import_assist')?.key).toBe('import_assign');
    // Frag Reziproq und der Pre-Read-Entwurf auf der Terminseite (QBR-07) startet eine Person selbst;
    // sie sind keine Aufgabe und lassen sich nicht abschalten
    expect(workerOfFeature('prompt')).toBeUndefined();
    expect(workerOfFeature('pre_read')).toBeUndefined();
  });

  it('ohne eigene Wahl gilt die Startstufe; ist die Aufgabe aus, gibt es keine Stufe (T1-MA4)', () => {
    expect(resolveLevel(task('inbox'), { personal: null, enabled: true })).toBe('do');
    expect(resolveLevel(task('inbox'), { personal: 'prepare', enabled: true })).toBe('prepare');
    expect(resolveLevel(task('inbox'), { personal: 'do', enabled: false })).toBeNull();
  });

  it('T1-MA3: eine nicht erlaubte Stufe gilt nicht; ein Mandat hebt nie über Mein Agent', () => {
    // Termin-Briefing erlaubt nur Vorschlagen und Vorbereiten
    expect(resolveLevel(task('meeting_brief'), { personal: 'do', enabled: true })).toBe('prepare');
    // Mandat erlaubt Erledigen, die Person hat Vorbereiten gewählt: es bleibt Vorbereiten
    expect(
      resolveLevel(task('inbox'), { personal: 'prepare', enabled: true, mandateCap: 'do' }),
    ).toBe('prepare');
    // Mandat und Obergrenze senken
    expect(
      resolveLevel(task('inbox'), { personal: 'do', enabled: true, mandateCap: 'prepare' }),
    ).toBe('prepare');
    expect(resolveLevel(task('inbox'), { personal: 'do', enabled: true, orgCap: 'suggest' })).toBe(
      'suggest',
    );
    // Gilt keine wirksame Stufe unter der Grenze, arbeitet Reziproq nicht (kein Lauf)
    expect(
      resolveLevel(task('meeting_brief'), { personal: null, enabled: true, orgCap: 'suggest' }),
    ).toBeNull();
  });

  it('wählbar ist, was erlaubt ist, heute wirkt und unter der Obergrenze liegt', () => {
    expect(selectableLevels(task('inbox'), null)).toEqual(['suggest', 'prepare', 'do']);
    expect(selectableLevels(task('inbox'), 'prepare')).toEqual(['suggest', 'prepare']);
    // Termin-Briefing: Vorschlagen ist erlaubt, wirkt aber erst mit seinem Paket
    expect(selectableLevels(task('meeting_brief'), null)).toEqual(['prepare']);
    expect(selectableLevels(task('market_signals'), null)).toEqual(['suggest']);
    expect(levelRank('suggest')).toBeLessThan(levelRank('prepare'));
    expect(levelRank('prepare')).toBeLessThan(levelRank('do'));
  });

  it('KI-Einstellungen: ohne Eintrag gilt der Startwert; eine nicht erlaubte Obergrenze gilt nicht', () => {
    expect(orgWorkerState({}, task('inbox'))).toEqual({ enabled: true, cap: null });
    // Das Termin-Briefing schaltet ein Admin ein (KI-04, KI-07)
    expect(orgWorkerState({}, task('meeting_brief'))).toEqual({ enabled: false, cap: null });
    expect(orgWorkerState({ inbox: { enabled: false, cap: 'prepare' } }, task('inbox'))).toEqual({
      enabled: false,
      cap: 'prepare',
    });
    expect(orgWorkerState({ meeting_brief: { cap: 'do' } }, task('meeting_brief')).cap).toBeNull();
  });
});
