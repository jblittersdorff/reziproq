import { CheckIcon } from 'lucide-react';
import type * as React from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// WEB-01: Bausteine der Website. Farben, Größen und Radien nur über die Tokens der App
// (apps/web/src/styles/tokens.css); Knöpfe sind die Pillen aus dem UI-Paket.

export function Wrap({
  className,
  children,
}: {
  className?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-site px-5 sm:px-8 lg:px-12', className)}>
      {children}
    </div>
  );
}

const tones = {
  paper: 'bg-background',
  card: 'bg-card',
  ink: 'bg-ink text-on-dark',
} as const;

export function Section({
  tone = 'paper',
  id,
  label,
  className,
  children,
}: {
  tone?: keyof typeof tones;
  id?: string;
  label?: string;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-label={label}
      className={cn('scroll-mt-24 py-site-section', tones[tone], className)}
    >
      {children}
    </section>
  );
}

export function Eyebrow({
  children,
  onDark = false,
}: {
  children: React.ReactNode;
  onDark?: boolean;
}) {
  return (
    <span
      className={cn('font-semibold text-sm tracking-wide', onDark ? 'text-mint' : 'text-petrol')}
    >
      {children}
    </span>
  );
}

export function PageTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <h1
      className={cn(
        'text-balance font-display font-semibold text-ink text-site-hero tracking-site-hero',
        className,
      )}
    >
      {children}
    </h1>
  );
}

