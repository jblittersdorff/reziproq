import type * as React from 'react';

import { cn } from '@/lib/utils';
import { Badge } from './badge';
import { Monogram } from './monogram';
import { defaultRenderLink, type RenderLink } from './nav-link';

/**
 * Warengruppen-Leiste (Designsprache, GroupBar.dc.html): wie die Lieferanten-Leiste, das
 * Monogramm als Tinte-Kreis mit Mint-Text, darunter Umsatz, Lieferanten und Lead, rechts der Stand
 * der Strategie als Chip.
 */
function GroupBar({
  label,
  name,
  code,
  href,
  subtitle,
  status,
  statusTone = 'warning',
  renderLink = defaultRenderLink,
  className,
}: {
  /** Name der Leiste für Screenreader */
  label: string;
  name: string;
  /** Kennung für das Monogramm, z. B. „LP“; sonst die Anfangsbuchstaben des Namens */
  code?: string;
  href: string;
  /** z. B. „Warengruppe · 8,2 Mio. € · 7 Lieferanten · Lead Sara Ost“ */
  subtitle: React.ReactNode;
  /** z. B. „Strategie 2027 · Entwurf“ */
  status?: string;
  statusTone?: 'warning' | 'success' | 'neutral';
  renderLink?: RenderLink;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      data-slot="group-bar"
      className={cn('border-line border-b bg-card', className)}
    >
      <div className="mx-auto flex w-full max-w-300 flex-wrap items-center justify-between gap-3.5 px-4 py-5.5 sm:px-12">
        {renderLink({
          href,
          className:
            'flex min-h-11 min-w-0 items-center gap-4 rounded-lg text-text no-underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          children: (
            <>
              <Monogram name={code ?? name} tone="ink" size="lg" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <strong className="font-display font-semibold text-bar-name tracking-title">
                  {name}
                </strong>
                <span className="text-muted-foreground text-sm">{subtitle}</span>
              </span>
            </>
          ),
        })}
        {status && (
          <Badge variant={statusTone} className="min-h-10 px-4">
            {status}
          </Badge>
        )}
      </div>
    </nav>
  );
}

export { GroupBar };
