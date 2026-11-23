import { createFileRoute } from '@tanstack/react-router';
import { ApprovalSettingsPage } from '@/features/material-groups/settings-pages';

// WG-16: Schwellen und Freigebende je Weg, nur Admins ändern sie
export const Route = createFileRoute('/_app/einstellungen/warengruppen/freigabeweg')({
  component: ApprovalSettingsPage,
});
