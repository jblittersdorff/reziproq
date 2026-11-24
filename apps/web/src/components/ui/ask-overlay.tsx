import { XIcon } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { closeOnBackdrop, useModalDialog } from './modal-dialog';

/**
 * Überlagerung „Frag Reziproq“ (NAV-10 2.0, Vorlage `Fragen.dc.html`, erlaubt nach E-K0-01): über
 * jeder Seite mit ⌘K, bis 800 px breit, bis 760 px Vollbild. Esc und der runde Knopf schließen sie,
 * der Fokus bleibt darin; ein Link darin schließt sie und führt zu seiner Seite. Ohne `open` ist
 * nichts eingehängt.
 */
function AskOverlay({
  open,
  onClose,
  title,
  closeLabel,
  className,
  children,
}: {
  open: boolean;
  /** `link`: ein Link darin führt gleich weiter (dann nicht im Verlauf zurückgehen) */
  onClose: (reason?: 'link') => void;
  title: string;
  closeLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <AskPanel onClose={onClose} title={title} closeLabel={closeLabel} className={className}>
      {children}
    </AskPanel>
  );
}

function AskPanel({
  onClose,
  title,
  closeLabel,
  className,
  children,
}: {
  onClose: (reason?: 'link') => void;
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
      data-slot="ask-overlay"
      onClick={closeOnBackdrop(() => onClose())}
      // Ein Link in der Antwort führt zu seiner Seite; die Überlagerung geht dabei zu.
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest('a[href]')) onClose('link');
      }}
      className={cn(
        'm-0 h-svh max-h-none w-full max-w-none overflow-y-auto border-0 bg-background p-0 text-foreground backdrop:bg-scrim',
        // Ab 761 px oben mit Abstand und so hoch wie der Inhalt (bottom-auto), höchstens 80 %.
        'shell:bottom-auto shell:mx-auto shell:mt-16 shell:h-auto shell:max-h-4/5 shell:max-w-200 shell:rounded-xl shell:shadow-xl',
        className,
      )}
    >
      <div className="flex min-h-full flex-col gap-6 px-4 py-5 sm:px-8 shell:py-7">
        <header className="flex items-start justify-between gap-4">
          <h2
            id={titleId}
            className="pt-1 font-display font-bold text-title-phone tracking-section shell:text-title"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={() => onClose()}
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

export { AskOverlay };
