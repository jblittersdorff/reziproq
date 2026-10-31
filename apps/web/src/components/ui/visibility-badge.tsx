import { LockIcon, UsersIcon } from 'lucide-react';

import { Badge } from './badge';

/**
 * Kennzeichen Intern oder Geteilt (NAV-09): immer Symbol und Text, nie nur Farbe.
 * Intern sieht nur die eigene Organisation, Geteilt auch die andere Seite der Beziehung.
 */
function VisibilityBadge({
  visibility,
  label,
}: {
  visibility: 'internal' | 'shared';
  label: string;
}) {
  return (
    <Badge
      variant={visibility === 'internal' ? 'neutral' : 'selected'}
      data-visibility={visibility}
    >
      {visibility === 'internal' ? <LockIcon aria-hidden /> : <UsersIcon aria-hidden />}
      {label}
    </Badge>
  );
}

export { VisibilityBadge };
