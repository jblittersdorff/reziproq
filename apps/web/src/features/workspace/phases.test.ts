import type { SupplierCycle } from '@reziproq/shared';
import { describe, expect, it } from 'vitest';
import { cyclePhases } from './phases';

// NAV-10 1.1, Seitenregel 2: vier Phasen aus den sieben Schritten des Jahreszyklus (ZYK-01).
const cycle = (statuses: SupplierCycle['steps'][number]['status'][]): SupplierCycle => ({
  id: '0190a0a0-0000-7000-8000-000000000002',
  label: '2026',
  startedAt: '2026-01-01T00:00:00.000Z',
  jbpDate: '2026-12-04',
  schedule: [],
  steps: (
    ['segment', 'feedback', 'touchpoints', 'supplierPlan', 'jbp', 'scorecard', 'execution'] as const
  ).map((key, index) => ({
    key,
    status: statuses[index] ?? 'open',
    href: `/s/${key}`,
    dueDate: null,
  })),
});

describe('Phasen im Überblick des Lieferanten', () => {
  it('erledigt, jetzt und offen folgen den Schritten; das Glied öffnet den offenen Schritt', () => {
    const phases = cyclePhases(
      cycle(['completed', 'completed', 'in_progress', 'open', 'open', 'open', 'open']),
    );
    expect(phases.map((phase) => [phase.key, phase.state, phase.href])).toEqual([
      ['segment', 'done', '/s/segment'],
      ['plan', 'current', '/s/touchpoints'],
      ['jbp', 'open', '/s/jbp'],
      ['results', 'open', '/s/scorecard'],
    ]);
  });

  it('eine ganz erledigte Phase öffnet ihren letzten Schritt; ohne Seite kein Ziel', () => {
    const all = cycle(['completed', 'completed', 'completed', 'completed', 'overdue']);
    const phases = cyclePhases({
      ...all,
      steps: all.steps.map((step) =>
        step.key === 'scorecard' || step.key === 'execution' ? { ...step, href: null } : step,
      ),
    });
    expect(phases.map((phase) => [phase.key, phase.state, phase.href])).toEqual([
      ['segment', 'done', '/s/segment'],
      ['plan', 'done', '/s/supplierPlan'],
      ['jbp', 'current', '/s/jbp'],
      ['results', 'open', null],
    ]);
  });
});
