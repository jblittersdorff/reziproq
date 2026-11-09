import { ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Tile, TileActions, TileText, TileTitle } from '@/components/ui/tile';
import { routerLink } from '@/features/shell/navigation';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Kachel z. B. im Portfolio: Titel, ein Satz, eine Kennzahl und „Öffnen“. Nur für Gebautes
 * (UMB-05); ohne Adresse gibt es keinen Knopf.
 */
export function WorkspaceTile({
  title,
  text,
  metric,
  href,
}: {
  title: string;
  text: string;
  metric?: ReactNode;
  href?: string | undefined;
}) {
  const t = useT();
  return (
    <li>
      <Tile size="lg">
        <TileTitle>{title}</TileTitle>
        <TileText>{text}</TileText>
        {metric}
        {href && (
          <TileActions>
            {routerLink({
              href,
              // Leiser Link statt gefülltem Knopf: Die Seite hat nur eine Hauptaktion (PLT-10).
              className: cn(
                buttonVariants({ variant: 'link' }),
                'px-0 font-semibold has-[>svg]:px-0',
              ),
              'aria-label': t.workspace.openLabel(title),
              children: (
                <>
                  {t.workspace.open}
                  <ChevronRightIcon aria-hidden />
                </>
              ),
            })}
          </TileActions>
        )}
      </Tile>
    </li>
  );
}

/** Raster der Kacheln, höchstens sechs je Seite. */
export function TileGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </ul>
  );
}
