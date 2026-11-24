import { ChevronRightIcon } from 'lucide-react';
import type * as React from 'react';
import { useId } from 'react';
import { cn } from '@/lib/utils';
import { defaultRenderLink, type RenderLink } from './nav-link';

/**
 * Gruppe mit Zeilen (UX-20 `RowGroup`, Designsprache 2, Vorlage `Main.dc.html`): graues
 * Abschnittslabel in Versalien über einer weißen Gruppe; Zeilen 56 px mit Trenner.
 */
function RowGroup({
  label,
  className,
  children,
}: {
  /** z. B. „Heute · 2 weitere“; ohne Label nur die Gruppe */
  label?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      data-slot="row-group"
      {...(label ? { 'aria-labelledby': headingId } : {})}
      className={cn('flex flex-col gap-2', className)}
    >
      {label && (
        <h2
          id={headingId}
          className="px-1 font-semibold text-input-border text-sm uppercase tracking-label"
        >
          {label}
        </h2>
      )}
      <div className="flex flex-col divide-y divide-row-line overflow-hidden rounded-md bg-card">
        {children}
      </div>
    </section>
  );
}

/**
 * Zeile einer Gruppe: links Monogramm oder Punkt, Titel und Unterzeile, rechts Wert. Mit Ziel ist die
 * ganze Zeile ein Link mit grauem Pfeil; ohne Ziel hat sie keinen Pfeil und ist nicht klickbar.
 */
function Row({
  href,
  lead,
  title,
  detail,
  value,
  valueTone = 'muted',
  renderLink = defaultRenderLink,
}: {
  href?: string;
  lead?: React.ReactNode;
  title: React.ReactNode;
  detail?: React.ReactNode;
  value?: React.ReactNode;
  valueTone?: 'muted' | 'accent';
  renderLink?: RenderLink;
}) {
  const body = (
    <>
      {lead && <span className="flex shrink-0 items-center">{lead}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="truncate font-semibold text-ink text-row">{title}</b>
        {detail && <span className="truncate text-detail text-input-border">{detail}</span>}
      </span>
      {value && (
        <span
          className={cn(
            'shrink-0 whitespace-nowrap text-base',
            valueTone === 'accent' ? 'font-semibold text-petrol' : 'text-input-border',
          )}
        >
          {value}
        </span>
      )}
    </>
  );
  const row = 'flex min-h-14 items-center gap-3 px-3.5 py-2.5';
  if (!href) {
    return (
      <div data-slot="row" className={row}>
        {body}
      </div>
    );
  }
  return renderLink({
    href,
    className: cn(
      row,
      'text-text no-underline hover:bg-paper focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50',
    ),
    children: (
      <>
        {body}
        <ChevronRightIcon
          aria-hidden
          data-slot="row-arrow"
          className="size-4 shrink-0 text-ring-open"
        />
      </>
    ),
  });
}

export { Row, RowGroup };
