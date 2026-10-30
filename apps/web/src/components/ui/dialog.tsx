import { Dialog as DialogPrimitive } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Fenster in der Bildmitte über einer leicht abgedunkelten, unscharfen Fläche – wie Spotlight.
 * Hält den Fokus innen, schließt mit Esc und mit Klick daneben. Neben der Seitenleiste der
 * einzige Ort mit Glas-Effekt (PLT-12).
 */
const Dialog = DialogPrimitive.Root;
const DialogTitle = DialogPrimitive.Title;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />
      {/* Der Rahmen legt die Lage fest; das Fenster selbst wächst höchstens bis zu seinem Rand. */}
      <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center p-4 sm:pt-16 sidebar:pt-24">
        <DialogPrimitive.Content
          data-slot="dialog-content"
          aria-describedby={undefined}
          className={cn(
            // Grundfläche statt popover: Darauf heben sich Karten (muted) auch im Dunkelmodus ab.
            'pointer-events-auto flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-background text-foreground shadow-xl outline-none',
            'data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            className,
          )}
          {...props}
        >
          {children}
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Portal>
  );
}

export { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger };
