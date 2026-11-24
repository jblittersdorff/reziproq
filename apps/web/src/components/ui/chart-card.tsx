import { ChevronRightIcon } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/utils';
import { defaultRenderLink, type RenderLink } from './nav-link';

/**
 * Diagrammkarte (UX-20 `ChartCard`, Designsprache 2, Vorlagen `Uebersicht.dc.html`,
 * `D-Diagramme.dc.html`): Bereichslabel, Aussage mit Zahl als Titel, ein Diagramm (Balken,
 * 100-%-Balken oder bis zu drei Kennzahlen), Quellzeile und unten genau ein Link in den Bereich.
 */
function ChartCard({
  label,
  title,
  source,
  link,
  renderLink = defaultRenderLink,
  className,
  children,
}: {
  label?: string;
  title: React.ReactNode;
  source?: React.ReactNode;
  link?: { label: string; href: string };
  renderLink?: RenderLink;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-slot="chart-card"
      className={cn('flex min-w-0 flex-col gap-3.5 rounded-lg bg-card px-5.5 py-5', className)}
    >
      {label && <span className="font-semibold text-input-border text-sm">{label}</span>}
      <h2 className="text-balance font-display font-semibold text-lg tracking-section">{title}</h2>
      {children}
      {source && <p className="text-chip text-input-border">{source}</p>}
      {link &&
        renderLink({
          href: link.href,
          className:
            'mt-auto flex min-h-11 items-center justify-between gap-2 border-row-line border-t pt-3 font-semibold text-detail text-petrol no-underline hover:text-petrol-dark',
          children: (
            <>
              {link.label}
              <ChevronRightIcon aria-hidden className="size-4" />
            </>
          ),
        })}
    </section>
  );
}

/** Balken mit Wert rechts; `share` 0 bis 1, `potential` hell (z. B. Potenzial nicht freigegeben) */
function ChartBars({
  items,
}: {
  items: { key: string; label: string; share: number; value: string; potential?: number }[];
}) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li
          key={item.key}
          className="grid grid-cols-[minmax(0,--spacing(24))_minmax(0,1fr)_auto] items-center gap-2.5 text-detail"
        >
          <span className="truncate">{item.label}</span>
          <span aria-hidden className="relative h-3 overflow-hidden rounded-full bg-line-soft">
            {item.potential !== undefined && (
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-mint-line"
                style={{ width: `${Math.min(1, item.potential) * 100}%` }}
              />
            )}
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-petrol"
              style={{ width: `${Math.min(1, item.share) * 100}%` }}
            />
          </span>
          <span className="whitespace-nowrap text-muted-strong text-sm tabular-nums">
            {item.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Bis zu drei Kennzahlen nebeneinander, Zahl in Outfit */
function ChartFigures({ items }: { items: { key: string; value: string; label: string }[] }) {
  if (items.length > 3) throw new Error('ChartFigures zeigt höchstens drei Kennzahlen.');
  return (
    <dl className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.key} className="flex flex-col">
          <dt className="order-2 text-detail text-input-border">{item.label}</dt>
          <dd className="order-1 font-display font-semibold text-figure tabular-nums">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Säulen, z. B. „EBIT gesichert je Quartal“ (Vorlage `Uebersicht.dc.html`): Wert über der Säule,
 * Name darunter; `share` 0 bis 1 relativ zur größten Säule. Ein Zeitraum in der Zukunft hat keine
 * Säule, der laufende trägt seinen Zusatz im Namen (z. B. „Q4 bis heute“).
 */
function ChartColumns({
  items,
  label,
}: {
  items: { key: string; label: string; value: string; share: number; future?: boolean }[];
  /** Name für Screenreader */
  label: string;
}) {
  return (
    <ul
      aria-label={label}
      data-slot="chart-columns"
      className="flex h-31 items-end gap-3.5 pt-1.5 shell:h-40"
    >
      {items.map((item) => (
        <li
          key={item.key}
          className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5 text-chip text-input-border"
        >
          <b className="font-semibold text-ink text-sm tabular-nums">{item.value}</b>
          <span aria-hidden className="flex w-full flex-1 items-end justify-center">
            {!item.future && (
              <span
                className="block w-full max-w-11 rounded-t-lg rounded-b-sm bg-petrol"
                style={{ height: `${Math.max(0.02, Math.min(1, item.share)) * 100}%` }}
              />
            )}
          </span>
          <span className="text-center">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export { ChartBars, ChartCard, ChartColumns, ChartFigures };
