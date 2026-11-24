import { schema } from '@reziproq/db';
import {
  bindingScopes,
  effectiveLevel,
  shareTool,
  workerByKey,
  workerLevels,
  workers,
} from '@reziproq/shared';
import { describe, expect, it } from 'vitest';
import { meetingBrief } from './system-agents.js';

// MA-01 (Paket K1-a, Daten): Registry der Aufgaben von Reziproq. Die Seite Mein Agent und die
// Leitplanken-Tests je Werkzeug folgen in K1-f; hier gilt, dass die Daten in sich stimmen.

describe('MA-01 Registry der Aufgaben', () => {
  it('kennt alle Aufgaben aus der Tabelle in MA-01, jede genau einmal', () => {
    expect(workers.map((worker) => worker.key)).toEqual([
      'inbox',
      'commitment_followup',
      'meeting_brief',
      'meeting_capture',
      'deck_build',
      'import_assign',
      'rating_prefill',
      'feedback',
      'segment_suggest',
      'early_warning',
      'value_finder',
      'value_booking',
      'value_report',
      'routine_replies',
      'deal_check',
      'strategy_update',
      'market_signals',
    ]);
  });

  it('die Startstufe ist erlaubt, und die Stufen sind dieselben wie in der Datenbank', () => {
    expect([...schema.workerLevels]).toEqual([...workerLevels]);
    for (const worker of workers) {
      expect(worker.allowedLevels.length, worker.key).toBeGreaterThan(0);
      expect(worker.allowedLevels, worker.key).toContain(worker.defaultLevel);
      expect(worker.reviewSeconds, worker.key).toBeGreaterThan(0);
    }
  });

  it('jedes bindende Werkzeug bindet intern oder gegenüber, jedes andere bindet niemanden (G-5, KA-01)', () => {
    for (const tool of [...workers.flatMap((worker) => worker.tools), shareTool]) {
      expect(bindingScopes).toContain(tool.bindingScope);
      if (tool.binding) expect(tool.bindingScope, tool.key).not.toBe('keiner');
      else expect(tool.bindingScope, tool.key).toBe('keiner');
    }
    // Leitplanken aus MA-01: Zusage im Namen des Käufers, Freigaben, Wert bestätigen, Teilen in die
    // Mitte, Deal senden oder bestätigen sind bindend.
    const binding = new Set(
      [...workers.flatMap((worker) => worker.tools), shareTool]
        .filter((tool) => tool.binding)
        .map((tool) => tool.key),
    );
    for (const key of [
      'commitment.create_buyer',
      'mail.send',
      'value.release',
      'value.confirm',
      'share.to_shared',
      'deal.send',
      'deal.confirm',
      'strategy.release',
    ]) {
      expect(binding.has(key), key).toBe(true);
    }
  });

  it('bestehende Systemagenten haben ihren Platz in der Registry', () => {
    const existing = workers.flatMap((worker) => (worker.existing ? [worker.existing] : []));
    // Systemvorlagen (KI-04) und Gateway-Funktionen, die heute schon laufen
    expect(existing).toContain(meetingBrief.key);
    for (const key of ['value_finder', 'market_analysis', 'hint_explainer', 'import_assist']) {
      expect(existing, key).toContain(key);
    }
  });

  it('ohne gültige Einstellung gilt die Startstufe; eine nicht erlaubte Stufe gilt nicht', () => {
    const brief = workerByKey('meeting_brief');
    if (!brief) throw new Error('meeting_brief fehlt');
    expect(effectiveLevel(brief, null)).toBe('prepare');
    expect(effectiveLevel(brief, 'suggest')).toBe('suggest');
    expect(effectiveLevel(brief, 'do')).toBe('prepare');
  });
});
