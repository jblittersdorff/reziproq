import type { Money } from '@reziproq/shared';

export interface BridgeLever {
  label: string;
  /** EBIT-Wirkung in Cent; Kostenvermeidung, Cash und strategischer Wert gehören nicht hierher. */
  amountCents: number;
}

export interface BridgeStep {
  label: string;
  kind: 'total' | 'increase' | 'decrease';
  startCents: number;
  endCents: number;
  deltaCents: number;
}

/** Baut die Schritte einer P&L-Brücke: Baseline → Hebel → realisierte Wirkung. */
export function buildBridge(
  baseline: Money & { label: string },
  levers: BridgeLever[],
  totalLabel: string,
): { steps: BridgeStep[]; total: Money } {
  for (const value of [baseline.amountCents, ...levers.map((lever) => lever.amountCents)]) {
    if (!Number.isInteger(value)) throw new Error('Geldbeträge müssen ganze Cent sein');
  }

  const steps: BridgeStep[] = [
    {
      label: baseline.label,
      kind: 'total',
      startCents: 0,
      endCents: baseline.amountCents,
      deltaCents: baseline.amountCents,
    },
  ];

  let running = baseline.amountCents;
  for (const lever of levers) {
    steps.push({
      label: lever.label,
      kind: lever.amountCents >= 0 ? 'increase' : 'decrease',
      startCents: running,
      endCents: running + lever.amountCents,
      deltaCents: lever.amountCents,
    });
    running += lever.amountCents;
  }

  steps.push({
    label: totalLabel,
    kind: 'total',
    startCents: 0,
    endCents: running,
    deltaCents: running,
  });
  return { steps, total: { amountCents: running, currency: baseline.currency } };
}
