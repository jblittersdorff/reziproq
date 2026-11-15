import { Slot } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Listenkarte der Designsprache: Karte ohne Innenabstand, Abschnittslabel 13 / 600 ohne Fläche,
 * Zeilen mit Trenner line-soft.
 */
function ListCard({ className, ...props }: React.ComponentProps<'section'>) {
  return (
    <section
      data-slot="list-card"
      className={cn(
        'overflow-hidden rounded-lg bg-card text-card-foreground shadow-card',
        className,
      )}
      {...props}
    />
  );
}

/** Kopf der Listenkarte: Titel links, ein Link rechts (z. B. „Alle 11“). */
function ListCardHeader({
  title,
  action,
  headingAs: Heading = 'h2',
  id,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  headingAs?: 'h2' | 'h3';
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-5.5">
      <Heading id={id} className="font-display font-semibold text-section tracking-section">
        {title}
      </Heading>
      {action}
    </div>
  );
}

/** Abschnittslabel, z. B. „Diese Woche · 3“ */
function ListSection({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      data-slot="list-section"
      className={cn(
        'border-line-soft border-t px-5.5 pt-4 pb-2 font-sans font-semibold text-muted-foreground text-sm first:border-t-0',
        className,
      )}
      {...props}
    />
  );
}

/** Zeile; mit asChild z. B. ein Link über die ganze Zeile. */
function ListRow({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<'div'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'div';
  return (
    <Comp
      data-slot="list-row"
      className={cn(
        'flex flex-wrap items-center gap-3.5 border-line-soft border-t px-5.5 py-3.5 text-text no-underline outline-none transition-colors first:border-t-0 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset [li:not(:first-child)>&]:border-t [[data-slot=list-section]+&]:border-t-0',
        asChild && 'hover:bg-paper',
        className,
      )}
      {...props}
    />
  );
}

/** Titel und Zeile darunter in einer Listenzeile. */
function ListRowText({ title, detail }: { title: React.ReactNode; detail?: React.ReactNode }) {
  return (
    <span className="flex min-w-0 shrink grow basis-60 flex-col">
      <strong className="font-semibold">{title}</strong>
      {detail && <span className="text-muted-foreground text-sm">{detail}</span>}
    </span>
  );
}

export { ListCard, ListCardHeader, ListRow, ListRowText, ListSection };
