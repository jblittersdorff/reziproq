import { createFileRoute } from '@tanstack/react-router';
import { AddinPage } from '@/features/calendar/addin-page';

// IN-03: Aufgabenbereich des Outlook-Add-ins; ohne Rahmen der App, mit Login.
export const Route = createFileRoute('/addin/outlook')({
  component: () => <AddinPage />,
});
