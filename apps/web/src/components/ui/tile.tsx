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

export { Tile, TileIcon, tileVariants };
