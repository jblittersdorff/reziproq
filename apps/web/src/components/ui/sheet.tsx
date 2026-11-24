import { XIcon } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { closeOnBackdrop, useModalDialog } from './modal-dialog';

/**
 * Blatt (Designsprache „Bausteine für Reziproq“, NAV-10 Seitenregel 4, erlaubt nach E-K0-01): Details
 * zu einer Zeile, 620 px von rechts über der Seite, Fläche Papier, Hintergrund Tinte 25 %. Titel in
 * Outfit 28, runder Schließen-Knopf 44 px; Esc schließt, der Fokus bleibt im Blatt. Bis 760 px eine
 * volle Seite. Ohne `open` ist nichts eingehängt.
 */
function Sheet({
  open,
  onClose,
  title,
  closeLabel,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Name des Schließen-Knopfs, z. B. „Schließen“ */
  closeLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <SheetPanel onClose={onClose} title={title} closeLabel={closeLabel} className={className}>
      {children}
    </SheetPanel>
  );
}

function SheetPanel({
  onClose,
  title,
  closeLabel,
  className,
  children,
}: {
  onClose: () => void;
  title: string;
  closeLabel: string;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  const ref = useModalDialog(onClose);
  const titleId = React.useId();
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Der Klick auf die Abdunklung ist nur eine Abkürzung; mit der Tastatur schließen Esc und der runde Knopf.
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-slot="sheet"
      onClick={closeOnBackdrop(onClose)}
      className={cn(
        'm-0 h-svh max-h-none w-full max-w-none overflow-y-auto border-0 bg-background p-0 text-foreground backdrop:bg-scrim',
        'shell:mr-0 shell:ml-auto shell:w-155 shell:shadow-sheet',
        className,
      )}
    >
      <div className="flex min-h-full flex-col gap-6 px-4 py-5 sm:px-8 shell:py-7">
        <header className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="pt-1.5 font-display font-bold text-figure tracking-section">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-control text-ink outline-none hover:bg-line-soft focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-5"
          >
            <XIcon aria-hidden />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export { Sheet };
