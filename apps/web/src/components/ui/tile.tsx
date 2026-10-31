import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@/lib/utils';

// Kacheln sind Flächen statt Rahmen (PLT-10). lg: Bereichskacheln der Startseite (PLT-11),
// sm: Einträge in Listen wie die Lieferantenkarten (PLT-03).
const tileVariants = cva('flex flex-col gap-4 rounded-xl bg-muted', {
  variants: {
    size: {
      lg: 'h-full p-6',
      sm: 'p-5',
    },
    interactive: {
      true: 'transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
      false: '',
    },
  },
  defaultVariants: { size: 'sm', interactive: false },
});

function Tile({
  className,
  size,
  interactive,
  asChild = false,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof tileVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'div';
  return (
    <Comp
      data-slot="tile"
      className={cn(tileVariants({ size, interactive }), className)}
      {...props}
    />
  );
}

/** Runder Platz für das Symbol oben in einer großen Kachel. */
function TileIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-11 items-center justify-center rounded-full bg-background text-primary [&_svg]:size-6">
      {children}
    </span>
  );
}

/**
 * Kachel nach Apple (NAV-10): Titel, ein Satz, Kennzahl oder Grafik, höchstens zwei Knöpfe.
 * Überschriften kurz und zentriert; Hauptaktion gefüllt, Nebenaktion umrandet.
 */
function TileTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 className={cn('text-center font-semibold text-lg', className)} {...props} />;
}

function TileText({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-center text-muted-foreground', className)} {...props} />;
}

/** Eine Kennzahl, groß; die Einheit oder Erklärung klein darunter. */
function TileMetric({ value, label }: { value: React.ReactNode; label?: React.ReactNode }) {
  return (
    <p className="flex flex-col items-center gap-1 text-center">
      <span className="font-semibold text-xl tabular-nums">{value}</span>
      {label && <span className="text-muted-foreground text-sm">{label}</span>}
    </p>
  );
}

/** Platz für höchstens zwei Knöpfe, unten in der Kachel. */
function TileActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-auto flex flex-wrap justify-center gap-3">{children}</div>;
}

export { Tile, TileActions, TileIcon, TileMetric, TileText, TileTitle, tileVariants };
