import { createFileRoute } from '@tanstack/react-router';
import { MaterialGroupImportPage } from '@/features/material-groups/settings-pages';

export const Route = createFileRoute('/_app/einstellungen/warengruppen/import')({
  component: MaterialGroupImportPage,
});
