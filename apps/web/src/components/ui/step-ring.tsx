import { CheckIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export type StepState = 'done' | 'current' | 'open';

/**
 * Ring eines Schritts (Designsprache, Regel 4): fertig Petrol mit Haken, jetzt Mint mit
 * Tinte-Rand, offen weiß mit grauem Rand. Die Ziffer oder „fertig“ steht für Screenreader da.
 */
function StepRing({
  state,
  number,
  doneLabel,
  size = 'md',
}: {
  state: StepState;
  number: number;
  /** z. B. „fertig“ */
  doneLabel: string;
  /** sm 32 px, md 36 px */
  size?: 'sm' | 'md';
}) {
  return (
    <span
      data-slot="step-ring"
      data-state={state}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border-2 font-display font-semibold',
        size === 'sm' ? 'size-8 text-sm' : 'size-9 text-sm',
        state === 'done' && 'border-petrol bg-petrol text-primary-foreground',
        state === 'current' && 'border-ink bg-mint text-ink',
        state === 'open' && 'border-ring-open bg-card text-muted-foreground',
      )}
    >
      {state === 'done' ? (
        <CheckIcon strokeWidth={3} className="size-3.5" role="img" aria-label={doneLabel} />
      ) : (
        number
      )}
    </span>
  );
}

export { StepRing };
