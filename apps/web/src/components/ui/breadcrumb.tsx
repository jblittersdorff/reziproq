import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { defaultRenderLink, type RenderLink } from './nav-link';

/**
 * Pfad mit Zurück-Pfeil unter der Leiste (PLT-11, NAV-03), z. B. Einstellungen › Organisation.
 * Der Pfeil führt zur vorigen Ebene, genau wie der Zurück-Knopf des Browsers.
 */
function Breadcrumb({
  label,
  backLabel,
  trail,
  current,
  renderLink = defaultRenderLink,
  className,
}: {
  label: string;
  /** z. B. „Zurück zu Einstellungen“ */
  backLabel: string;
  /** Ebenen von oben nach unten, ohne die aktuelle Seite; die letzte ist das Ziel des Pfeils */
  trail: { label: string; href: string }[];
  current: string;
  renderLink?: RenderLink;
  className?: string;
}) {
  const back = trail.at(-1);
  return (
    <nav
      aria-label={label}
      data-slot="breadcrumb"
      className={cn('flex items-center gap-1', className)}
    >
      {back &&
        renderLink({
          href: back.href,
          className:
            'flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-paper hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-5',
          'aria-label': backLabel,
          children: <ChevronLeftIcon aria-hidden />,
        })}
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
        {trail.map((step) => (
          <li key={step.href} className="flex items-center gap-1">
            {renderLink({
              href: step.href,
              className:
                'flex min-h-11 min-w-11 items-center justify-center rounded-md px-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              children: step.label,
            })}
            <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
          </li>
        ))}
        <li aria-current="page" className="font-medium">
          {current}
        </li>
      </ol>
    </nav>
  );
}

export { Breadcrumb };
