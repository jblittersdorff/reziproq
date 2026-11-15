import { cn } from '@/lib/utils';
import type { StepState } from './step-ring';

/**
 * Kette der Designsprache (Regel 4): Ringe 14 px, um 4 px überlappend, mit weißem Außenrand.
 * Petrol fertig, Mint mit Tinte-Rand jetzt, weiß mit grauem Rand offen. Für Screenreader steht
 * der Stand als Text in label, z. B. „Zyklus: 3 von 6 Schritten fertig, Gemeinsamer Plan läuft“.
 */
function Chain({
  steps,
  label,
  className,
}: {
  steps: StepState[];
  label: string;
  className?: string;
}) {
  return (
    <span role="img" aria-label={label} data-slot="chain" className={cn('flex pl-1', className)}>
      {steps.map((state, index) => (
        <span
          // Die Reihenfolge der Schritte ändert sich nie.
          // biome-ignore lint/suspicious/noArrayIndexKey: feste Reihenfolge
          key={index}
          data-state={state}
          className={cn(
            '-ml-1 size-3.5 shrink-0 rounded-full border-2 shadow-ring-gap',
            state === 'done' && 'border-petrol bg-petrol',
            state === 'current' && 'border-ink bg-mint',
            state === 'open' && 'border-ring-open bg-card',
          )}
        />
      ))}
    </span>
  );
}

export { Chain };
