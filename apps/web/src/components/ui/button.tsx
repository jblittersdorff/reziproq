import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircleIcon } from 'lucide-react';
import { Slot } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@/lib/utils';

// data-preview hält Hover oder Fokus fest, damit der Styleguide alle Zustände nebeneinander zeigt.
const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[preview=focus]:ring-3 data-[preview=focus]:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-destructive/30 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Die eine Hauptaktion je Ansicht
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 data-[preview=hover]:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-accent data-[preview=hover]:bg-accent',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[preview=hover]:bg-accent data-[preview=hover]:text-accent-foreground',
        ghost:
          'hover:bg-accent hover:text-accent-foreground data-[preview=hover]:bg-accent data-[preview=hover]:text-accent-foreground',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 data-[preview=hover]:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline data-[preview=hover]:underline',
      },
      // Klickflächen mindestens 44 × 44 px (PLT-10). sm sieht kleiner aus, für dichte Tabellen und
      // Diagramme; eine unsichtbare Erweiterung (::after) hält die Klickfläche bei 44 px.
      size: {
        default: 'h-11 px-4 has-[>svg]:px-3',
        sm: 'h-8 gap-1 px-3 after:absolute after:-inset-x-1.5 after:-inset-y-1.5 has-[>svg]:px-2',
        lg: 'h-12 px-6 has-[>svg]:px-4',
        icon: 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Zeigt einen Kreisel und sperrt den Knopf, bis die Aktion fertig ist. */
    loading?: boolean;
    'data-preview'?: 'hover' | 'focus' | undefined;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {/* Slot braucht genau ein Kind; mit asChild zeigt das Kind selbst den Ladezustand. */}
      {asChild ? (
        children
      ) : (
        <>
          {loading && (
            <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" aria-hidden />
          )}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
