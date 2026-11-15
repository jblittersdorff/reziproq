import type * as React from 'react';

import { cn } from '@/lib/utils';
import { StepRing, type StepState } from './step-ring';

export interface StepItem {
  key: string;
  title: React.ReactNode;
  /** z. B. „Strategisch, 12.09.“ oder „jetzt · JBP 04.12.“ */
  detail?: React.ReactNode;
  state: StepState;
}

/**
 * Schrittfolge der Designsprache: Ringe mit Linie 2 px dazwischen, Haken oder Ziffer.
 * columns: Titel und Angabe unter dem Ring (Überblick eines Lieferanten), auf Telefonbreite
 * untereinander. inline: Ring, Titel und Linie in einer Zeile (Abläufe wie der Import).
 */
function Steps({
  items,
  label,
  doneLabel,
  variant = 'columns',
  className,
}: {
  items: StepItem[];
  label: string;
  /** Text für den Haken, z. B. „fertig“ */
  doneLabel: string;
  variant?: 'columns' | 'inline';
  className?: string;
}) {
  if (variant === 'inline') {
    return (
      <ol
        aria-label={label}
        data-slot="steps"
        className={cn('flex flex-wrap items-center gap-x-2.5 gap-y-3', className)}
      >
        {items.map((item, index) => (
          <li
            key={item.key}
            aria-current={item.state === 'current' ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2.5 font-semibold text-sm',
              item.state === 'open' && 'text-muted-foreground',
            )}
          >
            <StepRing size="sm" state={item.state} number={index + 1} doneLabel={doneLabel} />
            {item.title}
            {index < items.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'h-0.5 w-10 rounded-full',
                  item.state === 'done' ? 'bg-petrol' : 'bg-line',
                )}
              />
            )}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol
      aria-label={label}
      data-slot="steps"
      className={cn('flex flex-col gap-4 sm:flex-row sm:gap-0', className)}
    >
      {items.map((item, index) => (
        <li
          key={item.key}
          aria-current={item.state === 'current' ? 'step' : undefined}
          className="flex flex-1 flex-row items-start gap-3 sm:flex-col sm:gap-2.5"
        >
          <span className="flex items-center sm:w-full">
            <StepRing state={item.state} number={index + 1} doneLabel={doneLabel} />
            {index < items.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'hidden h-0.5 flex-1 rounded-full sm:block',
                  item.state === 'done' ? 'bg-petrol' : 'bg-line',
                )}
              />
            )}
          </span>
          <span className="flex flex-col gap-0.5 sm:pr-3">
            <strong
              className={cn(
                'text-sm',
                item.state === 'current' ? 'font-semibold' : 'font-semibold',
                item.state === 'open' && 'text-muted-foreground',
              )}
            >
              {item.title}
            </strong>
            {item.detail && (
              <span
                className={cn(
                  'text-chip',
                  item.state === 'current' ? 'font-semibold' : 'text-muted-foreground',
                )}
              >
                {item.detail}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

export { Steps };
