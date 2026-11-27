import { AreaSwitch } from '@/components/ui/entity-header';
import { routerLink } from '@/features/shell/navigation';
import { useMessages } from '@/lib/i18n';
import { relationshipsMessages } from './relationships-messages';

/** Adresse der Linse Segmente (BZ-01); `/portfolio` leitet hierher weiter */
export const segmentsHref = '/beziehungen?linse=segmente';

/** Linsen-Umschalter Liste | Segmente der Seite Lieferanten (BZ-01, Vorlagen Lieferanten, K2-Segmente) */
export function RelationshipLenses({ active }: { active: 'liste' | 'segmente' }) {
  const text = useMessages(relationshipsMessages);
  return (
    <div className="max-w-80">
      <AreaSwitch
        label={text.lenses.label}
        active={active}
        renderLink={routerLink}
        areas={[
          { key: 'liste', label: text.lenses.list, href: '/beziehungen' },
          { key: 'segmente', label: text.lenses.segments, href: segmentsHref },
        ]}
      />
    </div>
  );
}
