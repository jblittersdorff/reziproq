import type * as React from 'react';

import { cn } from '@/lib/utils';

export interface RangeRow {
  key: string;
  label: React.ReactNode;
  /** Klartext für Screenreader, z. B. der Name ohne Verweis */
  text: string;
  low: number;
  high: number;
  /** Sicherheit niedrig: grau und nicht hervorgehoben */
  muted?: boolean;
}

/**
 * Spannen-Balken (AW-01): je Zeile die Spanne von unten bis oben auf einer Achse ab 0, Petrol für
 * das, was zählt, Grau für Sicherheit niedrig. Direkt beschriftet, ohne Legende; die ganze Grafik
 * hat ein aria-label mit allen Werten.
 */
function RangeBars({
  rows,
  format,
  label,
  note,
  className,
}: {
  rows: RangeRow[];
  format: (low: number, high: number) => string;
  /** Aussage der Grafik, z. B. „EBIT im Jahr je Potenzial“ */
  label: string;
  /** Einheit und Quelle klein darunter */
  note?: string;
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.high));
  const share = (value: number) => `${(Math.max(0, value) / max) * 100}%`;
  return (
    <figure data-slot="range-bars" className={cn('flex flex-col gap-3', className)}>
      <ul
        role="img"
        aria-label={`${label}: ${rows.map((row) => `${row.text} ${format(row.low, row.high)}`).join(', ')}`}
        className="flex flex-col gap-3"
      >
        {rows.map((row) => (
          <li
            key={row.key}
            data-muted={row.muted || undefined}
            className="grid grid-cols-1 items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,5fr)]"
          >
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className={cn('font-semibold', row.muted && 'text-muted-foreground')}>
                {row.label}
              </span>
              <span className="text-muted-foreground tabular-nums sm:hidden">
                {format(row.low, row.high)}
              </span>
            </span>
            <span className="flex items-center gap-3">
              <span className="relative block h-2.5 min-w-0 grow rounded-full bg-line-soft">
                <span
                  className={cn(
                    'absolute inset-y-0 rounded-full',
                    row.muted ? 'bg-muted-foreground/40' : 'bg-petrol',
                  )}
                  style={{
                    left: share(row.low),
                    width: `max(calc(var(--spacing) * 2), calc(${share(row.high)} - ${share(row.low)}))`,
                  }}
                />
              </span>
              <span className="hidden shrink-0 text-muted-foreground text-sm tabular-nums sm:inline">
                {format(row.low, row.high)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {note && <figcaption className="text-muted-foreground text-sm">{note}</figcaption>}
    </figure>
  );
}

export { RangeBars };
