import type { CycleStepKey, SupplierCycle } from '@reziproq/shared';

// NAV-10 1.1, Seitenregel 2: Im Überblick zeigt die Schrittfolge vier Phasen (Segment, Plan, JBP,
// Ergebnisse). Sie fassen die sieben Schritte des Jahreszyklus (ZYK-01) zusammen; die Schritte
// selbst stehen eingeklappt darunter.

export const supplierPhases = ['segment', 'plan', 'jbp', 'results'] as const;
export type SupplierPhase = (typeof supplierPhases)[number];

const phaseOfStep: Record<CycleStepKey, SupplierPhase> = {
  segment: 'segment',
  feedback: 'plan',
  touchpoints: 'plan',
  supplierPlan: 'plan',
  jbp: 'jbp',
  scorecard: 'results',
  execution: 'results',
};

const openStatuses = ['open', 'in_progress', 'overdue'];

/** Index des aktuellen Schritts: der erste offene, laufende oder überfällige; -1 ohne */
export const currentStepIndex = (cycle: SupplierCycle) =>
  cycle.steps.findIndex((step) => openStatuses.includes(step.status));

export interface PhaseState {
  key: SupplierPhase;
  state: 'done' | 'current' | 'open';
  /** Seite des ersten offenen Schritts der Phase, sonst des letzten; null ohne Seite */
  href: string | null;
}

/**
 * Stand je Phase: erledigt, wenn alle Schritte erledigt sind; jetzt, wenn der aktuelle Schritt in
 * ihr liegt; sonst offen. Das Glied öffnet den Schritt, an dem in der Phase zu arbeiten ist.
 */
export function cyclePhases(cycle: SupplierCycle): PhaseState[] {
  const current = cycle.steps[currentStepIndex(cycle)];
  return supplierPhases.map((key) => {
    const steps = cycle.steps.filter((step) => phaseOfStep[step.key] === key);
    const done = steps.length > 0 && steps.every((step) => step.status === 'completed');
    const target =
      steps.find((step) => step.status !== 'completed' && step.href !== null) ??
      [...steps].reverse().find((step) => step.href !== null);
    return {
      key,
      state: done
        ? 'done'
        : current && phaseOfStep[current.key] === key
          ? 'current'
          : ('open' as const),
      href: target?.href ?? null,
    };
  });
}
