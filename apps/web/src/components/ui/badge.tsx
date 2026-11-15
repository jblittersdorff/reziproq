import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '@/lib/utils';

// Chip der Designsprache: Pille 12 px / 600, Fläche und Text nach Status – immer mit Text.
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.75 py-1 font-semibold text-chip [&>svg]:size-3.5',
  {
    variants: {
      variant: {
        neutral: 'bg-status-neutral text-status-neutral-foreground',
        // geteilt, beide Seiten
        selected: 'bg-status-shared text-status-shared-foreground',
        shared: 'bg-status-shared text-status-shared-foreground',
        success: 'bg-success-soft text-success-soft-foreground',
        warning: 'bg-warning-soft text-warning-soft-foreground',
        danger: 'bg-destructive-soft text-destructive-soft-foreground',
        // Tinte mit Mint, z. B. „jetzt“
        ink: 'bg-status-ink text-status-ink-foreground',
        // Weiß auf getönter Fläche, z. B. „privat“ auf line-soft
        plain: 'bg-card text-muted-strong',
        // Weiß auf geteilter Fläche, z. B. „beide Seiten“ auf mint-soft
        onShared: 'bg-card text-status-shared-foreground',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

/** Chip ist der Name der Designsprache für denselben Baustein. */
const Chip = Badge;

export { Badge, badgeVariants, Chip };
