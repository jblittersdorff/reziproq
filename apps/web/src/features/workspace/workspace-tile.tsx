import { ClockIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Tile, TileActions, TileText, TileTitle } from '@/components/ui/tile';
import { routerLink } from '@/features/shell/navigation';
import { useT } from '@/lib/i18n';
import type { Coming } from './areas';

/**
 * Kachel im Arbeitsbereich (NAV-06): Titel, ein Satz, eine Kennzahl und „Öffnen“. Fehlt das
 * Modul noch, steht dort der Release-Hinweis; ohne Adresse gibt es keinen Knopf.
 */
export function WorkspaceTile({
  title,
  text,
  metric,
  coming,
  href,
}: {
  title: string;
  text: string;
  metric?: ReactNode;
  coming?: Coming | null | undefined;
  href?: string | undefined;
}) {
  const t = useT();
  return (
    <li>
      <Tile size="lg" className="items-center">
        <TileTitle>{title}</TileTitle>
        <TileText>{text}</TileText>
        {/* Der Hinweis ist leise; laut ist nur eine echte Kennzahl. */}
        {coming ? (
          <p className="flex items-center gap-2 text-muted-foreground text-sm">
            <ClockIcon aria-hidden className="size-4" />
            {t.workspace.coming[coming]}
          </p>
        ) : (
          metric
        )}
        {href && (
          <TileActions>
            {routerLink({
              href,
              className: buttonVariants(),
              'aria-label': t.workspace.openLabel(title),
              children: t.workspace.open,
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
