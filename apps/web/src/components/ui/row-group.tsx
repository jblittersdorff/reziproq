import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import type * as React from 'react';
import { useId } from 'react';
import { cn } from '@/lib/utils';
import { BrandMark } from './brand-mark';
import { defaultRenderLink, type RenderLink } from './nav-link';

/**
 * Gruppe mit Zeilen (UX-20 `RowGroup`, Designsprache 2, Vorlage `Main.dc.html`): graues
 * Abschnittslabel in Versalien über einer weißen Gruppe; Zeilen 56 px mit Trenner. `shared` ist
 * Geteiltes (Regel „geteilt Mint mit Doppelring“, Vorlage L-Ueberblick): Fläche Mint mit Rand und
 * der Doppelring vor dem Label.
 */
function RowGroup({
  label,
  action,
  intro,
  tone = 'default',
  level = 2,
  id,
  className,
  children,
}: {
  /** z. B. „Heute · 2 weitere“; ohne Label nur die Gruppe */
  label?: React.ReactNode;
  /** Zweitknopf rechts neben dem Label, z. B. „Durchgehen“ (Vorlage Main) */
  action?: React.ReactNode;
  /** Zwischen Label und Gruppe, z. B. Frag-Zeile und Filter im Verlauf (Vorlage K2-Akte-Privat) */
  intro?: React.ReactNode;
  tone?: 'default' | 'shared';
  /** Ebene der Überschrift; 3 für Untergruppen, etwa die Monate im Verlauf */
  level?: 2 | 3;
  /** Sprungmarke, z. B. „verlauf“ für /beziehungen/<id>?sicht=privat#verlauf */
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const headingId = useId();
  const Heading = level === 3 ? 'h3' : 'h2';
  const heading = label && (
    <Heading
      id={headingId}
      className="flex min-w-0 flex-1 items-center gap-2 px-1 font-semibold text-muted-foreground text-sm uppercase tracking-label"
    >
      {tone === 'shared' && <BrandMark className="h-3.5 w-5" />}
      {label}
    </Heading>
  );
  return (
    <section
      data-slot="row-group"
      id={id}
      {...(label ? { 'aria-labelledby': headingId } : {})}
      className={cn('flex flex-col gap-2', id && 'scroll-mt-6', className)}
    >
      {action ? (
        <div className="flex items-center gap-3">
          {heading}
          {action}
        </div>
      ) : (
        heading
      )}
      {intro}
      <div
        data-tone={tone}
        className={cn(
          'flex flex-col divide-y overflow-hidden rounded-md',
          tone === 'shared'
            ? 'border border-mint-line bg-mint-soft divide-mint-line'
            : 'divide-row-line bg-card',
        )}
      >
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
  /** Titel und Unterzeile umbrechen statt kürzen, für erklärende Sätze (Vorlage K1-Kurz-Pruefen) */
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
    <RowBody
      lead={lead}
      title={title}
      detail={detail}
      value={value}
      valueTone={valueTone}
      wrap={wrap}
    />
  );
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

const row = 'flex min-h-14 items-center gap-3 px-3.5 py-2.5';

/** Inhalt einer Zeile: Monogramm oder Punkt, Titel und Unterzeile, rechts der Wert */
function RowBody({
  lead,
  title,
  detail,
  value,
  valueTone = 'muted',
  wrap = false,
}: {
  lead?: React.ReactNode;
  title: React.ReactNode;
  detail?: React.ReactNode;
  value?: React.ReactNode;
  valueTone?: 'muted' | 'accent';
  wrap?: boolean;
}) {
  return (
    <>
      {lead && <span className="flex shrink-0 items-center">{lead}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className={cn('font-semibold text-ink text-row', wrap ? 'text-pretty' : 'truncate')}>
          {title}
        </b>
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
}

/**
 * Zeile, die aufklappt (Verlauf der Akte, K2-c.3): sieht aus wie `Row`, ist aber ein Knopf mit
 * aria-expanded und Pfeil nach unten. Aufgeklappt stehen Einzelheiten und Aktionen darunter, auf
 * Höhe des Titels; die Unterzeile bricht dann um. Ohne Inhalt klappt die Zeile einen Bereich
 * außerhalb auf (`controls`), etwa „Alles anzeigen“.
 */
function DisclosureRow({
  lead,
  title,
  detail,
  value,
  open,
  onToggle,
  controls,
  children,
}: {
  lead?: React.ReactNode;
  title: React.ReactNode;
  detail?: React.ReactNode;
  value?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  /** id des Bereichs außerhalb, den die Zeile aufklappt; nur ohne children */
  controls?: string;
  children?: React.ReactNode;
}) {
  const panelId = useId();
  return (
    <div data-slot="disclosure-row" className="flex min-w-0 flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={children ? panelId : controls}
        onClick={onToggle}
        className={cn(
          row,
          'w-full text-left text-text hover:bg-paper focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50',
        )}
      >
        <RowBody lead={lead} title={title} detail={detail} value={value} wrap={open} />
        <ChevronDownIcon
          aria-hidden
          data-slot="row-arrow"
          className={cn(
            'size-4 shrink-0 text-ring-open transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {children && open && (
        <div
          id={panelId}
          className={cn('flex min-w-0 flex-col gap-3 pr-3.5 pb-3.5', lead ? 'pl-16' : 'pl-3.5')}
        >
          {children}
        </div>
      )}
    </div>
  );
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

export { DisclosureRow, Row, RowGroup, RowHead, RowHeads };
