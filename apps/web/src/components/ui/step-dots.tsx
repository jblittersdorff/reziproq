import { cn } from '@/lib/utils';

/**
 * Fortschritt eines Ablaufs als kleine Ringe in einer Zeile (WG-Uebersicht.dc.html, „Fortschritt als
 * zehn Ringe“): fertig Petrol gefüllt, in Arbeit Petrol-Rand, offen grauer Rand. Der Stand steht
 * als Text im Namen der Liste.
 */
function StepDots({
  states,
  label,
  className,
}: {
  states: ('done' | 'in_progress' | 'open')[];
  /** z. B. „3 von 10 Schritten fertig“ */
  label: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      data-slot="step-dots"
      className={cn('flex items-center gap-1', className)}
    >
      {states.map((state, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: Schritte haben eine feste Reihenfolge
          key={index}
          aria-hidden
          data-state={state}
          className={cn(
            'size-3 shrink-0 rounded-full border-2',
            state === 'done' && 'border-petrol bg-petrol',
            state === 'in_progress' && 'border-petrol bg-card',
            state === 'open' && 'border-ring-open bg-card',
          )}
        />
      ))}
    </span>
  );
}

export { StepDots };
