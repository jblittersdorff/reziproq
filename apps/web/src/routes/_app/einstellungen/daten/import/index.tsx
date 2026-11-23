import { createFileRoute } from '@tanstack/react-router';
import { ImportsPage } from '@/features/imports/import-pages';

export const Route = createFileRoute('/_app/einstellungen/daten/import/')({
  component: ImportsPage,
});
