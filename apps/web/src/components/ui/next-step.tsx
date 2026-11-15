import { ArrowRightIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Nächster Schritt der Designsprache (Regel 5): Tinte-Karte mit Mint-Zeile darüber, Titel in
 * Outfit, Ringe als Hintergrund rechts und höchstens einer Hauptaktion (Mint-Knopf mit Pfeil im
 * Tinte-Kreis, siehe NextStepArrow). Je Seite höchstens eine. nested: in einer Karte, 24 px Ecken.
 */
function NextStep({
  eyebrow,
  title,
  text,
  action,
  secondary,
  nested = false,
  headingAs: Heading = 'h2',
  headingId,
  className,
}: {
  /** z. B. „Dein nächster Schritt · fällig heute“ */
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  text?: React.ReactNode;
  /** Die eine Hauptaktion, z. B. <Button variant="mint" size="hero" asChild> */
  action?: React.ReactNode;
  /** Optional ein Zweitknopf (variant="dark") */
  secondary?: React.ReactNode;
  nested?: boolean;
  headingAs?: 'h2' | 'h3';
  headingId?: string;
  className?: string;
}) {
  return (
    <section
      data-slot="next-step"
      aria-labelledby={headingId}
      className={cn(
        'relative flex flex-wrap items-center justify-between gap-5 overflow-hidden bg-ink text-on-dark',
        nested ? 'rounded-lg px-6.5 py-6' : 'rounded-xl px-8 py-7.5',
        className,
      )}
    >
      <Rings />
      <div className="relative flex min-w-0 shrink grow basis-80 flex-col gap-2">
        <span className="font-semibold text-mint text-sm">{eyebrow}</span>
        <Heading
          id={headingId}
          className={cn(
            'font-display font-semibold text-balance',
            nested ? 'text-section tracking-section' : 'text-figure tracking-section',
          )}
        >
          {title}
        </Heading>
        {text && <p className="text-on-dark-muted text-sm sm:text-base">{text}</p>}
      </div>
      {(action || secondary) && (
        <div className="relative flex flex-wrap items-center gap-2">
          {secondary}
          {action}
        </div>
      )}
    </section>
  );
}

/** Pfeil im Tinte-Kreis am Ende des Mint-Knopfs. */
function NextStepArrow() {
  return (
    <span
      aria-hidden
      className="flex size-9 items-center justify-center rounded-full bg-ink text-mint"
    >
      <ArrowRightIcon strokeWidth={2.5} className="size-4" />
    </span>
  );
}

/**
 * Zwei Ringe als Hintergrund rechts, wie das Logo. Bewusste Abweichung: Die Vorlage schiebt sie
 * 60 px über den Rand der Karte; hier enden sie am Rand, damit nichts über die Seite hinausragt
 * (Prüfung auf Überlauf bei 390 px).
 */
function Rings() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 360 300"
      fill="none"
      strokeWidth={2}
      className="pointer-events-none absolute top-1/2 right-0 h-75 w-90 -translate-y-1/2"
    >
      <path
        d="M170 34.67A130 130 0 0 1 170 265.33A130 130 0 0 1 170 34.67Z"
        className="fill-mint/12"
      />
      <circle cx={110} cy={150} r={130} className="stroke-on-dark/14" />
      <circle cx={230} cy={150} r={130} className="stroke-mint/35" />
    </svg>
  );
}

export { NextStep, NextStepArrow };
