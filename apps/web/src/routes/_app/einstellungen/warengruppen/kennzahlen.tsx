import { createFileRoute } from '@tanstack/react-router';
import { KpiSettingsPage } from '@/features/material-groups/settings-pages';

export const Route = createFileRoute('/_app/einstellungen/warengruppen/kennzahlen')({
  component: KpiSettingsPage,
});
