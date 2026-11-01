import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { useT } from '@/lib/i18n';

/** Kennzeichen „Intern“ (NAV-09): Der Bereich Strategie trägt es auf jeder Seite. */
export function InternalBadge() {
  const t = useT();
  return <VisibilityBadge visibility="internal" label={t.workspace.internal} />;
}
