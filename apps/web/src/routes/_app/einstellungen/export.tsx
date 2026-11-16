import { createFileRoute } from '@tanstack/react-router';
import { DataExportPage } from '@/features/settings/data-export-page';

export const Route = createFileRoute('/_app/einstellungen/export')({
  component: DataExportPage,
});
