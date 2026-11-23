import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircleIcon } from 'lucide-react';
import { Slot } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@/lib/utils';

// data-preview hält Hover oder Fokus fest, damit der Styleguide alle Zustände nebeneinander zeigt.
// Designsprache „Zwei Kreise“: alles Klickbare ist eine Pille. Haupt Petrol, Zweit weiß mit
// Innenrand, auf Tinte Mint mit Tinte-Text (mint) oder dunkel (dark).
const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[preview=focus]:ring-3 data-[preview=focus]:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-destructive/30 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Die eine Hauptaktion je Ansicht
        default:
          'bg-primary text-primary-foreground hover:bg-petrol-dark data-[preview=hover]:bg-petrol-dark',
        // Designsprache 2: Zweitknopf grau gefüllt ohne Rand
        secondary: 'bg-control text-ink hover:bg-line data-[preview=hover]:bg-line',
        outline: 'bg-card text-text shadow-inset-line hover:bg-paper data-[preview=hover]:bg-paper',
        ghost: 'text-text hover:bg-line-soft data-[preview=hover]:bg-line-soft',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 data-[preview=hover]:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:text-petrol-dark hover:underline data-[preview=hover]:underline',
        // Auf Tinte: Hauptknopf Mint, Zweitknopf dunkel
        mint: 'bg-mint text-ink hover:bg-mint/90 focus-visible:ring-mint/60 data-[preview=hover]:bg-mint/90',
        dark: 'bg-dark-2 text-on-dark hover:bg-dark-2/80 focus-visible:ring-mint/60 data-[preview=hover]:bg-dark-2/80',
      },
      // Klickflächen mindestens 44 × 44 px (PLT-10). sm sieht kleiner aus, für dichte Tabellen und
      // Diagramme; eine unsichtbare Erweiterung (::after) hält die Klickfläche bei 44 px.
      // hero: Hauptaktion in der Tinte-Karte, 50 bis 54 px hoch.
      size: {
        default: 'h-11 px-5 has-[>svg]:px-4',
        sm: 'h-8 gap-1 px-3 after:absolute after:-inset-x-1.5 after:-inset-y-1.5 has-[>svg]:px-2',
        lg: 'h-12.5 px-6 text-base has-[>svg]:px-5',
        hero: 'h-13.5 gap-2.5 pr-2.5 pl-6.5 text-base',
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
