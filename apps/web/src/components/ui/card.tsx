import type * as React from 'react';

import { cn } from '@/lib/utils';

/** Karte der Designsprache (Regel 2): weiß, 24 px Ecken, hauchfeiner Rand. */
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn('rounded-lg bg-card text-card-foreground shadow-card', className)}
      {...props}
    />
  );
}

/** Kartentitel: Abschnitt klein (19 px) in Outfit. */
function CardTitle({
  as: Heading = 'h2',
  className,
  ...props
}: React.ComponentProps<'h2'> & { as?: 'h2' | 'h3' }) {
  return (
    <Heading
      className={cn('font-display font-semibold text-lg tracking-section-sm', className)}
      {...props}
    />
  );
}

/** Große Zahl in einer Karte, z. B. Wirkung je Art (Kennzahl 28 px, Tabellenziffern). */
function Figure({
  label,
  value,
  note,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  note?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="figure"
      className={cn('flex flex-col gap-1 rounded-lg bg-card p-5 shadow-card', className)}
    >
      <span className="text-muted-foreground text-sm">{label}</span>
      <strong className="font-display font-semibold text-figure tabular-nums tracking-section">
        {value}
      </strong>
      {note && <span className="text-chip text-muted-foreground">{note}</span>}
    </div>
  );
}

export { Card, CardTitle, Figure };
