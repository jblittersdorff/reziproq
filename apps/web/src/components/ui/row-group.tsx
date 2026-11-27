import { ChevronRightIcon } from 'lucide-react';
import type * as React from 'react';
import { useId } from 'react';
import { cn } from '@/lib/utils';
import { defaultRenderLink, type RenderLink } from './nav-link';

/**
 * Gruppe mit Zeilen (UX-20 `RowGroup`, Designsprache 2, Vorlage `Main.dc.html`): graues
 * Abschnittslabel in Versalien über einer weißen Gruppe; Zeilen 56 px mit Trenner.
 */
function RowGroup({
  label,
  action,
  className,
  children,
}: {
  /** z. B. „Heute · 2 weitere“; ohne Label nur die Gruppe */
  label?: React.ReactNode;
  /** Zweitknopf rechts neben dem Label, z. B. „Durchgehen“ (Vorlage Main) */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const headingId = useId();
  const heading = label && (
    <h2
      id={headingId}
      className="min-w-0 flex-1 px-1 font-semibold text-muted-foreground text-sm uppercase tracking-label"
    >
      {label}
    </h2>
  );
  return (
    <section
      data-slot="row-group"
      {...(label ? { 'aria-labelledby': headingId } : {})}
      className={cn('flex flex-col gap-2', className)}
    >
      {action ? (
        <div className="flex items-center gap-3">
          {heading}
          {action}
        </div>
      ) : (
        heading
      )}
      <div className="flex flex-col divide-y divide-row-line overflow-hidden rounded-md bg-card">
        {children}
      </div>
    </section>
  );
}

/**
 * Zeile einer Gruppe: links Monogramm oder Punkt, Titel und Unterzeile, rechts Wert. Mit Ziel ist die
 * ganze Zeile ein Link mit grauem Pfeil; ohne Ziel hat sie keinen Pfeil und ist nicht klickbar.
 * `control` ist ein Schalter in der Zeile (Vorlage Mein-Agent): rechts neben dem Text, auf schmalen
 * Bildschirmen darunter; eine Zeile mit Schalter hat kein Ziel.
 */
function Row({
  href,
  lead,
  title,
  detail,
  value,
  valueTone = 'muted',
  wrap = false,
  control,
  renderLink = defaultRenderLink,
}: {
  href?: string;
  lead?: React.ReactNode;
  title: React.ReactNode;
  detail?: React.ReactNode;
  value?: React.ReactNode;
  valueTone?: 'muted' | 'accent';
  /** Unterzeile umbrechen statt kürzen, für erklärende Sätze (Vorlage K1-Kurz-Pruefen) */
  wrap?: boolean;
  /** Schalter in der Zeile, z. B. die Stufe einer Aufgabe; bricht auf Telefonbreite unter den Text */
  control?: React.ReactNode;
  renderLink?: RenderLink;
}) {
  if (control) {
    return (
      <div data-slot="row" className="flex min-h-14 flex-wrap items-center gap-3 px-3.5 py-2.5">
        {lead && <span className="flex shrink-0 items-center">{lead}</span>}
        <span className="flex min-w-0 flex-[1_1_16rem] flex-col gap-0.5">
          <b className="font-semibold text-ink text-row">{title}</b>
          {detail && (
            <span className="text-pretty text-detail text-muted-foreground">{detail}</span>
          )}
        </span>
        <span className="max-w-full flex-none">{control}</span>
      </div>
    );
  }
  const body = (
    <>
      {lead && <span className="flex shrink-0 items-center">{lead}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="truncate font-semibold text-ink text-row">{title}</b>
        {detail && (
          <span
            className={cn('text-detail text-muted-foreground', wrap ? 'text-pretty' : 'truncate')}
          >
            {detail}
          </span>
        )}
      </span>
      {value && (
        <span
          className={cn(
            'shrink-0 whitespace-nowrap text-base',
            valueTone === 'accent' ? 'font-semibold text-petrol' : 'text-muted-foreground',
          )}
        >
          {value}
        </span>
      )}
    </>
  );
  const row = 'flex min-h-14 items-center gap-3 px-3.5 py-2.5';
  if (!href) {
    return (
      <div data-slot="row" className={row}>
        {body}
      </div>
    );
  }
  return renderLink({
    href,
    className: cn(
      row,
      'text-text no-underline hover:bg-paper focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50',
    ),
    children: (
      <>
        {body}
        <ChevronRightIcon
          aria-hidden
          data-slot="row-arrow"
          className="size-4 shrink-0 text-ring-open"
        />
      </>
    ),
  });
}

/**
 * Spaltenköpfe über einer Gruppe (Vorlage Lieferanten: „Beziehung · Segment · Zusagen gehalten“):
 * graue Labels wie das Abschnittslabel, erst ab 761 px; auf dem Telefon trägt jede Zeile alles
 * selbst. Für Screenreader verborgen, weil jede Zeile ihre Werte selbst nennt.
 */
function RowHeads({ children }: { children: React.ReactNode }) {
  return (
    <div aria-hidden data-slot="row-heads" className="hidden items-center gap-3 px-3.5 shell:flex">
      {children}
    </div>
  );
}

function RowHead({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'font-semibold text-muted-foreground text-sm uppercase tracking-label',
        className,
      )}
    >
      {children}
    </span>
  );
}

export { Row, RowGroup, RowHead, RowHeads };
