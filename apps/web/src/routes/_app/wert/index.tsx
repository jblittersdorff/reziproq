import { createFileRoute } from '@tanstack/react-router';
import { OverviewPage } from '@/features/insights/overview-page';

// NAV-10 2.0: Wert (bisher Übersicht, AW-01) mit Ringpaar, Zeilenliste und Fragevorschlägen; die
// Seite nach WK-01 kommt mit K4-b.
export const Route = createFileRoute('/_app/wert/')({
  component: OverviewPage,
});
