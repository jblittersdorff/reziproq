import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Bühne (PLT-10, Handschrift Bühne): Kopf über die ganze Breite für Start und den Überblick eines
 * Lieferanten. Links klein der Anlass, groß der Titel, ein Satz und höchstens zwei Knöpfe; rechts
 * Platz für bis zu drei Kennzahlen. dark für Start, light für den Lieferanten.
 */
function Stage({
  tone = 'dark',
  path,
  titleAs: Title = 'h1',
  eyebrow,
  title,
  text,
  actions,
  aside,
  className,
}: {
  tone?: 'dark' | 'light';
  /** Pfad mit Zurück-Pfeil (NAV-03), steht über dem Titel */
  path?: React.ReactNode;
  /** h2 nur für Beispiele, z. B. im Styleguide; eine Seite mit Bühne hat dort ihren Titel. */
  titleAs?: 'h1' | 'h2';
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  text?: React.ReactNode;
  actions?: React.ReactNode;
  /** z. B. StageMetrics oder eine kleine Grafik */
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      data-slot="stage"
      data-tone={tone}
      className={cn(tone === 'dark' ? 'stage-scope' : 'bg-background', className)}
    >
      {path && <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-8">{path}</div>}
      <div
        className={cn(
          'mx-auto grid w-full max-w-6xl items-end gap-10 px-4 py-12 sm:px-8 sidebar:grid-cols-5 sidebar:py-16',
          path && 'pt-6 sidebar:pt-8',
        )}
      >
        <div
          className={cn(
            'flex min-w-0 flex-col gap-3',
            aside ? 'sidebar:col-span-3' : 'sidebar:col-span-5',
          )}
        >
          {eyebrow && <p className="font-semibold text-primary text-sm">{eyebrow}</p>}
          <Title className="text-balance font-bold text-2xl tracking-title sm:text-display">
            {title}
          </Title>
          {text && <p className="text-lg text-muted-foreground">{text}</p>}
          {actions && <div className="mt-3 flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
        {aside && <div className="min-w-0 sidebar:col-span-2">{aside}</div>}
      </div>
    </header>
  );
}

/** Bis zu drei Kennzahlen nebeneinander, getrennt durch feine Linien. */
function StageMetrics({
  label,
  items,
}: {
  /** Name der Liste für Screenreader */
  label: string;
  items: { key: string; value: React.ReactNode; label: React.ReactNode; accent?: boolean }[];
}) {
  return (
    <dl aria-label={label} className="flex divide-x divide-border border-border border-l">
      {items.slice(0, 3).map((item) => (
        <div
          key={item.key}
          data-metric={item.key}
          className="grid min-w-0 flex-1 content-start gap-2 px-4 sm:px-6"
        >
          {/* dt vor dd für Screenreader; sichtbar steht die Zahl oben, alle auf einer Höhe. */}
          <dt className="row-start-2 text-muted-foreground text-sm">{item.label}</dt>
          <dd
            className={cn(
              'row-start-1 truncate font-bold text-xl tabular-nums tracking-title sm:text-2xl',
              item.accent && 'text-primary',
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Angaben neben dem Titel, z. B. Beziehungstyp und nächster Termin; Werte dürfen umbrechen. */
function StageFacts({
  label,
  items,
}: {
  label: string;
  items: { key: string; value: React.ReactNode; label: React.ReactNode; muted?: boolean }[];
}) {
  return (
    <dl aria-label={label} className="flex flex-wrap gap-x-10 gap-y-6">
      {items.map((item) => (
        <div
          key={item.key}
          data-fact={item.key}
          className="flex flex-col-reverse gap-1 border-border border-l pl-5"
        >
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              'font-bold text-xl tracking-title',
              item.muted && 'font-normal text-muted-foreground',
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export { Stage, StageFacts, StageMetrics };
