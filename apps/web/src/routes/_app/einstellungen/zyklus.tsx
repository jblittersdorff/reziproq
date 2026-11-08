import { createFileRoute } from '@tanstack/react-router';
import { CycleSettingsPage } from '@/features/settings/cycle-settings-page';

export const Route = createFileRoute('/_app/einstellungen/zyklus')({
  component: CycleSettingsPage,
});
