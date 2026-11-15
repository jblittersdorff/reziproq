import { LockIcon } from 'lucide-react';

import { Badge } from './badge';
import { BrandMark } from './brand-mark';

/**
 * Kennzeichen Intern oder Geteilt (NAV-09, Designsprache Regel 6): immer Symbol und Text, nie nur
 * Farbe. Privat grau mit Schloss, geteilt Mint mit Doppelring.
 */
function VisibilityBadge({
  visibility,
  label,
}: {
  visibility: 'internal' | 'shared';
  label: string;
}) {
  return (
    <Badge variant={visibility === 'internal' ? 'neutral' : 'shared'} data-visibility={visibility}>
      {visibility === 'internal' ? <LockIcon aria-hidden /> : <BrandMark className="h-3 w-4.5" />}
      {label}
    </Badge>
  );
}

export { VisibilityBadge };