export function Heading({
  children,
  onDark = false,
  as: Tag = 'h2',
  className,
}: {
  children: React.ReactNode;
  onDark?: boolean;
  as?: 'h2' | 'h3';
  className?: string | undefined;
}) {
  return (
    <Tag
      className={cn(
        'text-balance font-display font-semibold text-site-title tracking-title-lg',
        onDark ? 'text-on-dark' : 'text-ink',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <h3
      className={cn(
        'text-balance font-display font-semibold text-ink text-section tracking-section-sm',
        className,
      )}
    >
      {children}
    </h3>
  );
}

export function Lead({
  children,
  onDark = false,
  className,
}: {
  children: React.ReactNode;
  onDark?: boolean;
  className?: string | undefined;
}) {
  return (
    <p
      className={cn(
        'text-pretty text-site-lead',
        onDark ? 'text-on-dark-muted' : 'text-muted-strong',
        className,
      )}
    >
      {children}
    </p>
  );
}

export function Body({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-pretty text-base text-muted-strong', className)}>{children}</p>;
}

export function Card({
  className,
  children,
}: {
  className?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-site bg-card p-7 shadow-card', className)}>
      {children}
    </div>
  );
}

/** Kleine Marke als Etikett, z. B. „Kostenlos für Lieferanten“ */
export function Chip({
  tone = 'mint',
  className,
  children,
}: {
  tone?: 'mint' | 'mintStrong' | 'neutral' | 'ink' | 'onDark';
  className?: string | undefined;
  children: React.ReactNode;
}) {
  const styles = {
    mint: 'bg-mint-soft text-petrol-dark',
    mintStrong: 'bg-mint text-ink',
    neutral: 'bg-line-soft text-muted-strong',
    ink: 'bg-ink text-mint',
    onDark: 'bg-dark-2 text-on-dark',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 self-start whitespace-nowrap rounded-full px-3 py-1 font-semibold text-sm',
        styles[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Klickbares als Pille (Designsprache): Haupt Petrol, Zweit weiß, auf Tinte Mint oder Umriss */
export function LinkPill({
  href,
  variant = 'default',
  size = 'lg',
  className,
  children,
}: {
  href: string;
  variant?: 'default' | 'secondary' | 'mint' | 'dark' | 'link';
  size?: 'default' | 'lg';
  className?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <a href={href} className={cn(buttonVariants({ variant, size }), 'no-underline', className)}>
      {children}
    </a>
  );
}

export function Actions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return <div className={cn('flex flex-wrap items-center gap-3', className)}>{children}</div>;
}

/** Zahl im Kreis (Schritte, Phasen); Parteien, Termine und Schritte sind Kreise */
export function NumberCircle({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full font-display font-semibold text-sm',
        accent ? 'bg-mint text-ink' : 'bg-ink text-mint',
      )}
    >
      {children}
    </span>
  );
}

/** Das Zwei-Kreise-Zeichen klein, z. B. vor „Zusammengefasst von Reziproq“ */
export function RingsMark({
  className,
  onDark = false,
}: {
  className?: string | undefined;
  onDark?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 28 20"
      fill="none"
      aria-hidden
      className={cn('h-4.5 w-6.5 shrink-0', className)}
    >
      <path d="M14 3.07A8 8 0 0 1 14 16.93A8 8 0 0 1 14 3.07Z" className="fill-mint" />
      <circle
        cx="10"
        cy="10"
        r="8"
        strokeWidth="2"
        className={onDark ? 'stroke-on-dark' : 'stroke-ink'}
      />
      <circle
        cx="18"
        cy="10"
        r="8"
        strokeWidth="2"
        className={onDark ? 'stroke-mint' : 'stroke-petrol'}
      />
    </svg>
  );
}

/** Zwei große Kreise als Hintergrund (Held, Tinte-Karten); rein dekorativ */
export function RingsDecor({
  className,
  onDark = false,
}: {
  className?: string | undefined;
  onDark?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 280 200"
      fill="none"
      aria-hidden
      className={cn('pointer-events-none absolute', className)}
    >
      <path
        d="M140 30.72A80 80 0 0 1 140 169.28A80 80 0 0 1 140 30.72Z"
        className="fill-mint"
        fillOpacity={onDark ? 0.22 : 0.3}
      />
      <circle
        cx="100"
        cy="100"
        r="80"
        strokeWidth="1.75"
        className={onDark ? 'stroke-on-dark' : 'stroke-ink'}
        strokeOpacity={0.18}
      />
      <circle
        cx="180"
        cy="100"
        r="80"
        strokeWidth="1.75"
        className={onDark ? 'stroke-mint' : 'stroke-petrol'}
        strokeOpacity={onDark ? 0.5 : 0.4}
      />
    </svg>
  );
}

/** Aufzählung mit Haken, wie die Teile einer Anbindung */
export function CheckList({ items, onDark = false }: { items: string[]; onDark?: boolean }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-base">
          <CheckIcon
            aria-hidden
            className={cn('mt-0.5 size-5 shrink-0', onDark ? 'text-mint' : 'text-petrol')}
          />
          <span className={onDark ? 'text-on-dark' : 'text-text'}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Rahmen einer Produktansicht mit Beispieldaten */
export function ProductFrame({
  bar,
  note,
  className,
  children,
}: {
  bar: React.ReactNode;
  note?: string;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <figure className={cn('flex min-w-0 flex-col gap-2.5', className)}>
      <div className="overflow-hidden rounded-site-lg bg-card shadow-site-frame">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-track border-b bg-background px-6 py-3">
          {bar}
        </div>
        <div className="flex flex-col gap-7 p-5 sm:p-8">{children}</div>
      </div>
      {note && <figcaption className="text-chip text-muted-foreground">{note}</figcaption>}
    </figure>
  );
}

/** Häufige Fragen als Aufklapper ohne JavaScript */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="flex min-w-0 flex-col">
      {items.map((item, index) => (
        <details
          key={item.q}
          open={index === 0}
          className="group border-line border-t last:border-b"
        >
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 font-display font-semibold text-ink text-lg [&::-webkit-details-marker]:hidden">
            {item.q}
            <span aria-hidden className="text-petrol text-xl group-open:hidden">
              +
            </span>
            <span aria-hidden className="hidden text-petrol text-xl group-open:inline">
              –
            </span>
          </summary>
          <p className="max-w-3xl pb-5 text-base text-muted-strong">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

/** Quellen zu Zahlen */
export function FootNote({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return <p className={cn('text-chip text-muted-foreground', className)}>{children}</p>;
}

/** Tinte-Karte am Ende einer Seite: eine Aussage, höchstens eine Hauptaktion */
export function InkCallout({
  title,
  lead,
  chip,
  children,
}: {
  title: string;
  lead?: string | undefined;
  chip?: string | undefined;
  children?: React.ReactNode;
}) {
  return (
    <Section>
      <Wrap>
        <div className="relative flex flex-col gap-6 overflow-hidden rounded-site-lg bg-ink p-9 text-on-dark sm:p-14">
          <RingsDecor onDark className="-right-32 top-1/2 h-100 w-140 -translate-y-1/2" />
          {chip && (
            <Chip tone="mintStrong" className="relative">
              {chip}
            </Chip>
          )}
          <Heading onDark className="relative max-w-3xl">
            {title}
          </Heading>
          {lead && (
            <Lead onDark className="relative max-w-xl">
              {lead}
            </Lead>
          )}
          {children && <Actions className="relative">{children}</Actions>}
        </div>
      </Wrap>
    </Section>
  );
}

/** Kopf eines Abschnitts: Zeile darüber, Überschrift, Einleitung */
export function SectionHead({
  eyebrow,
  title,
  lead,
  onDark = false,
  className,
}: {
  eyebrow?: string | undefined;
  title: string;
  lead?: string | undefined;
  onDark?: boolean;
  className?: string | undefined;
}) {
  return (
    <div className={cn('flex max-w-3xl flex-col gap-5', className)}>
      {eyebrow && <Eyebrow onDark={onDark}>{eyebrow}</Eyebrow>}
      <Heading onDark={onDark}>{title}</Heading>
      {lead && <Lead onDark={onDark}>{lead}</Lead>}
    </div>
  );
}

/** Kopf einer Unterseite: Zeile darüber, Titel (h1), Einleitung, Aktionen */
export function PageHero({
  eyebrow,
  title,
  lead,
  decor = false,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  decor?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden py-site-section">
      {decor && <RingsDecor className="-right-40 top-10 hidden h-128 w-180 md:block" />}
      <Wrap className="relative flex flex-col gap-7">
        <Eyebrow>{eyebrow}</Eyebrow>
        <PageTitle className="max-w-5xl">{title}</PageTitle>
        <Lead className="max-w-2xl">{lead}</Lead>
        {children}
      </Wrap>
    </section>
  );
}

/** Zwei Spalten, die auf schmalen Bildschirmen untereinander stehen */
export function Split({
  reverse = false,
  className,
  children,
}: {
  reverse?: boolean;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <Wrap
      className={cn(
        'flex flex-wrap items-center gap-x-16 gap-y-12 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-96',
        reverse && 'flex-row-reverse',
        className,
      )}
    >
      {children}
    </Wrap>
  );
}
