import type * as React from 'react';

import { cn } from '@/lib/utils';
import { Badge } from './badge';
import { StepRing } from './step-ring';

/**
 * Fortschritt eines Ablaufs in Schritten (PLT-10) als Ablauf-Leiste der Designsprache
 * (Flow.dc.html): weiße Karte, oben „Schritt 2 von 4“, Ringe mit Linie dazwischen, mit steps auch
 * die Namen der Schritte, darunter der Titel des Schritts. Optional Chip und Titel des Ablaufs,
 * Zurück und Weiter rechts oben und die Zeile „Fertig, wenn …“. Jeder Schritt hat eine eigene
 * Adresse; dieser Baustein zeigt nur, wo man steht.
 */
function StepProgress({
  current,
  total,
  label,
  stepTitle,
  steps,
  chip,
  title,
  actions,
  doneWhen,
  doneLabel = '✓',
  stepStates,
  stateLabels,
  hrefOf,
  renderLink,
}: {
  current: number;
  total: number;
  /** z. B. (2, 4) => „Schritt 2 von 4“ */
  label: (current: number, total: number) => string;
  stepTitle: string;
  /** Namen aller Schritte, in der Reihenfolge */
  steps?: string[];
  /** z. B. „Ablauf“, als Tinte-Chip vor dem Titel */
  chip?: string;
  /** Titel des Ablaufs, z. B. „JBP abschließen“ */
  title?: string;
  /** z. B. Zurück und Weiter */
  actions?: React.ReactNode;
  /** Zeile „Fertig, wenn …“: fett der Anfang, dann der Rest */
  doneWhen?: { label: string; text: string };
  /** Text für den Haken fertiger Schritte, z. B. „fertig“ */
  doneLabel?: string;
  /**
   * Stand je Schritt aus den Daten (WG-04), statt ihn aus der Position abzuleiten; der aktuelle
   * Schritt bleibt markiert.
   */
  stepStates?: ('done' | 'in_progress' | 'open')[];
  /** Stand als Text für Screenreader, z. B. { done: 'fertig', in_progress: 'in Arbeit', open: 'offen' } */
  stateLabels?: Record<'done' | 'in_progress' | 'open', string>;
  /** Adresse je Schritt: Schritte sind dann frei anspringbar */
  hrefOf?: (step: number) => string;
  renderLink?: (props: {
    href: string;
    className: string;
    'aria-label'?: string;
    'aria-current'?: 'step' | undefined;
    children: React.ReactNode;
  }) => React.ReactNode;
}) {
  return (
    <div
      data-slot="step-progress"
      className="flex flex-col gap-4.5 rounded-lg bg-card px-5 py-5 shadow-ask sm:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {chip && <Badge variant="ink">{chip}</Badge>}
          {title && (
            <strong className="font-display font-semibold text-lg tracking-section-sm">
              {title}
            </strong>
          )}
          <p className="font-semibold text-muted-foreground text-sm">{label(current, total)}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <ol className="flex items-start" aria-label={label(current, total)}>
        {Array.from({ length: total }, (_, index) => {
          const step = index + 1;
          const data = stepStates?.[index];
          const state =
            step === current
              ? 'current'
              : data
                ? data === 'in_progress'
                  ? 'progress'
                  : data
                : step < current
                  ? 'done'
                  : 'open';
          const name = steps?.[index];
          const ring = <StepRing size="sm" number={step} doneLabel={doneLabel} state={state} />;
          const label = [name ?? String(step), data && stateLabels?.[data]]
            .filter(Boolean)
            .join(', ');
          return (
            <li
              key={step}
              aria-current={step === current ? 'step' : undefined}
              className={cn('flex min-w-0 flex-col gap-2', step < total && 'flex-1')}
            >
              <span className="flex items-center">
                {hrefOf && renderLink
                  ? renderLink({
                      href: hrefOf(step),
                      className:
                        'relative rounded-full after:absolute after:-inset-1.5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                      'aria-label': label,
                      'aria-current': step === current ? 'step' : undefined,
                      children: ring,
                    })
                  : ring}
                {step < total && (
                  <span
                    aria-hidden
                    className={cn(
                      'h-0.5 flex-1 rounded-full',
                      step < current ? 'bg-petrol' : 'bg-line',
                    )}
                  />
                )}
              </span>
              {name && (
                // Auf schmalen Bildschirmen nur die Ringe; die Namen bleiben für Screenreader.
                <span
                  className={cn(
                    'sr-only hyphens-auto pr-2 text-sm [overflow-wrap:anywhere] sm:not-sr-only',
                    state === 'current' ? 'font-semibold' : 'font-semibold',
                    state === 'open' && 'text-muted-foreground',
                  )}
                >
                  {name}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <h3 className="font-display font-semibold text-lg tracking-section-sm">{stepTitle}</h3>
      {doneWhen && (
        <p className="rounded-md bg-paper px-4 py-3 text-sm leading-normal">
          <strong className="font-semibold">{doneWhen.label}</strong> {doneWhen.text}
        </p>
      )}
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
