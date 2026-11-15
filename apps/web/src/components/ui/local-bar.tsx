import type * as React from 'react';

import { cn } from '@/lib/utils';
import { defaultRenderLink, type NavItem, type RenderLink } from './nav-link';

// Bereiche als Reiter mit 3 px Tinte-Unterstrich (SupplierBar.dc.html).
const tabClass =
  'relative flex min-h-11.5 items-center whitespace-nowrap border-transparent border-b-3 px-3.5 font-medium text-base text-muted-foreground transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset aria-[current=page]:border-ink aria-[current=page]:font-semibold aria-[current=page]:text-ink';

// Unterseiten als Pillen auf paper; sichtbar 36 px, Klickfläche über ::after 44 px.
const pillClass =
  'relative flex min-h-9 items-center rounded-full px-3.5 font-medium text-muted-strong text-sm transition-colors after:absolute after:inset-x-0 after:-inset-y-1 hover:text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-card aria-[current=page]:font-semibold aria-[current=page]:text-ink aria-[current=page]:shadow-toggle';

/**
 * Leiste eines Lieferanten oder Kunden unter der Kopfleiste (NAV-06, Designsprache
 * „Lieferanten-Leiste“): weiß, links Monogramm und Name in Outfit mit einer Zeile darunter,
 * rechts die Kette mit dem Schritt und Platz für „Nächster Schritt“; darunter die Bereiche als
 * Reiter und, falls vorhanden, die Unterseiten als Pillen auf paper. Die Reiter bleiben beim
 * Scrollen oben stehen; Name und Unterseiten scrollen mit, damit auf dem Telefon genug Platz
 * bleibt. Bricht auf schmalen Bildschirmen um, auch die Reiter (NAV-06; die Vorlage
 * scrollt sie seitwärts, die Spec verlangt Umbruch).
 */
function LocalBar({
  label,
  name,
  nameIcon,
  nameHref,
  subtitle,
  progress,
  items,
  activeKey,
  subItems,
  subLabel,
  activeSubKey,
  action,
  sticky = true,
  renderLink = defaultRenderLink,
  className,
}: {
  label: string;
  name: string;
  /** z. B. das Monogramm des Lieferanten (UMB-05), dekorativ */
  nameIcon?: React.ReactNode;
  nameHref: string;
  /** Zeile unter dem Namen, z. B. Segment und SRO */
  subtitle?: React.ReactNode;
  /** z. B. Kette mit „Schritt 4 von 7 · Gemeinsamer Plan“ */
  progress?: React.ReactNode;
  items: NavItem[];
  activeKey?: string | undefined;
  /** Unterseiten des aktiven Bereichs */
  subItems?: NavItem[];
  /** Name der Unterseiten-Navigation für Screenreader */
  subLabel?: string;
  activeSubKey?: string | undefined;
  /** z. B. der Knopf „Nächster Schritt“ (ZYK-01) */
  action?: React.ReactNode;
  sticky?: boolean;
  renderLink?: RenderLink;
  className?: string;
}) {
  // Die Navigation umfasst Name und Reiter, ohne eigene Box (contents): So kann die Zeile mit den
  // Reitern an der Seite kleben, während die Zeile mit dem Namen mitscrollt.
  return (
    <>
      <nav aria-label={label} className="contents">
        <div data-slot="local-bar" className={cn('bg-card', className)}>
          <div className="mx-auto flex w-full max-w-300 flex-wrap items-center justify-between gap-3.5 px-4 pt-6 sm:px-12">
            {renderLink({
              href: nameHref,
              className:
                'flex min-h-11 min-w-0 items-center gap-4 rounded-lg text-text no-underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              children: (
                <>
                  {nameIcon}
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <strong className="font-display font-semibold text-bar-name tracking-title">
                      {name}
                    </strong>
                    {subtitle && <span className="text-muted-foreground text-sm">{subtitle}</span>}
                  </span>
                </>
              ),
            })}
            {(progress || action) && (
              <div className="flex flex-wrap items-center gap-2">
                {progress}
                {action}
              </div>
            )}
          </div>
        </div>
        <div
          data-slot="local-bar-nav"
          className={cn('z-10 border-line border-b bg-card', sticky && 'sticky top-17')}
        >
          <div className="mx-auto w-full max-w-300 px-4 pt-4 sm:px-12">
            <ul className="-mb-px flex flex-wrap gap-x-1">
              {items.map((item) => (
                <li key={item.key}>
                  {renderLink({
                    href: item.href,
                    className: tabClass,
                    'aria-current': item.key === activeKey ? 'page' : undefined,
                    children: item.label,
                  })}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </nav>
      {subItems && subItems.length > 0 && (
        <div className="border-line border-t bg-paper">
          <nav aria-label={subLabel} className="mx-auto w-full max-w-300 px-4 py-2.5 sm:px-12">
            <ul className="flex flex-wrap gap-1.5">
              {subItems.map((item) => (
                <li key={item.key}>
                  {renderLink({
                    href: item.href,
                    className: pillClass,
                    'aria-current': item.key === activeSubKey ? 'page' : undefined,
                    children: item.label,
                  })}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}

/** Kette und Schritt als Pille auf paper, rechts in der Leiste. */
function LocalBarProgress({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-10 items-center gap-3 rounded-full bg-paper py-1 pr-4 pl-3.5 font-semibold text-sm">
      {children}
    </span>
  );
}

export { LocalBar, LocalBarProgress };
