import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@/lib/utils';

// Kacheln sind Flächen statt Rahmen (PLT-10). lg: Bereichskacheln der Startseite (PLT-11),
// sm: Einträge in Listen wie die Lieferantenkarten (PLT-03).
// Töne (Handschrift Bühne): card hell, stage dunkel, shared für Inhalte, die die andere Seite sieht.
const tileVariants = cva('group/tile flex flex-col gap-4 rounded-lg text-left', {
  variants: {
    size: {
      lg: 'h-full p-6 sm:p-8',
      sm: 'p-5',
    },
    tone: {
      card: 'bg-card text-card-foreground shadow-card',
      stage: 'stage-scope',
      shared: 'bg-primary-soft text-foreground',
    },
    interactive: {
      true: 'transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
      false: '',
    },
  },
  defaultVariants: { size: 'sm', tone: 'card', interactive: false },
});

function Tile({
  className,
  size,
  tone,
  interactive,
  asChild = false,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof tileVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'div';
  return (
    <Comp
      data-slot="tile"
      data-size={size ?? 'sm'}
      data-tone={tone ?? 'card'}
      className={cn(tileVariants({ size, tone, interactive }), className)}
      {...props}
    />
  );
}

/** Runder Platz für das Symbol oben in einer großen Kachel. */
function TileIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-11 items-center justify-center rounded-full bg-mint-soft text-petrol-dark [&_svg]:size-6">
      {children}
    </span>
  );
}

/**
 * Kachel (NAV-10, Handschrift Bühne): Kennzeichen, Titel, ein Satz, Kennzahl oder Grafik,
 * höchstens zwei Knöpfe. Titel kurz, fett und linksbündig.
 */
function TileTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      className={cn(
        'font-display font-semibold text-lg tracking-section-sm group-data-[size=lg]/tile:text-section',
        className,
      )}
      {...props}
    />
  );
}

function TileText({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-muted-foreground', className)} {...props} />;
}

/** Eine Kennzahl, groß; die Einheit oder Erklärung klein darunter. */
function TileMetric({ value, label }: { value: React.ReactNode; label?: React.ReactNode }) {
  return (
    <p data-slot="metric" className="flex flex-col gap-1">
      <span className="font-display font-display font-semibold text-figure tabular-nums tracking-section tracking-title group-data-[size=lg]/tile:text-2xl">
        {value}
      </span>
      {label && <span className="text-muted-foreground text-sm">{label}</span>}
    </p>
  );
}

/** Platz für höchstens zwei Knöpfe, unten in der Kachel. */
function TileActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-auto flex flex-wrap items-center gap-3">{children}</div>;
}

export { Tile, TileActions, TileIcon, TileMetric, TileText, TileTitle, tileVariants };
