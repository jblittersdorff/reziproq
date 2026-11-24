import { createFileRoute } from '@tanstack/react-router';
import { OverviewPage } from '@/features/insights/overview-page';

// NAV-10, AW-01: Übersicht mit Ringpaar, Zeilenliste und Fragevorschlägen
export const Route = createFileRoute('/_app/uebersicht/')({
  component: OverviewPage,
});
