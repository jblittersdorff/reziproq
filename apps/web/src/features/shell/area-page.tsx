import { EmptyState } from '@/components/ui/empty-state';
import { useT } from '@/lib/i18n';
import { type AreaKey, areaByKey } from './areas';
import { PageHeader } from './page-header';

/** Bereichsseite, solange die Funktion fehlt: Titel, Satz aus der Kachel, leerer Zustand. */
export function AreaPage({ area: key }: { area: AreaKey }) {
  const t = useT();
  const area = areaByKey(key);
  const texts = t.areas[key];
  const Icon = area.icon;
  return (
    <>
      <PageHeader title={texts.title} purpose={texts.sentence} />
      <EmptyState
        size="lg"
        icon={<Icon aria-hidden />}
        title={t.comingWith(area.release)}
        description={texts.emptyDescription}
      />
    </>
  );
}
