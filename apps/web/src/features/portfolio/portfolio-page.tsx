import { ChartScatterIcon } from 'lucide-react';
import { ComingPage } from '@/features/shell/coming-page';
import { useT } from '@/lib/i18n';

/** Portfolio (PLT-11): Titel und leerer Zustand, bis SEG-07 die Matrix liefert. */
export function PortfolioPage() {
  const t = useT();
  return (
    <ComingPage
      title={t.portfolio.title}
      purpose={t.portfolio.purpose}
      icon={<ChartScatterIcon aria-hidden />}
      emptyTitle={t.portfolio.emptyTitle}
      emptyDescription={t.portfolio.emptyDescription}
    />
  );
}
