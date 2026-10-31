import { ReceiptEuroIcon } from 'lucide-react';
import { ComingPage } from '@/features/shell/coming-page';
import { useT } from '@/lib/i18n';

/** Wirkung (PLT-11): Titel und leerer Zustand, bis PNL-10 Pipeline und P&L-Brücke liefert. */
export function ImpactPage() {
  const t = useT();
  return (
    <ComingPage
      title={t.impact.title}
      purpose={t.impact.purpose}
      icon={<ReceiptEuroIcon aria-hidden />}
      emptyTitle={t.impact.emptyTitle}
      emptyDescription={t.impact.emptyDescription}
    />
  );
}
