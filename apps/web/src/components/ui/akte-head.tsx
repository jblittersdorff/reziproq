import { EllipsisIcon } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/utils';
import { BackLink } from './back-link';
import { buttonVariants } from './button';
import { AreaSwitch, type SwitchItem } from './entity-header';
import { Monogram } from './monogram';
import { defaultRenderLink, type RenderLink } from './nav-link';

/**
 * Kopf der Akte (AK-01 `AkteKopf`, Designsprache „Akte-Kopf“, Vorlagen L-Ueberblick und
 * A-Lieferant): Zurück-Link, Monogramm 56 px in der Farbe des Gegenübers (Petrol), Name groß, graue
 * Zeile (Segment, Warengruppen, Spend, Lead, Schritt im Jahreszyklus), Aktionen von Reziproq als
 * Zweitknöpfe und „···“ für Profil, Team und Mandat; darunter der Sichten-Umschalter, der die Adresse
 * setzt. Auf dem Telefon trägt die graue Zeile nur das Nötigste (`metaShort`).
 */
function AkteHead({
  back,
  name,
  meta,
  metaShort,
  actionsLabel,
  actions,
  more,
  views,
  renderLink = defaultRenderLink,
  className,
}: {
  back: { label: string; href: string };
  name: string;
  meta: React.ReactNode;
  /** Graue Zeile unter 761 px, z. B. „Strategisch · 4,2 Mio. €“ */
  metaShort?: React.ReactNode;
  /** Name der Gruppe der Aktionen für Screenreader */
  actionsLabel: string;
  actions: { key: string; label: string; href: string }[];
  /** „···“ mit Namen für Screenreader */
  more?: { label: string; href: string };
  views: { label: string; active: string; items: SwitchItem[] };
  renderLink?: RenderLink;
  className?: string;
}) {
  return (
    <header data-slot="akte-head" className={cn('flex min-w-0 flex-col gap-4', className)}>
      <BackLink label={back.label} href={back.href} renderLink={renderLink} />
      <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_20rem] items-center gap-3.5">
          <Monogram name={name} tone="petrol" size="xl" />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-balance font-display font-semibold text-title-phone tracking-title shell:text-title">
              {name}
            </h1>
            <p className="text-detail text-muted-foreground">
              {metaShort ? (
                <>
                  <span className="shell:hidden">{metaShort}</span>
                  <span className="hidden shell:inline">{meta}</span>
                </>
              ) : (
                meta
              )}
            </p>
          </div>
        </div>
        {(actions.length > 0 || more) && (
          <nav aria-label={actionsLabel} className="flex flex-wrap items-center gap-2">
            {actions.map((action) => (
              <span key={action.key} className="contents">
                {renderLink({
                  href: action.href,
                  className: cn(buttonVariants({ variant: 'secondary' }), 'no-underline'),
                  children: action.label,
                })}
              </span>
            ))}
            {more &&
              renderLink({
                href: more.href,
                'aria-label': more.label,
                className: cn(
                  buttonVariants({ variant: 'secondary' }),
                  'size-11 px-0 no-underline [&_svg]:size-5',
                ),
                children: <EllipsisIcon aria-hidden />,
              })}
          </nav>
        )}
      </div>
      <div className="max-w-xl">
        <AreaSwitch
          label={views.label}
          areas={views.items}
          active={views.active}
          renderLink={renderLink}
        />
      </div>
    </header>
  );
}

export { AkteHead };
