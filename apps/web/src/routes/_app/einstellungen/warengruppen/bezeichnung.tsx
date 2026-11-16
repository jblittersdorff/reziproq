import { createFileRoute } from '@tanstack/react-router';
import { CategoryLabelPage } from '@/features/material-groups/settings-pages';

export const Route = createFileRoute('/_app/einstellungen/warengruppen/bezeichnung')({
  component: CategoryLabelPage,
});
