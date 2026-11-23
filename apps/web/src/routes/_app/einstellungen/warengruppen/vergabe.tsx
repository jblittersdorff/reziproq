import { createFileRoute } from '@tanstack/react-router';
import { AwardEligibilitySettingsPage } from '@/features/material-groups/settings-pages';

// WG-14: Bedingungen für Vergabefähigkeit, nur Admins ändern sie
export const Route = createFileRoute('/_app/einstellungen/warengruppen/vergabe')({
  component: AwardEligibilitySettingsPage,
});
