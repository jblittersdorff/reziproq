import type * as React from 'react';

import { cn } from '@/lib/utils';
import { StepRing } from './step-ring';

/**
 * Fortschritt eines Ablaufs in Schritten (PLT-10), z. B. „Schritt 2 von 4“: Ringe mit Linie
 * dazwischen (Designsprache: Schrittfolge). Jeder Schritt hat eine eigene Adresse; dieser Baustein
 * zeigt nur, wo man steht, und trägt die Knöpfe unten.
 */
function StepProgress({
  current,
  total,
  label,
  stepTitle,
  doneLabel = '✓',
}: {
  current: number;
  total: number;
  /** z. B. (2, 4) => „Schritt 2 von 4“ */
  label: (current: number, total: number) => string;
  stepTitle: string;
  /** Text für den Haken fertiger Schritte, z. B. „fertig“ */
  doneLabel?: string;
}) {
  return (
    <div data-slot="step-progress" className="flex flex-col gap-3">
      <p className="font-semibold text-muted-foreground text-sm">{label(current, total)}</p>
      <ol className="flex items-center" aria-label={label(current, total)}>
        {Array.from({ length: total }, (_, index) => {
          const step = index + 1;
          return (
            <li
              key={step}
              aria-current={step === current ? 'step' : undefined}
              className={cn('flex items-center', step < total && 'flex-1')}
            >
              <StepRing
                size="sm"
                number={step}
                doneLabel={doneLabel}
                state={step < current ? 'done' : step === current ? 'current' : 'open'}
              />
              {step < total && (
                <span
                  aria-hidden
                  className={cn(
                    'h-0.5 flex-1 rounded-full',
                    step < current ? 'bg-petrol' : 'bg-line',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
      <h3 className="font-semibold text-lg tracking-section-sm">{stepTitle}</h3>
    </div>
  );
}

/** Zurück links; Später fortsetzen und Weiter rechts. */
function StepActions({
  back,
  later,
  next,
}: {
  back?: React.ReactNode;
  later?: React.ReactNode;
  next: React.ReactNode;
}) {
  return (
    <div data-slot="step-actions" className="flex flex-wrap items-center gap-3">
      {back}
      <div className="ml-auto flex flex-wrap gap-3">
        {later}
        {next}
      </div>
    </div>
  );
}

export { StepActions, StepProgress };
