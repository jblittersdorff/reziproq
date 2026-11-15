import type { Money } from '@reziproq/shared';

export interface BridgeLever {
  label: string;
  /** EBIT-Wirkung in Cent; Kostenvermeidung, Cash und strategischer Wert gehören nicht hierher. */
  amountCents: number;
}

export interface BridgeStep {
  label: string;
  kind: 'total' | 'increase' | 'decrease';
  /** PNL-10: Reifegrad R1 bis R5 der Initiative; bestimmt Farbe und Beschriftung */
  maturity?: number;
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

/**
 * PNL-10: Brücke der EBIT-Wirkung einer Beziehung: je Initiative ein Schritt ab null, am Ende die
 * Summe. Andere Wirkungsarten gehören nie hierher.
 */
export function buildInitiativeBridge(
  items: { label: string; amountCents: number; maturity: number }[],
  totalLabel: string,
): BridgeStep[] {
  let running = 0;
  const steps: BridgeStep[] = items.map((item) => {
    if (!Number.isInteger(item.amountCents)) throw new Error('Geldbeträge müssen ganze Cent sein');
    const step: BridgeStep = {
      label: item.label,
      kind: item.amountCents >= 0 ? 'increase' : 'decrease',
      maturity: item.maturity,
      startCents: running,
      endCents: running + item.amountCents,
      deltaCents: item.amountCents,
    };
    running += item.amountCents;
    return step;
  });
  if (steps.length > 0) {
    steps.push({
      label: totalLabel,
      kind: 'total',
      startCents: 0,
      endCents: running,
      deltaCents: running,
    });
  }
  return steps;
}
