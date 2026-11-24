import { EllipsisIcon } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/utils';
import { BackLink } from './back-link';
import { defaultRenderLink, type NavItem, type RenderLink } from './nav-link';

/**
 * Bereiche oder Ansichten als Segment-Umschalter aus Links: Fläche `track`, aktives Segment weiß
 * mit Schatten (Lieferanten- und Warengruppenkopf, Ansichten von „Alle Aufgaben“).
 */
function AreaSwitch({
  label,
  areas,
  active,
  renderLink,
}: {
  label: string;
  areas: NavItem[];
  active: string | undefined;
  renderLink: RenderLink;
}) {
  return (
    <nav
      aria-label={label}
      className="flex min-w-0 max-w-full gap-0.5 overflow-x-auto rounded-segment bg-track p-0.75"
    >
      {areas.map((area) => (
        <span key={area.key} className="contents">
          {renderLink({
            href: area.href,
            'aria-current': area.key === active ? 'page' : undefined,
            className: cn(
              // Schrumpft auf dem Telefon und bricht dann um, statt über den Rand zu ragen
              'inline-flex min-h-11 min-w-0 flex-[1_1_auto] items-center justify-center text-balance rounded-segment-item px-3 py-1 text-center text-detail leading-tight no-underline shell:px-4.5',
              area.key === active
                ? 'bg-card font-semibold text-ink shadow-segment'
                : 'font-medium text-muted-strong hover:text-ink',
            ),
            children: area.label,
          })}
        </span>
      ))}
    </nav>
  );
}

/** Unterseiten eines Bereichs als schlichte Links; die aktive Seite Tinte gefüllt */
function PageLinks({
  label,
  pages,
  active,
  renderLink,
}: {
  label: string;
  pages: NavItem[];
  active: string | undefined;
  renderLink: RenderLink;
}) {
  return (
    <nav aria-label={label} className="flex min-w-0 gap-1 overflow-x-auto py-0.5">
      {pages.map((page) => (
        <span key={page.key} className="contents">
          {renderLink({
            href: page.href,
            'aria-current': page.key === active ? 'page' : undefined,
            className: cn(
              'inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-3 text-sm no-underline',
              page.key === active
                ? 'bg-ink font-semibold text-on-dark'
                : 'font-medium text-muted-strong hover:text-ink',
            ),
            children: page.label,
          })}
        </span>
      ))}
    </nav>
  );
}

interface HeaderProps {
  back: { label: string; href: string };
  name: string;
  /** Graue Zeile, z. B. „Hoher Impact · ausbaufähig · Elektronik · Schritt 4 von 6: Plan“ */
  meta: React.ReactNode;
  areasLabel: string;
  areas: NavItem[];
  activeArea: string | undefined;
  pagesLabel?: string | undefined;
  pages?: NavItem[] | undefined;
  activePage?: string | undefined;
  renderLink?: RenderLink;
}

function HeaderFrame({
  slot,
  back,
  name,
  meta,
  side,
  areasLabel,
  areas,
  activeArea,
  pagesLabel,
  pages,
  activePage,
  renderLink = defaultRenderLink,
}: HeaderProps & { slot: string; side?: React.ReactNode }) {
  return (
    <header data-slot={slot} className="flex min-w-0 flex-col gap-3">
      <BackLink label={back.label} href={back.href} renderLink={renderLink} />
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-balance font-display font-semibold text-title-phone tracking-title shell:text-title">
            {name}
          </h1>
          <span className="text-detail text-muted-foreground">{meta}</span>
        </div>
        {side}
      </div>
      <AreaSwitch label={areasLabel} areas={areas} active={activeArea} renderLink={renderLink} />
      {pages && pages.length > 0 && (
        <PageLinks
          label={pagesLabel ?? areasLabel}
          pages={pages}
          active={activePage}
          renderLink={renderLink}
        />
      )}
    </header>
  );
}

/**
 * Lieferantenkopf (UX-20 `SupplierHeader`, NAV-10 Ablauf 7, Vorlage `SupplierBar.dc.html`):
 * „‹ Lieferanten“, Name groß, graue Zeile mit Segment, Warengruppe und Schritt, runder Knopf „···“
 * für Profil, vier Bereiche als Segment-Umschalter, Unterseiten als schlichte Links.
 */
function SupplierHeader({
  profile,
  ...props
}: HeaderProps & { profile: { label: string; href: string; active: boolean } }) {
  const renderLink = props.renderLink ?? defaultRenderLink;
  return (
    <HeaderFrame
      {...props}
      slot="supplier-header"
      side={renderLink({
        href: profile.href,
        'aria-label': profile.label,
        'aria-current': profile.active ? 'page' : undefined,
        className: cn(
          'inline-flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          profile.active ? 'bg-ink text-primary-foreground' : 'bg-card text-petrol',
        ),
        children: <EllipsisIcon aria-hidden className="size-5" />,
      })}
    />
  );
}

/** Warengruppenkopf (UX-20 `CategoryHeader`, Vorlage `GroupBar.dc.html`): wie der Lieferantenkopf ohne Profil-Knopf */
function CategoryHeader(props: HeaderProps) {
  return <HeaderFrame {...props} slot="category-header" />;
}

export { AreaSwitch, CategoryHeader, SupplierHeader };
